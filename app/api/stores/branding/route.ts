import { NextRequest, NextResponse } from "next/server";
import { readJsonObject } from "@/lib/request-json";
import Franchise from "@/models/Franchise";
import { connectToDatabase } from "@/lib/mongodb";
import { validateCsrf } from "@/lib/csrf";
import { getAuthorizedStoreAdminId, requireAuth } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit-log";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const franchiseId = new URL(request.url).searchParams.get("franchiseId") ?? "";
  await connectToDatabase();
  if (!(await getAuthorizedStoreAdminId(auth, franchiseId))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  const store = await Franchise.findById(franchiseId).select("name logo").lean();
  if (!store) return NextResponse.json({ message: "Store not found." }, { status: 404 });

  return NextResponse.json({
    store: { name: store.name, hasLogo: Boolean(store.logo?.fileId) },
  });
}

export async function PUT(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const jsonBody = await readJsonObject<{ franchiseId?: string; name?: string }>(request);
  if (jsonBody.response) return jsonBody.response;
  const body = jsonBody.body;
  const franchiseId = body.franchiseId ?? "";
  const name = body.name?.trim() ?? "";
  if (!name || name.length > 100) {
    return NextResponse.json({ message: "Enter a valid store name." }, { status: 400 });
  }

  await connectToDatabase();
  if (!(await getAuthorizedStoreAdminId(auth, franchiseId))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  const store = await Franchise.findOneAndUpdate(
    { _id: franchiseId },
    { $set: { name } },
    { new: true, runValidators: true },
  ).lean();
  if (!store) return NextResponse.json({ message: "Store not found." }, { status: 404 });

  auditLog("store.branding.updated", {
    actorId: auth.id,
    actorRole: auth.role,
    targetId: franchiseId,
    metadata: { name },
  });

  return NextResponse.json({ message: "Store name updated.", store: { name: store.name } });
}
