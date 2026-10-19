import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import Franchise from "@/models/Franchise";
import { getAuthInfo } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { auditLog } from "@/lib/audit-log";
import { parseBodyWithLimit, storeArchiveBodySchema } from "@/lib/validation";

/** PATCH /api/stores/archive?id=... — archive or restore a store created by the caller */
export async function PATCH(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (auth.role !== "admin" && auth.role !== "sub_admin") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const storeId = new URL(request.url).searchParams.get("id");
  if (!storeId || !mongoose.isValidObjectId(storeId)) {
    return NextResponse.json({ message: "A valid store id is required." }, { status: 400 });
  }

  const rawBody = await parseBodyWithLimit(request, 10_000);
  if (rawBody === null) {
    return NextResponse.json({ message: "Request body too large." }, { status: 413 });
  }
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