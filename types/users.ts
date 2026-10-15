import type { UserRole } from "./common";

export interface FranchiseMini {
  _id: string;
  name: string;
}

export interface UserRow {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  franchises: FranchiseMini[];
  createdAt: string;
}

export type CurrentUserRole = UserRole;

export interface UserModalProps {
  mode: "add" | "edit";
  user?: UserRow;
  franchises: FranchiseMini[];
  currentUserRole: CurrentUserRole;
  onClose: () => void;
  onSaved: () => void;
}

export interface UserFormErrors {
  name?: string;
  email?: string;
  password?: string;
  stores?: string;
}
