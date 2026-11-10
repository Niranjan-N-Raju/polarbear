"use client";

import { faPen, faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState, type FormEvent } from "react";
import { FieldError } from "@/app/components/form-validation";
import { useToast } from "@/app/hooks/useToast";
import { inventoryRequest } from "@/app/(app)/inventory/apicall/inventory";
import type { Product } from "@/types/inventory";

export default function RawMaterialsPage() {
  const { success } = useToast();
  const [materials, setMaterials] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Product["unit"]>("each");
  const [materialType, setMaterialType] = useState<Product["materialType"]>("food");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const filteredMaterials = materials.filter((material) =>
    material.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );

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
        if (!response.ok) {
          throw new Error(data.message ?? "Unable to load raw materials.");
        }
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
    setUnit("each");
    setMaterialType("food");
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(material: Product) {
    setEditingId(material._id);
    setName(material.name);
    setUnit(material.unit ?? "each");
    setMaterialType(material.materialType ?? "food");
    setFormError("");
    setFormOpen(true);
  }

  async function saveMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = name.trim();
    if (!value) {
      setFormError("Enter a raw material name.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const response = await inventoryRequest("/api/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId
            ? { productId: editingId, name: value, unit, materialType }
            : { name: value, unit, materialType }
        ),
      });
      const data = (await response.json()) as {
        message?: string;
        products?: Product[];
      };
      if (!response.ok) {
        throw new Error(data.message ?? "Unable to save raw material.");
      }

      if (editingId) {
        setMaterials((current) =>
          current
            .map((material) =>
              material._id === editingId
                ? {
                    ...material,
                    name: value,
                    normalizedName: value.toLowerCase(),
                    unit,
                    materialType,
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
          (editingId ? "Raw material updated." : "Raw material added.")
      );
    } catch (reason) {
      setFormError(
        reason instanceof Error ? reason.message : "Unable to save raw material."
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
            Manage shared materials and their base units.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white hover:bg-brand-orange/90"
        >
          <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
          Add raw material
        </button>
      </header>

      {materials.length > 0 && !loading && !loadError && (
        <label className="block max-w-lg">
          <span className="sr-only">Search raw materials</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search raw materials"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-cyan focus:outline-none focus:ring-1 focus:ring-brand-cyan"
          />
        </label>
      )}

      {loading ? (
        <p className="py-16 text-center text-sm text-gray-500">
          Loading raw materials…
        </p>
      ) : loadError ? (
        <div className="flex items-center justify-between gap-4 py-6 text-sm text-red-700">
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
      ) : filteredMaterials.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">
          No raw materials match your search.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[540px] text-sm">
            <thead>
              <tr className="border-b border-brand-beige bg-brand-sand/50 text-left text-xs font-semibold text-gray-600">
                <th scope="col" className="px-5 py-3.5">Raw material</th>
                <th scope="col" className="px-5 py-3.5">Base unit</th>
                <th scope="col" className="px-5 py-3.5">Material type</th>
                <th scope="col" className="w-24 px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMaterials.map((material) => (
                <tr key={material._id} className="transition-colors hover:bg-brand-sand/30">
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    {material.name}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex min-w-14 items-center justify-center rounded-full bg-brand-cyan/10 px-2.5 py-1 text-xs font-semibold text-brand-teal">
                      {material.unit ?? "each"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {material.materialType === "packing"
                      ? "Packing material"
                      : material.materialType === "none"
                        ? "None"
                        : "Food material"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
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
            if (event.target === event.currentTarget && !saving) {
              setFormOpen(false);
            }
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
                {editingId ? "Edit raw material" : "Add raw material"}
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
              Choose the base unit used to record this material in stock.
            </p>
            <label className="mt-5 block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Raw material name
              </span>
              <input
                autoFocus
                autoComplete="off"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setFormError("");
                }}
                maxLength={100}
                aria-invalid={Boolean(formError)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-cyan focus:outline-none focus:ring-1 focus:ring-brand-cyan"
                placeholder="e.g. Vanilla tub"
              />
            </label>
            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-medium text-gray-700">Base unit</legend>
              <div role="radiogroup" aria-label="Base unit" className="flex flex-wrap gap-2">
                {([
                  ["g", "Grams (g)"],
                  ["ml", "Milliliters (ml)"],
                  ["each", "Count (each)"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={unit === value}
                    disabled={saving}
                    onClick={() => setUnit(value)}
                    className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                      unit === value
                        ? "border-brand-teal bg-brand-teal/10 text-brand-teal"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-medium text-gray-700">Material type</legend>
              <div role="radiogroup" aria-label="Material type" className="flex flex-wrap gap-2">
                {([
                  ["food", "Food material"],
                  ["packing", "Packing material"],
                  ["none", "None"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={materialType === value}
                    disabled={saving}
                    onClick={() => setMaterialType(value)}
                    className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                      materialType === value
                        ? "border-brand-teal bg-brand-teal/10 text-brand-teal"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
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
                {saving ? "Saving…" : editingId ? "Save changes" : "Add raw material"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
