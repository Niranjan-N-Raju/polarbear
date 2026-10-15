import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getAuthInfo } from "@/lib/auth";
import { getAllowedFranchiseIdsForCaller, isGlobalRole } from "@/lib/user-permissions";
import type { AuthInfo } from "@/lib/auth";

export type AuthenticatedRequest = {
  auth: AuthInfo;
};

export type StoreAccess = {
  auth: AuthInfo;
  storeId: string;
};

export type StoreAccessResult = StoreAccess | { response: NextResponse };

export async function requireAuth(): Promise<AuthInfo | NextResponse> {
  const auth = await getAuthInfo();
  return auth ?? NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function getAuthorizedStoreId(
  auth: AuthInfo,
  requestedId: string | null | undefined,
): Promise<string | null> {
  if (!requestedId || !mongoose.isValidObjectId(requestedId)) return null;
  if (isGlobalRole(auth.role)) return requestedId;
  const allowedIds = await getAllowedFranchiseIdsForCaller(auth);
  return allowedIds?.includes(requestedId) ? requestedId : null;
}

export async function getAuthorizedStoreAdminId(
  auth: AuthInfo,
  requestedId: string | null | undefined,
): Promise<string | null> {
  if (auth.role !== "franchise_admin") return null;
  return getAuthorizedStoreId(auth, requestedId);
}

export async function getStoreAccess(
  request: NextRequest,
  parameter = "storeId",
): Promise<StoreAccessResult> {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return { response: authResult };
  if (authResult.role !== "franchise_admin") {
    return { response: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
  }
  const storeId = await getAuthorizedStoreId(
    authResult,
    new URL(request.url).searchParams.get(parameter),
  );
  if (!storeId) return { response: NextResponse.json({ message: "Access denied." }, { status: 403 }) };
  return { auth: authResult, storeId };
}
