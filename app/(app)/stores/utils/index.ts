import type { StoreFormErrors, StoreFormState } from "@/types/stores";

export const EMPTY_STORE_FORM: StoreFormState = {
  name: "",
  storeCode: "",
  address: "",
  phone: "",
  description: "",
  ownerName: "",
  ownerPhone: "",
  ownerEmail: "",
  storeType: "franchise",
};

export function validateStoreForm(form: StoreFormState): StoreFormErrors {
  const errors: StoreFormErrors = {};
  if (!form.name.trim()) errors.name = "Store name is required.";
  if (!form.storeCode.trim()) errors.storeCode = "Store code is required.";
  if (form.phone && !/^\d{10}$/.test(form.phone)) errors.phone = "Phone number must be exactly 10 digits.";
  if (form.ownerPhone && !/^\d{10}$/.test(form.ownerPhone)) errors.ownerPhone = "Owner phone number must be exactly 10 digits.";
  if (form.ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail)) {
    errors.ownerEmail = "Enter a valid owner email address.";
  }
  return errors;
}
