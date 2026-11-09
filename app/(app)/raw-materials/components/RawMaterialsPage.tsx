"use client";

import { faPen, faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState, type FormEvent } from "react";
import { FieldError } from "@/app/components/form-validation";
import { useToast } from "@/app/hooks/useToast";
import { inventoryRequest } from "@/app/(app)/inventory/apicall/inventory";
import type { Product } from "@/types/inventory";

export default function RawMaterialsPage() {
  const { error: showError, success } = useToast();
  const [materials, setMaterials] = useState<Product[]>([]);
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
    inventoryRequest("/api/products")
      .then(async (response) => {
        const data = (await response.json()) as {
          products?: Product[];
          message?: string;
        };
        if (!response.ok)
          throw new Error(data.message ?? "Unable to load raw materials.");
        if (active) setMaterials(data.products ?? []);
      })
      .catch((reason: unknown) => {
        if (active) {
          setLoadError(
            reason instanceof Error
              ? reason.message
              : "Unable to load raw materials."
          );
        }
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

  function openEdit(material: Product) {
    setEditingId(material._id);
    setName(material.name);
    setFormError("");
    setFormOpen(true);
  }

  async function saveMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setFormError("Enter at least one raw material name.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await inventoryRequest("/api/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId ? { productId: editingId, name } : { name }
        ),
      });
      const data = (await response.json()) as {
        message?: string;
        products?: Product[];
      };
      if (!response.ok)
        throw new Error(data.message ?? "Unable to save raw materials.");
      if (editingId) {
        setMaterials((current) =>
          current
            .map((material) =>
              material._id === editingId
                ? {
                    ...material,
                    name: name.trim(),
                    normalizedName: name.trim().toLowerCase(),
                  }
                : material
            )
            .sort((left, right) => left.name.localeCompare(right.name))
        );
      } else {
        setMaterials((current) =>
          [...current, ...(data.products ?? [])].sort((left, right) =>
            left.name.localeCompare(right.name)
          )
        );
      }
      setFormOpen(false);
      success(
        data.message ??
          (editingId ? "Raw material updated." : "Raw materials added.")
      );
    } catch (reason) {
      setFormError(
        reason instanceof Error ? reason.message : "Unable to save raw materials."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-brand-beige pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Raw Materials</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage the shared names used by store inventory.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white hover:bg-brand-orange/90"
        >
          <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
          Add raw materials
        </button>
      </header>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">
          Loading raw materials…
        </div>
      ) : loadError ? (
        <div className="flex items-center justify-between gap-4 border-b border-red-200 py-4 text-sm text-red-700">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="font-medium underline"
          >
            Retry
          </button>
        </div>
      ) : materials.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">
          No raw materials have been added yet.
        </p>
      ) : (
        <div className="overflow-x-auto border-y border-brand-beige">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-beige text-left text-xs font-semibold uppercase text-gray-500">
                <th scope="col" className="px-4 py-3">Raw material</th>
                <th scope="col" className="w-28 px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-beige/70">
              {materials.map((material) => (
                <tr key={material._id}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {material.name}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Edit raw material ${material.name}`}
                      onClick={() => openEdit(material)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-brand-teal hover:bg-brand-cyan/10"
                    >
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving)
              setFormOpen(false);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="raw-material-form-title"
            onSubmit={(event) => void saveMaterial(event)}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id="raw-material-form-title" className="text-lg font-semibold">
                {editingId ? "Edit raw material" : "Add raw materials"}
              </h2>
              <button
                type="button"
                aria-label="Close"
                disabled={saving}
                onClick={() => setFormOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
              >
                <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {editingId
                ? "The updated name will also apply to existing stock records."
                : "Separate multiple raw material names with commas."}
            </p>
            <label className="mt-5 block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Raw material name{editingId ? "" : "s"}
              </span>
              <input
                autoFocus
                autoComplete="off"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setFormError("");
                }}
                maxLength={editingId ? 100 : 1000}
                aria-invalid={Boolean(formError)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-cyan focus:outline-none focus:ring-1 focus:ring-brand-cyan"
                placeholder="e.g. Vanilla tub, Chocolate cone"
              />
            </label>
            <FieldError message={formError} />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setFormOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Add raw materials"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}