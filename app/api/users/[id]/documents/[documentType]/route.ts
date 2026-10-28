import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { canManageTargetUser, USER_MANAGEMENT_CALLERS } from "@/lib/user-permissions";
import { connectToDatabase } from "@/lib/mongodb";
import { validateCsrf } from "@/lib/csrf";
import { decryptBuffer, encryptBuffer } from "@/lib/crypto";
import { detectAllowedUploadType, parseFormDataWithLimit } from "@/lib/file-upload";
import User from "@/models/User";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const DOCUMENT_FIELDS = {
  aadhar: "aadharDocument",
  pan: "panDocument",
} as const;

type DocumentType = keyof typeof DOCUMENT_FIELDS;
type DocumentMetadata = {
  fileId: mongoose.Types.ObjectId;
  fileName: string;
  contentType: string;
  size: number;
};

function getDocumentType(value: string): DocumentType | null {
  return value === "aadhar" || value === "pan" ? value : null;
}

async function authorize(id: string) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!USER_MANAGEMENT_CALLERS.has(auth.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  if (!mongoose.isValidObjectId(id) || !(await canManageTargetUser(auth, id))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }
  return null;
}

function getBucket() {
  const database = mongoose.connection.db;
  if (!database) throw new Error("Database connection is not ready.");
  return new mongoose.mongo.GridFSBucket(database, {
    bucketName: "employeeDocuments",
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentType: string }> },
) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const { id, documentType: rawDocumentType } = await params;
  const documentType = getDocumentType(rawDocumentType);
  if (!documentType) {
    return NextResponse.json({ message: "Invalid document type." }, { status: 400 });
  }

  await connectToDatabase();
  const authError = await authorize(id);
  if (authError) return authError;

  const formData = await parseFormDataWithLimit(request, MAX_FILE_SIZE + 64 * 1024);
  if (!formData) {
    return NextResponse.json({ message: "Document request is invalid or too large." }, { status: 413 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Choose a document to upload." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { message: "Document must be 5 MB or smaller." },
      { status: 400 },
    );
  }

  const target = await User.findById(id);
  if (!target) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  const field = DOCUMENT_FIELDS[documentType];
  const previous = target[field] as DocumentMetadata | undefined;
  const bucket = getBucket();
  const fileBytes = Buffer.from(await file.arrayBuffer());
  const contentType = detectAllowedUploadType(fileBytes);
  if (!contentType || !ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json(
      { message: "Only valid PDF, JPEG, and PNG files are allowed." },
      { status: 400 },
    );
  }
  const encrypted = encryptBuffer(fileBytes);
  const upload = bucket.openUploadStream(`${id}-${documentType}`, {
    contentType: "application/octet-stream",
    metadata: { userId: id, documentType, encrypted: true },
  });

  await new Promise<void>((resolve, reject) => {
    upload.once("error", reject);
    upload.once("finish", resolve);
    upload.end(encrypted);
  });

  try {
    target.set(field, {
      fileId: upload.id,
      fileName: file.name,
      contentType,
      size: file.size,
    });
    await target.save();
  } catch (error) {
    await bucket.delete(upload.id).catch(() => undefined);
    throw error;
  }

  if (previous?.fileId) {
    await bucket.delete(previous.fileId).catch(() => undefined);
  }

  return NextResponse.json({
    document: {
      fileName: file.name,
      contentType,
      size: file.size,
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; documentType: string }> },
) {
  const { id, documentType: rawDocumentType } = await params;
  const documentType = getDocumentType(rawDocumentType);
  if (!documentType) {
    return NextResponse.json({ message: "Invalid document type." }, { status: 400 });
  }

  await connectToDatabase();
  const authError = await authorize(id);
  if (authError) return authError;

  const user = await User.findById(id).select(DOCUMENT_FIELDS[documentType]).lean();
  const metadata = user?.[DOCUMENT_FIELDS[documentType]] as DocumentMetadata | undefined;
  if (!metadata?.fileId) {
    return NextResponse.json({ message: "Document not found." }, { status: 404 });
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of getBucket().openDownloadStream(metadata.fileId)) {
      chunks.push(Buffer.from(chunk));
    }
    const decrypted = decryptBuffer(Buffer.concat(chunks));
    return new NextResponse(new Uint8Array(decrypted), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": metadata.contentType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(metadata.fileName)}`,
      },
    });
  } catch {
    return NextResponse.json({ message: "Document could not be read." }, { status: 404 });
  }
}