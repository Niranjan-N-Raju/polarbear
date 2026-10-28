import User from "@/models/User";
import Franchise from "@/models/Franchise";
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

/**
 * Returns the subset of `franchiseIds` the caller may NOT access/assign.
 * admin: unrestricted. sub_admin: stores they created or are assigned to.
 * Other roles: only assigned stores.
 */
export async function getUnauthorizedFranchiseIds(
  auth: AuthInfo,
  franchiseIds: string[],
): Promise<string[]> {
  if (auth.role === "admin" || franchiseIds.length === 0) return [];
  const me = await User.findById(auth.id).select("franchises").lean();
  const assigned = new Set(
    ((me as { franchises?: unknown[] } | null)?.franchises ?? []).map(String),
  );
  const remaining = franchiseIds.filter((id) => !assigned.has(String(id)));
  if (remaining.length === 0 || auth.role !== "sub_admin") return remaining;

  const validIds = remaining.filter((id) => mongoose.isValidObjectId(id));
  if (validIds.length === 0) return remaining;
  const created = await Franchise.find({ _id: { $in: validIds }, createdBy: auth.id })
    .select("_id")
    .lean();
  const createdIds = new Set(created.map((f) => String(f._id)));
  return remaining.filter((id) => !createdIds.has(String(id)));
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
