import { NextRequest, NextResponse } from "next/server";
import { readJsonObject } from "@/lib/request-json";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import Franchise from "@/models/Franchise";
import { requireAuth } from "@/lib/api-auth";
import { validateCsrf } from "@/lib/csrf";
import { auditLog } from "@/lib/audit-log";
import { storeArchiveBodySchema } from "@/lib/validation";

/** PATCH /api/stores/archive?id=... — archive or restore a store created by the caller */
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
  const parsed = storeArchiveBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  await connectToDatabase();
  const creatorId = mongoose.isValidObjectId(auth.id) ? new mongoose.Types.ObjectId(auth.id) : auth.id;
  const update = parsed.data.archived
    ? { $set: { isActive: false, archivedAt: new Date() } }
    : { $set: { isActive: true }, $unset: { archivedAt: 1 } };
  const franchise = await Franchise.findOneAndUpdate(
    { _id: storeId, createdBy: creatorId },
    update,
    { new: true, runValidators: true },
  ).lean();

  if (!franchise) {
    const exists = await Franchise.exists({ _id: storeId });
    return NextResponse.json(
      { message: exists ? "You can only archive stores you created." : "Store not found." },
      { status: exists ? 403 : 404 },
    );
  }

  auditLog(parsed.data.archived ? "store.archived" : "store.restored", {
    actorId: auth.id,
    actorRole: auth.role,
    targetId: storeId,
    metadata: { name: franchise.name, storeCode: franchise.storeCode },
  });

  return NextResponse.json({
    message: parsed.data.archived ? "Store archived successfully." : "Store restored successfully.",
    franchise,
  });
}