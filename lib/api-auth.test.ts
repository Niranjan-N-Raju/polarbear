import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthInfo: vi.fn() }));
vi.mock("@/lib/user-permissions", () => ({
  getAllowedFranchiseIdsForCaller: vi.fn(),
  isGlobalRole: (role: string) => role === "admin" || role === "sub_admin",
}));

import { getAuthorizedStoreAdminId } from "@/lib/api-auth";
import { getAllowedFranchiseIdsForCaller } from "@/lib/user-permissions";

const storeId = "507f1f77bcf86cd799439011";
const auth = { id: "507f191e810c19729de860ea", role: "franchise_admin" };
const allowedIds = vi.mocked(getAllowedFranchiseIdsForCaller);

describe("getAuthorizedStoreAdminId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("allows only an assigned store and preserves the requested id", async () => {
    allowedIds.mockResolvedValue([storeId]);
    await expect(getAuthorizedStoreAdminId(auth, storeId)).resolves.toBe(storeId);
    expect(allowedIds).toHaveBeenCalledExactlyOnceWith(auth);
  });

  it.each(["admin", "sub_admin", "employee", "unknown"])("denies %s without a lookup", async (role) => {
    await expect(getAuthorizedStoreAdminId({ ...auth, role }, storeId)).resolves.toBeNull();
    expect(allowedIds).not.toHaveBeenCalled();
  });

  it.each([null, undefined, "", "invalid-id"])("denies invalid store %s without a lookup", async (requestedId) => {
    await expect(getAuthorizedStoreAdminId(auth, requestedId)).resolves.toBeNull();
    expect(allowedIds).not.toHaveBeenCalled();
  });

  it.each([[], ["507f1f77bcf86cd799439012"], null])("denies an unassigned store for %s", async (assigned) => {
    allowedIds.mockResolvedValue(assigned);
    await expect(getAuthorizedStoreAdminId(auth, storeId)).resolves.toBeNull();
  });

  it("preserves permission lookup failures", async () => {
    const failure = new Error("lookup failed");
    allowedIds.mockRejectedValue(failure);
    await expect(getAuthorizedStoreAdminId(auth, storeId)).rejects.toBe(failure);
  });
});