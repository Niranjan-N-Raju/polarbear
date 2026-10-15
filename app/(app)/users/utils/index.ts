import type { CurrentUserRole } from "@/types/users";

export function getSubmitLabel(saving: boolean, mode: "add" | "edit"): string {
  if (saving) return "Saving…";
  return mode === "add" ? "Add User" : "Save Changes";
}

export function getUserCountLabel(loading: boolean, count: number): string {
  if (loading) return "Loading…";
  return `${count} ${count === 1 ? "user" : "users"}`;
}

export function getDefaultUserRole(currentUserRole: CurrentUserRole, userRole?: CurrentUserRole): CurrentUserRole {
  if (userRole) return userRole;
  return currentUserRole === "admin" ? "sub_admin" : currentUserRole === "sub_admin" ? "franchise_admin" : "employee";
}
