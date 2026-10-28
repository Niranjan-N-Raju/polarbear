export type DateRange = {
  from: string;
  to: string;
};

export type StoreType = "company" | "franchise";

export type UserRole = "admin" | "sub_admin" | "franchise_admin" | "employee";

export interface StoreSummary {
  _id: string;
  name: string;
  storeCode?: string;
  isActive?: boolean;
  storeType?: StoreType;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword?: boolean;
}