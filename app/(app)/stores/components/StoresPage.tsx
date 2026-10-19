"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  StoresIcon,
  MapPinIcon,
  PhoneIcon,
  ArchiveIcon,
  RestoreIcon,
  PencilIcon,
} from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";
import {
  FieldError,
  fieldClass,
  focusFirstInvalidField,
} from "@/app/components/form-validation";
import type { Store, StoreFormErrors, StoreFormState } from "@/types/stores";
import { storesRequest } from "../apicall/stores";
import { EMPTY_STORE_FORM as emptyForm, validateStoreForm } from "../utils";
import { StoreTypeBadge } from "./StoreTypeBadge";
import StoreFormModal from "./StoreFormModal";

export default function StoresPage() {
  const router = useRouter();
  useEffect(() => { document.title = "Store Management · Polar Bear"; }, []);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [form, setForm] = useState<StoreFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<StoreFormErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const suppressEditQueryRef = useRef(false);
  const { error, success } = useToast();

  const openEditForm = useCallback((store: Store) => {
    setEditingStoreId(store._id);
    setFormErrors({});
    setFormError("");
    setForm({
      name: store.name,
      storeCode: store.storeCode,
      address: store.address ?? "",
      phone: store.phone ?? "",
      description: store.description ?? "",
      ownerName: store.ownerName ?? "",
      ownerPhone: store.ownerPhone ?? "",
      ownerEmail: store.ownerEmail ?? "",
      storeType: store.storeType ?? "franchise",
    });
    setShowForm(true);
  }, []);

  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      const [storesRes, meRes] = await Promise.all([
        storesRequest("/api/stores"),
        storesRequest("/api/me"),
      ]);
      const storesData = (await storesRes.json()) as { franchises: Store[] };
      const meData = (await meRes.json()) as { id?: string };
      setStores(storesData.franchises ?? []);
      setCurrentUserId(meRes.ok && meData.id ? meData.id : null);
    } catch {
      error("Failed to load stores.");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadStores();
    });
  }, [loadStores]);

  useEffect(() => {
    if (loading || !currentUserId || suppressEditQueryRef.current) return;

    const editId = new URLSearchParams(window.location.search).get("edit");
    const store = stores.find(
      (candidate) =>
        candidate._id === editId && candidate.createdBy === currentUserId,
    );
    if (store) queueMicrotask(() => openEditForm(store));
  }, [currentUserId, loading, openEditForm, stores]);

  function updateFormField<Key extends keyof StoreFormState>(
    field: Key,
    value: StoreFormState[Key],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError("");
  }

  function updateStoreType(storeType: StoreFormState["storeType"]) {
    setForm((current) => storeType === "company"
      ? { ...current, storeType, ownerName: "", ownerPhone: "", ownerEmail: "" }
      : { ...current, storeType });
    setFormErrors((current) => ({ ...current, storeType: undefined }));
    setFormError("");
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const validationErrors = validateStoreForm(form);
    setFormErrors(validationErrors);
    setFormError("");
    if (Object.keys(validationErrors).length > 0) {
      focusFirstInvalidField("store-form");
      return;
    }

    setSaving(true);
    try {
      const res = await storesRequest(
        editingStoreId
          ? `/api/stores?id=${encodeURIComponent(editingStoreId)}`
          : "/api/stores",
        {
        method: editingStoreId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        },
      );
      const data = (await res.json()) as { message?: string };
      if (res.ok) {
        if (editingStoreId) suppressEditQueryRef.current = true;
        setFormErrors({});
        success(editingStoreId ? "Store updated successfully." : "Store created successfully.");
        setForm(emptyForm);
        setEditingStoreId(null);
        setShowForm(false);
        router.replace("/stores");
        await loadStores();
      } else {
        const message =
          data.message ??
          (editingStoreId ? "Failed to update store." : "Failed to create store.");
        const serverErrors: StoreFormErrors = {};
        if (/store code/i.test(message)) serverErrors.storeCode = message;
        if (/email/i.test(message)) serverErrors.ownerEmail = message;
        if (/phone/i.test(message)) serverErrors.ownerPhone = message;
        setFormErrors(serverErrors);
        if (Object.keys(serverErrors).length > 0) {
          setFormError("");
          focusFirstInvalidField("store-form");
        } else {
          setFormError(message);
          error(message);
        }
      }
    } catch {
      const message = editingStoreId
        ? "Failed to update store. Please try again."
        : "Failed to create store. Please try again.";
      setFormError(message);
      error(message);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(store: Store) {
    suppressEditQueryRef.current = false;
    openEditForm(store);
    router.push(`/stores?edit=${encodeURIComponent(store._id)}`);
  }

  async function handleArchive(store: Store, archived: boolean) {
    if (archived && !window.confirm(`Archive ${store.name}? It can be restored later.`)) {
      return;
    }

    setArchivingId(store._id);
    try {
      const res = await storesRequest(`/api/stores/archive?id=${encodeURIComponent(store._id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const data = (await res.json()) as { message?: string };
      if (res.ok) {
        success(archived ? "Store archived successfully." : "Store restored successfully.");
        await loadStores();
      } else {
        error(data.message ?? (archived ? "Failed to archive store." : "Failed to restore store."));
      }
    } catch {
      error(archived ? "Failed to archive store." : "Failed to restore store.");
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-beige bg-white/80 p-6 shadow-[0_10px_30px_rgba(36,50,58,0.05)]">
        <div>
          <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-brand-teal sm:block">Workspace setup</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">Stores</h2>
          <p className="mt-2 text-sm text-gray-500">
            {stores.length} store{stores.length === 1 ? "" : "s"} registered
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm((s) => !s);
            setEditingStoreId(null);
            setForm(emptyForm);
            setFormErrors({});
            setFormError("");
            suppressEditQueryRef.current = false;
            router.push("/stores");
          }}
          className="bg-brand-orange text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-orange/90 transition"
        >
          {showForm ? "Cancel" : "+ Add Store"}
        </button>
      </div>

      {/* Add/edit store form */}
      {showForm && <StoreFormModal
        form={form}
        formErrors={formErrors}
        formError={formError}
        saving={saving}
        editingStoreId={editingStoreId}
        onChange={updateFormField}
        onStoreTypeChange={updateStoreType}
        onSubmit={handleSubmit}
        onClose={() => {
          setShowForm(false);
          setForm(emptyForm);
          setEditingStoreId(null);
          setFormErrors({});
          setFormError("");
          router.push("/stores");
        }}
      />}
      {false && (
        <form
          id="store-form"
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4"
        >
          {formError && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {formError}
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">
              Store Details
            </h3>

            {/* Store type selector */}
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">
                Store Type <span className="text-red-500">*</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {(["company", "franchise"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setForm((f) =>
                        type === "company"
                          ? {
                              ...f,
                              storeType: type,
                              ownerName: "",
                              ownerPhone: "",
                              ownerEmail: "",
                            }
                          : { ...f, storeType: type },
                      )
                    }
                    className={`inline-flex w-auto py-2 px-3 rounded-lg border text-xs font-medium transition ${
                      form.storeType === type
                        ? "border-brand-orange bg-brand-peach text-brand-orange"
                        : "border-gray-200 bg-white text-gray-600 hover:border-brand-orange hover:bg-brand-peach/40"
                    }`}
                  >
                    {type === "company" ? "Company Store" : "Franchise Store"}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                {form.storeType === "company"
                  ? "Owned and operated by the main company."
                  : "Operated by an external franchisee partner."}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="store-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Store Name <span className="text-red-500">*</span>
              </label>
              <input
                id="store-name"
                type="text"
                required
                value={form.name}
                onChange={(e) => updateFormField("name", e.target.value)}
                aria-invalid={Boolean(formErrors.name)}
                aria-describedby={formErrors.name ? "store-name-error" : undefined}
                placeholder="e.g. ABC — Koramangala"
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 transition ${fieldClass(Boolean(formErrors.name))}`}
              />
              <FieldError id="store-name-error" message={formErrors.name} />
            </div>
            <div>
              <label
                htmlFor="store-code"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Store Code <span className="text-red-500">*</span>
              </label>
              <input
                id="store-code"
                type="text"
                required
                value={form.storeCode}
                onChange={(e) =>
                  updateFormField("storeCode", e.target.value.toUpperCase())
                }
                aria-invalid={Boolean(formErrors.storeCode)}
                aria-describedby={formErrors.storeCode ? "store-code-error" : undefined}
                placeholder="e.g. ABC-KOR-001"
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 uppercase focus:outline-none focus:ring-1 transition ${fieldClass(Boolean(formErrors.storeCode))}`}
              />
              <FieldError id="store-code-error" message={formErrors.storeCode} />
              <p className="mt-1 text-xs text-gray-400">
                Unique identifier (auto-uppercased)
              </p>
            </div>
            <div>
              <label
                htmlFor="store-phone"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Phone
              </label>
              <input
                id="store-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={form.phone}
                onChange={(e) =>
                  updateFormField(
                    "phone",
                    e.target.value.replace(/\D/g, "").slice(0, 10),
                  )
                }
                aria-invalid={Boolean(formErrors.phone)}
                aria-describedby={formErrors.phone ? "store-phone-error" : undefined}
                placeholder="9876543210"
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 transition ${fieldClass(Boolean(formErrors.phone))}`}
              />
              <FieldError id="store-phone-error" message={formErrors.phone} />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="store-address"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Address
              </label>
              <input
                id="store-address"
                type="text"
                value={form.address}
                onChange={(e) => updateFormField("address", e.target.value)}
                aria-invalid={Boolean(formErrors.address)}
                aria-describedby={formErrors.address ? "store-address-error" : undefined}
                placeholder="Street, City, State"
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 transition ${fieldClass(Boolean(formErrors.address))}`}
              />
              <FieldError id="store-address-error" message={formErrors.address} />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="store-description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Description
              </label>
              <textarea
                id="store-description"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  updateFormField("description", e.target.value)
                }
                aria-invalid={Boolean(formErrors.description)}
                aria-describedby={formErrors.description ? "store-description-error" : undefined}
                placeholder="Optional notes about this store"
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 transition resize-none ${fieldClass(Boolean(formErrors.description))}`}
              />
              <FieldError id="store-description-error" message={formErrors.description} />
            </div>
            </div>
          </div>
          {form.storeType === "franchise" && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900">
                  Franchise Owner Details
                </h4>
                <p className="mt-1 text-xs text-gray-500">
                  Add the contact details for the franchise owner.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="owner-name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Owner Name
                  </label>
                  <input
                    id="owner-name"
                    type="text"
                    value={form.ownerName}
                    onChange={(e) =>
                      updateFormField("ownerName", e.target.value)
                    }
                    aria-invalid={Boolean(formErrors.ownerName)}
                    aria-describedby={formErrors.ownerName ? "owner-name-error" : undefined}
                    placeholder="Franchise owner name"
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 transition ${fieldClass(Boolean(formErrors.ownerName))}`}
                  />
                  <FieldError id="owner-name-error" message={formErrors.ownerName} />
                </div>
                <div>
                  <label
                    htmlFor="owner-phone"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Owner Phone
                  </label>
                  <input
                    id="owner-phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={form.ownerPhone}
                    onChange={(e) =>
                      updateFormField(
                        "ownerPhone",
                        e.target.value.replace(/\D/g, "").slice(0, 10),
                      )
                    }
                    aria-invalid={Boolean(formErrors.ownerPhone)}
                    aria-describedby={formErrors.ownerPhone ? "owner-phone-error" : undefined}
                    placeholder="9876543210"
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 transition ${fieldClass(Boolean(formErrors.ownerPhone))}`}
                  />
                  <FieldError id="owner-phone-error" message={formErrors.ownerPhone} />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="owner-email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Owner Email
                  </label>
                  <input
                    id="owner-email"
                    type="email"
                    value={form.ownerEmail}
                    onChange={(e) =>
                      updateFormField("ownerEmail", e.target.value)
                    }
                    aria-invalid={Boolean(formErrors.ownerEmail)}
                    aria-describedby={formErrors.ownerEmail ? "owner-email-error" : undefined}
                    placeholder="owner@example.com"
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 transition ${fieldClass(Boolean(formErrors.ownerEmail))}`}
                  />
                  <FieldError id="owner-email-error" message={formErrors.ownerEmail} />
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
                setEditingStoreId(null);
                setFormErrors({});
                setFormError("");
                router.push("/stores");
              }}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-brand-orange text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-brand-orange/90 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {saving ? "Saving…" : editingStoreId ? "Save Changes" : "Create Store"}
            </button>
          </div>
        </form>
      )}

      {/* Store list */}
      {!showForm && (
        <>
          {loading && <p className="text-sm text-gray-500">Loading…</p>}
          {!loading && stores.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <p className="text-gray-500 text-sm">
                No stores yet. Add your first store above.
              </p>
            </div>
          )}
          {!loading && stores.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stores.map((store) => (
            <div
              key={store._id}
              className="bg-white rounded-xl border border-gray-200 p-5 space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-peach">
                  <StoresIcon className="w-5 h-5 text-brand-orange" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 truncate">
                      {store.name}
                    </p>
                    {store.storeCode && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-gray-100 text-gray-600 border border-gray-200">
                        {store.storeCode}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StoreTypeBadge
                      storeType={store.storeType ?? "franchise"}
                    />
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        store.isActive && !store.archivedAt
                          ? "bg-[#E8E4D7] text-brand-teal"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {store.archivedAt ? "Archived" : store.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
              {store.description && (
                <p className="text-sm text-gray-500">{store.description}</p>
              )}
              <div className="space-y-1 text-xs text-gray-500">
                {store.address && (
                  <p className="flex items-center gap-1.5">
                    <MapPinIcon className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    {store.address}
                  </p>
                )}
                {store.phone && (
                  <p className="flex items-center gap-1.5">
                    <PhoneIcon className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    {store.phone}
                  </p>
                )}
              </div>
              {currentUserId && store.createdBy === currentUserId && (
                <div className="flex justify-end gap-3 border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() => handleEdit(store)}
                    disabled={archivingId === store._id || saving}
                    className="cursor-pointer text-xs font-medium text-brand-teal transition hover:text-brand-sky disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <PencilIcon className="mr-1 inline-block h-3.5 w-3.5 text-brand-teal" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleArchive(store, !store.archivedAt)}
                    disabled={archivingId === store._id}
                    className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-brand-orange transition hover:text-brand-orange/90 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`${store.archivedAt ? "Restore" : "Archive"} ${store.name}`}
                  >
                    {store.archivedAt
                      ? <RestoreIcon className="h-3.5 w-3.5" />
                      : <ArchiveIcon className="h-3.5 w-3.5" />}
                    {archivingId === store._id ? "Saving..." : store.archivedAt ? "Restore" : "Archive"}
                  </button>
                </div>
              )}
            </div>
          ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
