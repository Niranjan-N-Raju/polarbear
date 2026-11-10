"use client";

import { faPen, faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState, type FormEvent } from "react";
import { FieldError } from "@/app/components/form-validation";
import { useToast } from "@/app/hooks/useToast";
import { inventoryRequest } from "@/app/(app)/inventory/apicall/inventory";

interface ProductCategory {
  _id: string;
  name: string;
  normalizedName: string;
  createdAt?: string;
}

export default function ProductCategoriesPageView() {
  const { success } = useToast();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    inventoryRequest("/api/product-categories")
      .then(async (response) => {
        const data = (await response.json()) as {
          categories?: ProductCategory[];
          message?: string;
        };
        if (!response.ok)
          throw new Error(data.message ?? "Unable to load categories.");
        if (active) setCategories(data.categories ?? []);
      })
      .catch((reason: unknown) => {
        if (active)
          setLoadError(
            reason instanceof Error ? reason.message : "Unable to load categories."
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  function openCreate() {
    setEditingId(null);
    setName("");
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(category: ProductCategory) {
    setEditingId(category._id);
    setName(category.name);
    setFormError("");
    setFormOpen(true);
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const categoryName = name.trim();
    if (!categoryName || categoryName.length > 100) {
      setFormError("Enter a category name of 1 to 100 characters.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await inventoryRequest("/api/product-categories", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { categoryId: editingId } : {}),
          name: categoryName,
        }),
      });
      const data = (await response.json()) as {
        category?: ProductCategory;
        message?: string;
      };
      if (!response.ok)
        throw new Error(data.message ?? "Unable to save category.");
      if (data.category) {
        setCategories((current) =>
          [...current.filter((item) => item._id !== data.category!._id), data.category!]
            .sort((left, right) => left.name.localeCompare(right.name))
        );
      } else {
        setReloadKey((value) => value + 1);
      }
      setFormOpen(false);
      success(data.message ?? (editingId ? "Category updated." : "Category added."));
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Unable to save category.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-brand-beige pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Product Categories</h1>
          <p className="mt-1 text-sm text-gray-500">Organize products into unique categories.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white hover:bg-brand-orange/90"
        >
          <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
          Add category
        </button>
      </header>

      {loading ? (
        <p className="py-16 text-center text-sm text-gray-500">Loading categories…</p>
      ) : loadError ? (
        <div className="flex items-center justify-between gap-4 py-6 text-sm text-red-700">
          <span>{loadError}</span>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="font-medium underline">Retry</button>
        </div>
      ) : categories.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">No product categories yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="border-b border-brand-beige bg-brand-sand/50 text-left text-xs font-semibold text-gray-600">
                <th scope="col" className="px-5 py-3.5">Category</th>
                <th scope="col" className="w-24 px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((category) => (
                <tr key={category._id} className="transition-colors hover:bg-brand-sand/30">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{category.name}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button type="button" aria-label={`Edit category ${category.name}`} onClick={() => openEdit(category)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-brand-teal hover:bg-brand-cyan/10">
                      <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form role="dialog" aria-modal="true" aria-labelledby="category-form-title" onSubmit={(event) => void saveCategory(event)} className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <h2 id="category-form-title" className="text-lg font-semibold text-gray-900">
                {editingId ? "Edit category" : "Add category"}
              </h2>
              <button type="button" aria-label="Close" disabled={saving} onClick={() => setFormOpen(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100">
                <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
              </button>
            </div>
            <label className="mt-5 block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Category name</span>
              <input autoFocus autoComplete="off" value={name} onChange={(event) => { setName(event.target.value); setFormError(""); }} maxLength={100} aria-invalid={Boolean(formError)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-cyan focus:outline-none focus:ring-1 focus:ring-brand-cyan" />
            </label>
            <FieldError message={formError} />
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={saving} onClick={() => setFormOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? "Saving…" : "Save category"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}