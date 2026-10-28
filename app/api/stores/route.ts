import { NextRequest, NextResponse } from "next/server";
import { readJsonObject } from "@/lib/request-json";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Franchise from "@/models/Franchise";
import { requireAuth } from "@/lib/api-auth";
import { validateCsrf } from "@/lib/csrf";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { createStoreBodySchema } from "@/lib/validation";
import { auditLog } from "@/lib/audit-log";

/** GET /api/stores?page=1&limit=50 — admin sees all; others see stores they created or are assigned to */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const skip = (page - 1) * limit;

    // Super admin sees all stores.
    if (auth.role === "admin") {
      const [franchises, total] = await Promise.all([
        Franchise.find({}).sort({ name: 1 }).skip(skip).limit(limit).lean(),
        Franchise.countDocuments({}),
      ]);
      return NextResponse.json({
        franchises,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    const user = await User.findById(auth.id).select("franchises").lean();

    const franchiseIds = (
      (user as { franchises?: unknown[] } | null)?.franchises ?? []
    ).map(String);
    const creatorFilter = mongoose.isValidObjectId(auth.id)
      ? new mongoose.Types.ObjectId(auth.id)
      : auth.id;
    const scopeOr: Record<string, unknown>[] = [{ createdBy: creatorFilter }];
    if (franchiseIds.length > 0) {
      scopeOr.push({ _id: { $in: franchiseIds } });
    }

    const query = { $or: scopeOr };
    const [franchises, total] = await Promise.all([
      Franchise.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Franchise.countDocuments(query),
    ]);

    return NextResponse.json({
      franchises,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[GET /api/stores]", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

/** POST /api/stores — create a new store (admin and sub_admin only) */
export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "admin" && auth.role !== "sub_admin") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // Rate limiting
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`store-create:${auth.id}`, RATE_LIMITS.storeCreate);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { message: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000)) } },
    );
  }

  // Body size limit
  const jsonBody = await readJsonObject(request, 10_000);
  if (jsonBody.response) return jsonBody.response;
  const rawBody = jsonBody.body;

  // Schema validation
  const parsed = createStoreBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const {
    name,
    storeCode,
    address,
    phone,
    description,
    storeType,
    ownerName,
    ownerPhone,
    ownerEmail,
  } = parsed.data;
  const normalizedStoreType = storeType === "company" ? "company" : "franchise";

  await connectToDatabase();

  try {
    const creatorFilter = mongoose.isValidObjectId(auth.id)
      ? new mongoose.Types.ObjectId(auth.id)
      : auth.id;

    const franchise = await Franchise.create({
      name,
      storeCode,
      address,
      phone,
      description,
      storeType: normalizedStoreType,
      ownerName: normalizedStoreType === "franchise" ? ownerName : undefined,
      ownerPhone: normalizedStoreType === "franchise" ? ownerPhone : undefined,
      ownerEmail: normalizedStoreType === "franchise" ? ownerEmail : undefined,
      createdBy: creatorFilter,
    });

    // Ensure the creator can always see/select this store immediately.
    if (mongoose.isValidObjectId(auth.id)) {
      await User.findByIdAndUpdate(auth.id, {
        $addToSet: { franchises: franchise._id },
      });
    }

    auditLog("store.created", {
      actorId: auth.id,
      actorRole: auth.role,
      targetId: String(franchise._id),
      ip,
      metadata: { name, storeCode },
    });

    return NextResponse.json({ franchise }, { status: 201 });
  } catch (err: unknown) {
    const mongoErr = err as {
      code?: number;
      keyPattern?: Record<string, unknown>;
    };
    if (mongoErr.code === 11000 && mongoErr.keyPattern?.storeCode) {
      return NextResponse.json(
        { message: "A store with this code already exists." },
        { status: 409 },
      );
    }
    console.error("[POST /api/stores]", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

/** PATCH /api/stores?id=... — update a store created by the current admin */
export async function PATCH(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "admin" && auth.role !== "sub_admin") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const storeId = new URL(request.url).searchParams.get("id");
  if (!storeId || !mongoose.isValidObjectId(storeId)) {
    return NextResponse.json({ message: "A valid store id is required." }, { status: 400 });
  }

  const jsonBody = await readJsonObject(request, 10_000);
  if (jsonBody.response) return jsonBody.response;
  const rawBody = jsonBody.body;

  const parsed = createStoreBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  await connectToDatabase();

  try {
    const creatorFilter = mongoose.isValidObjectId(auth.id)
      ? new mongoose.Types.ObjectId(auth.id)
      : auth.id;
    const {
      name,
      storeCode,
      address,
      phone,
      description,
      storeType,
      ownerName,
      ownerPhone,
      ownerEmail,
    } = parsed.data;
    const normalizedStoreType = storeType === "company" ? "company" : "franchise";
    const storeUpdate = {
      name,
      storeCode,
      address,
      phone,
      description,
      storeType: normalizedStoreType,
    };
    const updateOperation =
      normalizedStoreType === "franchise"
        ? {
            $set: {
              ...storeUpdate,
              ownerName,
              ownerPhone,
              ownerEmail,
            },
          }
        : {
            $set: storeUpdate,
            $unset: { ownerName: 1, ownerPhone: 1, ownerEmail: 1 },
          };
    const updated = await Franchise.findOneAndUpdate(
      { _id: storeId, createdBy: creatorFilter },
      updateOperation,
      { new: true, runValidators: true },
    ).lean();

    if (!updated) {
      const existing = await Franchise.exists({ _id: storeId });
      return NextResponse.json(
        { message: existing ? "You can only edit stores you created." : "Store not found." },
        { status: existing ? 403 : 404 },
      );
    }

    auditLog("store.updated", {
      actorId: auth.id,
      actorRole: auth.role,
      targetId: storeId,
      metadata: { name: updated.name, storeCode: updated.storeCode },
    });

    return NextResponse.json({ franchise: updated });
  } catch (err: unknown) {
    const mongoErr = err as {
      code?: number;
      keyPattern?: Record<string, unknown>;
    };
    if (mongoErr.code === 11000 && mongoErr.keyPattern?.storeCode) {
      return NextResponse.json(
        { message: "A store with this code already exists." },
        { status: 409 },
      );
    }
    console.error("[PATCH /api/stores]", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

