import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import Franchise from "@/models/Franchise";
import { connectToDatabase } from "@/lib/mongodb";
import { validateCsrf } from "@/lib/csrf";
import { getAuthorizedStoreAdminId, requireAuth } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit-log";
import { detectAllowedUploadType, parseFormDataWithLimit } from "@/lib/file-upload";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
// SVG is excluded: jsPDF's addImage (used for the slip PDF) only supports raster formats.
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getBucket() {
  const database = mongoose.connection.db;
  if (!database) throw new Error("Database connection is not ready.");
  return new mongoose.mongo.GridFSBucket(database, { bucketName: "storeLogos" });
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const franchiseId = new URL(request.url).searchParams.get("franchiseId") ?? "";
  await connectToDatabase();
  if (!(await getAuthorizedStoreAdminId(auth, franchiseId))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  const store = await Franchise.findById(franchiseId).select("logo").lean();
  if (!store?.logo?.fileId) {
    return NextResponse.json({ message: "Logo not found." }, { status: 404 });
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of getBucket().openDownloadStream(store.logo.fileId)) {
      chunks.push(Buffer.from(chunk));
    }
    return new NextResponse(new Uint8Array(Buffer.concat(chunks)), {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Type": store.logo.contentType,
      },
    });
  } catch {
    return NextResponse.json({ message: "Logo could not be read." }, { status: 404 });
  }
}

export async function POST(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const formData = await parseFormDataWithLimit(request, MAX_FILE_SIZE + 64 * 1024);
  if (!formData) {
    return NextResponse.json({ message: "Logo request is invalid or too large." }, { status: 413 });
  }
  const franchiseId = String(formData.get("franchiseId") ?? "");
  const file = formData.get("file");

  await connectToDatabase();
  if (!(await getAuthorizedStoreAdminId(auth, franchiseId))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Choose a logo to upload." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ message: "Logo must be 2 MB or smaller." }, { status: 400 });
  }

  const target = await Franchise.findById(franchiseId);
  if (!target) return NextResponse.json({ message: "Store not found." }, { status: 404 });

  const bucket = getBucket();
  const previousFileId = target.logo?.fileId;
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const contentType = detectAllowedUploadType(fileBuffer);
  if (!contentType || !ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ message: "Logo contents must be a valid PNG, JPEG, or WEBP image." }, { status: 400 });
  }
  const upload = bucket.openUploadStream(`${franchiseId}-logo`, { contentType });

  await new Promise<void>((resolve, reject) => {
    upload.once("error", reject);
    upload.once("finish", resolve);
    upload.end(fileBuffer);
  });

  try {
    target.logo = { fileId: upload.id as mongoose.Types.ObjectId, contentType };
    await target.save();
  } catch (error) {
    await bucket.delete(upload.id).catch(() => undefined);
    throw error;
  }

  if (previousFileId) {
    await bucket.delete(previousFileId).catch(() => undefined);
  }

  auditLog("store.logo.uploaded", { actorId: auth.id, actorRole: auth.role, targetId: franchiseId });

  return NextResponse.json({ message: "Logo uploaded successfully." });
}

export async function DELETE(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const franchiseId = new URL(request.url).searchParams.get("franchiseId") ?? "";
  await connectToDatabase();
  if (!(await getAuthorizedStoreAdminId(auth, franchiseId))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  const target = await Franchise.findById(franchiseId);
  if (!target) return NextResponse.json({ message: "Store not found." }, { status: 404 });

  const previousFileId = target.logo?.fileId;
  target.logo = undefined;
  await target.save();
  if (previousFileId) {
    await getBucket().delete(previousFileId).catch(() => undefined);
  }

  auditLog("store.logo.removed", { actorId: auth.id, actorRole: auth.role, targetId: franchiseId });

  return NextResponse.json({ message: "Logo removed." });
}
