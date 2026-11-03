import { NextRequest, NextResponse } from "next/server";
import { auditLog } from "@/lib/audit-log";
import { getAuthorizedStoreId, requireAuth } from "@/lib/api-auth";
import { connectToDatabase } from "@/lib/mongodb";
import { validateCsrf } from "@/lib/csrf";
import { readJsonObject } from "@/lib/request-json";
import Franchise from "@/models/Franchise";

const CONFIG_ROLES = new Set(["admin", "sub_admin", "franchise_admin"]);

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!CONFIG_ROLES.has(auth.role))
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const requestedStoreId = new URL(request.url).searchParams.get("franchiseId");
  const storeId = await getAuthorizedStoreId(auth, requestedStoreId);
  if (!storeId)
    return NextResponse.json({ message: "A valid store is required." }, { status: 400 });
  await connectToDatabase();
  const store = await Franchise.findById(storeId).select("paidLeaveEnabled").lean();
  if (!store)
    return NextResponse.json({ message: "Store not found." }, { status: 404 });
  return NextResponse.json({ enabled: store.paidLeaveEnabled === true });
}

export async function PUT(request: NextRequest) {
  const csrf = validateCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!CONFIG_ROLES.has(auth.role))
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const parsed = await readJsonObject<{ franchiseId?: string; enabled?: boolean }>(request);
  if (parsed.response) return parsed.response;
  if (typeof parsed.body.enabled !== "boolean")
    return NextResponse.json({ message: "Choose whether paid leave is enabled." }, { status: 400 });
  const storeId = await getAuthorizedStoreId(auth, parsed.body.franchiseId);
  if (!storeId)
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  await connectToDatabase();
  const store = await Franchise.findById(storeId).select("paidLeaveEnabled");
  if (!store)
    return NextResponse.json({ message: "Store not found." }, { status: 404 });
  store.paidLeaveEnabled = parsed.body.enabled;
  await store.save();
  auditLog("store.paid-leave.updated", {
    actorId: auth.id,
    actorRole: auth.role,
    targetId: String(storeId),
    metadata: { enabled: store.paidLeaveEnabled },
  });
  return NextResponse.json({ message: "Paid leave setting saved.", enabled: store.paidLeaveEnabled });
}
