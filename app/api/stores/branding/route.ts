import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import Franchise from "@/models/Franchise";
import { getAuthInfo } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { validateCsrf } from "@/lib/csrf";
import { getAllowedFranchiseIdsForCaller } from "@/lib/user-permissions";
import { auditLog } from "@/lib/audit-log";

async function authorizeStore(authId: string, role: string, franchiseId: string) {
  if (role !== "franchise_admin" || !mongoose.isValidObjectId(franchiseId)) return false;
  const allowedIds = await getAllowedFranchiseIdsForCaller({ id: authId, role });
  return allowedIds?.includes(franchiseId) ?? false;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const franchiseId = new URL(request.url).searchParams.get("franchiseId") ?? "";
  await connectToDatabase();
  if (!(await authorizeStore(auth.id, auth.role, franchiseId))) {
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

  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { franchiseId?: string; name?: string };
  const franchiseId = body.franchiseId ?? "";
  const name = body.name?.trim() ?? "";
  if (!name || name.length > 100) {
    return NextResponse.json({ message: "Enter a valid store name." }, { status: 400 });
  }

  await connectToDatabase();
  if (!(await authorizeStore(auth.id, auth.role, franchiseId))) {
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
