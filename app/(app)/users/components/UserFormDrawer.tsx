"use client";

import { useEffect, useRef, useState } from "react";
import { OutlineCloseIcon } from "@/app/components/icons";
import { Checkbox } from "@/app/components/Checkbox";
import { FieldError, fieldClass, focusFirstInvalidField } from "@/app/components/form-validation";
import { useToast } from "@/app/hooks/useToast";
import { useDrawerClose } from "@/app/hooks/useDrawerClose";
import type { CurrentUserRole, UserFormErrors, UserModalProps } from "@/types/users";
import { usersRequest } from "../apicall/users";
import { getDefaultUserRole, getSubmitLabel } from "../utils";

export default function UserFormDrawer({ mode, user, franchises, currentUserRole, onClose, onSaved }: Readonly<UserModalProps>) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CurrentUserRole>(getDefaultUserRole(currentUserRole, user?.role));
  const [selectedFranchises, setSelectedFranchises] = useState<string[]>(user?.role === "employee" ? user.franchises.slice(0, 1).map((f) => f._id) : user?.franchises.map((f) => f._id) ?? []);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<UserFormErrors>({});
  const firstRef = useRef<HTMLInputElement>(null);
  const { error } = useToast();
  const { visible, requestClose } = useDrawerClose();
  const close = () => requestClose(onClose);

  useEffect(() => { firstRef.current?.focus(); }, []);

  function toggleFranchise(id: string) {
    setFieldErrors((current) => ({ ...current, stores: undefined }));
    if (role === "employee") { setSelectedFranchises([id]); return; }
    setSelectedFranchises((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors: UserFormErrors = {};
    if (!name.trim()) validationErrors.name = "Full name is required.";
    if (mode === "add" && role !== "employee") {
      if (!email.trim()) validationErrors.email = "Email address is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) validationErrors.email = "Enter a valid email address.";
      if (!password) validationErrors.password = "Password is required.";
      else if (password.length < 12) validationErrors.password = "Password must be at least 12 characters.";
      else if (!/[A-Z]/.test(password)) validationErrors.password = "Password must contain an uppercase letter.";
      else if (!/[a-z]/.test(password)) validationErrors.password = "Password must contain a lowercase letter.";
      else if (!/\d/.test(password)) validationErrors.password = "Password must contain a number.";
      else if (!/[^A-Za-z0-9]/.test(password)) validationErrors.password = "Password must contain a special character.";
    }
    if (role !== "sub_admin" && role !== "admin" && selectedFranchises.length === 0) validationErrors.stores = "Please assign at least one store.";
    if (Object.keys(validationErrors).length) { setFieldErrors(validationErrors); focusFirstInvalidField("user-form"); return; }
    setFieldErrors({}); setSaving(true);
    try {
      const response = await usersRequest(mode === "add" ? "/api/users" : `/api/users/${user?._id}`, {
        method: mode === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "add" ? { name, email, password, role, franchiseIds: selectedFranchises } : { name, role, franchiseIds: selectedFranchises }),
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) {
        const message = data.message ?? "Something went wrong.";
        const serverErrors: UserFormErrors = {};
        if (/name/i.test(message)) serverErrors.name = message;
        if (/email/i.test(message)) serverErrors.email = message;
        if (/password/i.test(message)) serverErrors.password = message;
        if (/store|franchise/i.test(message)) serverErrors.stores = message;
        if (Object.keys(serverErrors).length) { setFieldErrors(serverErrors); focusFirstInvalidField("user-form"); } else error(message);
        return;
      }
      requestClose(onSaved);
    } catch { error("Network error. Please try again."); } finally { setSaving(false); }
  }

  const roles = currentUserRole === "admin" ? ["sub_admin", "franchise_admin"] as const : currentUserRole === "sub_admin" ? ["franchise_admin"] as const : ["employee"] as const;
  const labels: Record<string, string> = { sub_admin: "Sub Admin", franchise_admin: "Store Admin", employee: "Employee" };
  return <><div className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`} aria-hidden="true" data-unsaved-reset="true" onClick={close} style={{ height: "100vh" }} /><div className="fixed inset-y-0 right-0 z-50 flex max-w-full pointer-events-none">
    <div className={`h-full w-screen max-w-md flex flex-col bg-white shadow-2xl pointer-events-auto transition-transform duration-200 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}>
      <div className="flex items-center justify-between border-b border-brand-beige px-6 py-4"><h2 className="text-lg font-bold text-gray-900">{mode === "add" ? "Add User" : "Edit User"}</h2><button onClick={close} data-unsaved-reset="true" className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-brand-sand"><OutlineCloseIcon className="h-4 w-4" /></button></div>
      <form id="user-form" method="post" onSubmit={handleSubmit} noValidate className="flex-1 space-y-4 overflow-y-auto p-6">
        <div><label htmlFor="um-name" className="mb-1 block text-sm font-medium text-gray-700">Full Name</label><input id="um-name" ref={firstRef} value={name} onChange={(event) => { setName(event.target.value); setFieldErrors((current) => ({ ...current, name: undefined })); }} aria-invalid={Boolean(fieldErrors.name)} className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 ${fieldClass(Boolean(fieldErrors.name), "border-brand-beige focus:border-brand-orange focus:ring-brand-orange/40")}`} /><FieldError id="um-name-error" message={fieldErrors.name} /></div>
        <div><label htmlFor="um-email" className="mb-1 block text-sm font-medium text-gray-700">Email Address</label><input id="um-email" type="email" value={email} disabled={mode === "edit"} onChange={(event) => { setEmail(event.target.value); setFieldErrors((current) => ({ ...current, email: undefined })); }} aria-invalid={Boolean(fieldErrors.email)} className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 disabled:bg-gray-50 disabled:text-gray-400 ${fieldClass(Boolean(fieldErrors.email), "border-brand-beige focus:border-brand-orange focus:ring-brand-orange/40")}`} /><FieldError id="um-email-error" message={fieldErrors.email} /></div>
        {mode === "add" && <div><label htmlFor="um-password" className="mb-1 block text-sm font-medium text-gray-700">Password</label><input id="um-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: undefined })); }} aria-invalid={Boolean(fieldErrors.password)} className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 ${fieldClass(Boolean(fieldErrors.password), "border-brand-beige focus:border-brand-orange focus:ring-brand-orange/40")}`} /><FieldError id="um-password-error" message={fieldErrors.password} /></div>}
        {currentUserRole !== "sub_admin" && <div><p className="mb-1 block text-sm font-medium text-gray-700">Role</p><div className="flex flex-wrap gap-3">{roles.map((option) => <button key={option} type="button" onClick={() => { setRole(option); if (option === "employee") setSelectedFranchises((current) => current.slice(0, 1)); setFieldErrors((current) => ({ ...current, stores: undefined })); }} className={`flex-1 rounded-xl border py-2 text-sm font-medium ${role === option ? "border-brand-orange bg-brand-peach text-brand-orange" : "border-brand-beige bg-white text-gray-600 hover:border-brand-orange"}`}>{labels[option]}</button>)}</div></div>}
        {role !== "sub_admin" && <div aria-invalid={Boolean(fieldErrors.stores)}><p className="mb-2 block text-sm font-medium text-gray-700">{role === "employee" ? "Assign to Store" : "Assign to Stores"}</p>{franchises.length === 0 ? <div className="text-sm text-gray-400">No stores available.</div> : <div className="max-h-40 space-y-2 overflow-y-auto pr-1">{franchises.map((franchise) => { const checked = selectedFranchises.includes(franchise._id); return <label key={franchise._id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${checked ? "border-brand-orange bg-brand-peach" : "border-brand-beige bg-brand-sand/30"}`}><Checkbox type={role === "employee" ? "radio" : "checkbox"} checked={checked} onChange={() => toggleFranchise(franchise._id)} /><span className={`text-sm font-medium ${checked ? "text-brand-orange" : "text-gray-700"}`}>{franchise.name}</span></label>; })}</div>}<FieldError id="um-stores-error" message={fieldErrors.stores} /></div>}
      </form>
      <div className="flex shrink-0 gap-3 border-t border-brand-beige p-6"><button type="button" onClick={close} data-unsaved-reset="true" className="flex-1 rounded-xl border border-brand-beige py-2.5 text-sm font-medium text-gray-600">Cancel</button><button type="submit" form="user-form" disabled={saving} className="flex-1 rounded-xl bg-brand-orange py-2.5 text-sm font-semibold text-white disabled:opacity-60">{getSubmitLabel(saving, mode)}</button></div>
    </div>
  </div></>;
}
