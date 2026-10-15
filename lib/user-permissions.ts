import User from "@/models/User";
import type { AuthInfo } from "@/lib/auth";
import mongoose from "mongoose";

export const USER_MANAGEMENT_CALLERS = new Set([
  "admin",
  "sub_admin",
  "franchise_admin",
]);

export function isGlobalRole(role: string): boolean {
  return role === "admin" || role === "sub_admin";
}

export function getAllowedAssignableRoles(callerRole: string): string[] {
  if (callerRole === "admin") {
    return ["sub_admin", "franchise_admin", "employee"];
  }
  if (callerRole === "sub_admin") return ["franchise_admin", "employee"];
  if (callerRole === "franchise_admin") return ["employee"];
  return [];
}

export async function getAllowedFranchiseIdsForCaller(
  auth: AuthInfo,
): Promise<string[] | null> {
  if (isGlobalRole(auth.role)) return null;

  const me = await User.findById(auth.id).select("franchises").lean();
  if (!me) return [];

  return ((me as { franchises?: unknown[] }).franchises ?? []).map(String);
}

export async function getTargetUserRole(
  userId: string,
): Promise<string | null> {
  const target = await User.findById(userId).select("role").lean();
  if (!target) return null;
  return (target as { role?: string }).role ?? null;
}

export async function canManageTargetUser(
  auth: AuthInfo,
  targetId: string,
): Promise<boolean> {
  if (auth.role === "admin") return true;

  const target = await User.findById(targetId)
    .select("role franchises createdBy")
    .lean();
  if (!target) return false;

  const targetRole = (target as { role?: string }).role ?? "";

  if (auth.role === "franchise_admin") {
    if (targetRole !== "employee") return false;
    const allowedIds = await getAllowedFranchiseIdsForCaller(auth);
    const targetFranchises = (
      (target as { franchises?: unknown[] }).franchises ?? []
    ).map(String);
    return targetFranchises.some((fid) => (allowedIds ?? []).includes(fid));
  }

  // For non-admin callers, only allow managing users they created.
  const createdBy = (target as { createdBy?: unknown }).createdBy;
  let createdById: string | null = null;
  if (createdBy instanceof mongoose.Types.ObjectId) {
    createdById = createdBy.toHexString();
  } else if (
    typeof createdBy === "string" &&
    mongoose.isValidObjectId(createdBy)
  ) {
    createdById = new mongoose.Types.ObjectId(createdBy).toHexString();
  }
  if (!createdById || createdById !== auth.id) return false;

  if (auth.role === "sub_admin") {
    return targetRole === "franchise_admin" || targetRole === "employee";
  }
  return false;
}
