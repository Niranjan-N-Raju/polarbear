import mongoose from "mongoose";
import type { AuthInfo } from "@/lib/auth";
import { getAllowedFranchiseIdsForCaller } from "@/lib/user-permissions";

export async function canAccessInventoryStore(auth: AuthInfo, storeId: string) {
  if (auth.role !== "franchise_admin" || !mongoose.isValidObjectId(storeId)) return false;
  const allowed = await getAllowedFranchiseIdsForCaller(auth);
  return allowed?.includes(storeId) ?? false;
}
