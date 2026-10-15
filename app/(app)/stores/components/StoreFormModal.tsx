"use client";

import { FieldError, fieldClass } from "@/app/components/form-validation";
import type { StoreFormErrors, StoreFormState } from "@/types/stores";

type StoreFormModalProps = {
  form: StoreFormState;
  formErrors: StoreFormErrors;
  formError: string;
  saving: boolean;
  editingStoreId: string | null;
  onChange: <Key extends keyof StoreFormState>(field: Key, value: StoreFormState[Key]) => void;
  onStoreTypeChange: (storeType: StoreFormState["storeType"]) => void;
  onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export default function StoreFormModal({ form, formErrors, formError, saving, editingStoreId, onChange, onStoreTypeChange, onSubmit, onClose }: Readonly<StoreFormModalProps>) {
  const input = (id: string, label: string, value: string, field: keyof StoreFormState, options: React.InputHTMLAttributes<HTMLInputElement> = {}) => <div className={field === "address" || field === "description" || field === "ownerEmail" ? "sm:col-span-2" : undefined}><label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">{label}</label><input id={id} value={value} onChange={(event) => onChange(field, event.target.value as StoreFormState[typeof field])} aria-invalid={Boolean(formErrors[field])} className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 ${fieldClass(Boolean(formErrors[field]))}`} {...options} /><FieldError id={`${id}-error`} message={formErrors[field]} /></div>;
  return <form id="store-form" method="post" onSubmit={onSubmit} noValidate className="space-y-4">
    {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{formError}</div>}
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6"><h3 className="font-semibold text-gray-900">Store Details</h3>
      <div><p className="mb-2 block text-sm font-medium text-gray-700">Store Type <span className="text-red-500">*</span></p><div className="flex flex-wrap gap-2">{(["company", "franchise"] as const).map((type) => <button key={type} type="button" onClick={() => onStoreTypeChange(type)} className={`rounded-lg border px-3 py-2 text-xs font-medium ${form.storeType === type ? "border-brand-orange bg-brand-peach text-brand-orange" : "border-gray-200 bg-white text-gray-600 hover:border-brand-orange"}`}>{type === "company" ? "Company Store" : "Franchise Store"}</button>)}</div><p className="mt-1.5 text-xs text-gray-400">{form.storeType === "company" ? "Owned and operated by the main company." : "Operated by an external franchisee partner."}</p></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {input("store-name", "Store Name", form.name, "name", { required: true, placeholder: "e.g. ABC - Koramangala" })}
        {input("store-code", "Store Code", form.storeCode, "storeCode", { required: true, placeholder: "e.g. ABC-KOR-001", onChange: (event) => onChange("storeCode", event.target.value.toUpperCase()) })}
        {input("store-phone", "Phone", form.phone, "phone", { type: "tel", inputMode: "numeric", maxLength: 10, onChange: (event) => onChange("phone", event.target.value.replace(/\D/g, "").slice(0, 10)) })}
        {input("store-address", "Address", form.address, "address", { placeholder: "Street, City, State" })}
        <div className="sm:col-span-2"><label htmlFor="store-description" className="mb-1 block text-sm font-medium text-gray-700">Description</label><textarea id="store-description" rows={2} value={form.description} onChange={(event) => onChange("description", event.target.value)} className={`w-full resize-none rounded-lg border px-4 py-2.5 text-sm text-gray-900 ${fieldClass(Boolean(formErrors.description))}`} /><FieldError id="store-description-error" message={formErrors.description} /></div>
      </div>
    </div>
    {form.storeType === "franchise" && <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6"><div><h4 className="font-semibold text-gray-900">Franchise Owner Details</h4><p className="mt-1 text-xs text-gray-500">Add the contact details for the franchise owner.</p></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{input("owner-name", "Owner Name", form.ownerName, "ownerName", { placeholder: "Franchise owner name" })}{input("owner-phone", "Owner Phone", form.ownerPhone, "ownerPhone", { type: "tel", inputMode: "numeric", maxLength: 10, onChange: (event) => onChange("ownerPhone", event.target.value.replace(/\D/g, "").slice(0, 10)) })}{input("owner-email", "Owner Email", form.ownerEmail, "ownerEmail", { type: "email", placeholder: "owner@example.com" })}</div></div>}
    <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-brand-orange px-5 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? "Saving..." : editingStoreId ? "Save Changes" : "Create Store"}</button></div>
  </form>;
}
