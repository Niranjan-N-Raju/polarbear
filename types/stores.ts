import type { StoreType } from "./common";

export interface Store {
  _id: string;
  name: string;
  storeCode: string;
  address?: string;
  phone?: string;
  description?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  storeType: StoreType;
  isActive: boolean;
  createdBy?: string;
}

export interface StoreFormState {
  name: string;
  storeCode: string;
  address: string;
  phone: string;
  description: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  storeType: StoreType;
}

export type StoreFormErrors = Partial<Record<keyof StoreFormState, string>>;