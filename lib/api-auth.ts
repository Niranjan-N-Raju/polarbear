import { NextRequest, NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/auth";
import {
  getAllowedFranchiseIdsForCaller,
  getUnauthorizedFranchiseIds,
} from "@/lib/user-permissions";
import { PASSWORD_CHANGE_REQUIRED_CODE } from "@/lib/session-token";
import type { AuthInfo } from "@/lib/auth";

export type AuthenticatedRequest = {
  auth: AuthInfo;
};

export type StoreAccess = {
  auth: AuthInfo;
  storeId: string;
};

export type StoreAccessResult = StoreAccess | { response: NextResponse };

export function passwordChangeRequiredResponse(): NextResponse {
  return NextResponse.json(
    {
      message: "You must change your password before continuing.",
      code: PASSWORD_CHANGE_REQUIRED_CODE,
    },
    { status: 403 },
  );
}

/**
 * Authenticates the caller. Accounts flagged with mustChangePassword get 403
 * PASSWORD_CHANGE_REQUIRED (only /api/me, logout and extend bypass this check).
 */
export async function requireAuth(): Promise<AuthInfo | NextResponse> {
  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (auth.mustChangePassword) return passwordChangeRequiredResponse();
  return auth;
}

/**
 * admin: any store. sub_admin: stores they created or are assigned to.
 * Other roles: assigned stores only.
 */
export async function getAuthorizedStoreId(
  auth: AuthInfo,
  requestedId: string | null | undefined,
): Promise<string | null> {
  if (typeof requestedId !== "string" || !/^[a-f\d]{24}$/i.test(requestedId)) return null;
  if (auth.role === "admin") return requestedId;
  if (auth.role === "sub_admin") {
    const denied = await getUnauthorizedFranchiseIds(auth, [requestedId]);
    return denied.length === 0 ? requestedId : null;
  }
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
