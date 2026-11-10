"use client";

import { faCopy, faPen, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { inventoryRequest } from "@/app/(app)/inventory/apicall/inventory";
import { FieldError } from "@/app/components/form-validation";
import { useToast } from "@/app/hooks/useToast";

interface Category { _id: string; name: string }
interface Material { _id: string; name: string; unit: "g" | "ml" | "each" }
interface Ingredient { productId: string; quantity: number }
interface MenuProduct {
  _id: string;
  name: string;
  categoryId: string;
  dineIn: Ingredient[];
  takeAway: Ingredient[];
}
interface DraftIngredient { key: number; productId: string; quantity: string }
const inputClass = "w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-cyan focus:outline-none focus:ring-1 focus:ring-brand-cyan";
const commandClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50";

function MaterialSelect({ materials, value, excludedIds, label, onChange }: {
  materials: Material[];
  value: string;
  excludedIds: string[];
  label: string;
  onChange: (productId: string) => void;
}) {
  const listId = useId();
  const listRef = useRef<HTMLSpanElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const selected = materials.find((material) => material._id === value);
  const available = materials.filter((material) => !excludedIds.includes(material._id));
  const materialLabel = (material: Material) => `${material.name} (${material.unit})`;
  const options = available.filter((material) => materialLabel(material).toLowerCase().includes((query ?? "").trim().toLowerCase()));

  useEffect(() => {
    const list = listRef.current;
    const option = list?.children[activeIndex] as HTMLElement | undefined;
    if (!list || !option || !open) return;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
  }, [activeIndex, open]);

  function choose(material: Material) {
    onChange(material._id);
    setQuery(null);
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <span className="relative block min-w-0">
      <input
        required
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && options[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        placeholder="Search raw material"
        aria-label={label}
        value={query ?? (selected ? materialLabel(selected) : "")}
        onFocus={(event) => {
          event.currentTarget.select();
          setOpen(true);
          setActiveIndex(-1);
        }}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          const text = event.target.value;
          setQuery(text);
          setOpen(true);
          setActiveIndex(-1);
          const match = available.find((material) => materialLabel(material).toLowerCase() === text.trim().toLowerCase());
          onChange(match?._id ?? "");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            if (options.length) setActiveIndex((current) => event.key === "ArrowDown"
              ? Math.min(current + 1, options.length - 1)
              : current < 0 ? options.length - 1 : Math.max(current - 1, 0));
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            if (options[activeIndex]) choose(options[activeIndex]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
        onBlur={() => { setQuery(null); setOpen(false); setActiveIndex(-1); }}
        className={inputClass}
      />
      {open && (
        <span ref={listRef} id={listId} role="listbox" aria-label={label} className="absolute left-0 top-full z-30 mt-1 block max-h-[min(12rem,40vh)] w-full overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {options.length ? options.map((material, index) => (
            <span
              key={material._id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={material._id === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(material)}
              className={`block cursor-pointer break-words px-3 py-2 text-sm hover:bg-brand-sand ${activeIndex === index ? "bg-brand-sand" : ""}`}
            >{materialLabel(material)}</span>
          )) : <span role="presentation" className="block px-3 py-2 text-sm text-gray-500">No matching materials.</span>}
        </span>
      )}
    </span>
  );
}

async function loadCatalog(path: string) {
  const response = await inventoryRequest(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "Unable to load catalog.");
  return data;
}

export default function ProductsPageView() {
  const { success } = useToast();
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dineIn, setDineIn] = useState<DraftIngredient[]>([]);
  const [takeAway, setTakeAway] = useState<DraftIngredient[]>([]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    Promise.all([loadCatalog("/api/menu-products"), loadCatalog("/api/product-categories"), loadCatalog("/api/products")])
      .then(([menu, categoryData, materialData]) => {
        if (!active) return;
        setProducts(menu.products ?? []);
        setCategories(categoryData.categories ?? []);
        setMaterials(materialData.products ?? []);
      })
      .catch((reason: unknown) => {
        if (active) setLoadError(reason instanceof Error ? reason.message : "Unable to load catalog.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  function openForm(product?: MenuProduct) {
    const draft = (items?: Ingredient[]) => items?.map((item, index) => ({ key: index, productId: item.productId, quantity: String(item.quantity) })) ?? [{ key: 0, productId: "", quantity: "" }];
    setEditingId(product?._id ?? null);
    setName(product?.name ?? "");
    setCategoryId(product?.categoryId ?? "");
    setDineIn(draft(product?.dineIn));
    setTakeAway(draft(product?.takeAway));
    setFormError("");
    setFormOpen(true);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parse = (rows: DraftIngredient[]) => rows.map((row) => ({ productId: row.productId, quantity: Number(row.quantity) }));
    const valid = (rows: Ingredient[]) => rows.length > 0 && rows.length <= 100 &&
      new Set(rows.map((row) => row.productId)).size === rows.length &&
      rows.every((row) => materials.some((material) => material._id === row.productId) && Number.isFinite(row.quantity) && row.quantity > 0);
    const compositions = { dineIn: parse(dineIn), takeAway: parse(takeAway) };
    if (!name.trim() || name.trim().length > 100 || !categories.some((category) => category._id === categoryId) ||
        !valid(compositions.dineIn) || !valid(compositions.takeAway)) {
      setFormError("Choose a category, enter a name, and add unique materials with positive quantities for both order types.");
      return;
    }
    if (products.some((product) => product._id !== editingId && product.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      setFormError("That product name already exists.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await inventoryRequest("/api/menu-products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(editingId ? { productId: editingId } : {}), name: name.trim(), categoryId, ...compositions }),
      });
      const data = await response.json() as { product?: MenuProduct; message?: string };
      if (!response.ok || !data.product) throw new Error(data.message ?? "Unable to save product.");
      const saved = data.product;
      setProducts((current) => [...current.filter((product) => product._id !== saved._id), saved].sort((left, right) => left.name.localeCompare(right.name)));
      setFormOpen(false);
      success(editingId ? "Product updated." : "Product added.");
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Unable to save product.");
    } finally {
      setSaving(false);
    }
  }

  function compositionEditor(mode: "dineIn" | "takeAway") {
    const rows = mode === "dineIn" ? dineIn : takeAway;
    const setRows = mode === "dineIn" ? setDineIn : setTakeAway;
    const title = mode === "dineIn" ? "Dine-in" : "Takeaway";
    const change = (key: number, values: Partial<DraftIngredient>) => {
      setRows((current) => current.map((row) => row.key === key ? { ...row, ...values } : row));
      setFormError("");
    };
    return (
      <fieldset className="min-w-0 space-y-3 border-t border-gray-200 pt-4">
        <legend className="w-full px-0">
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-base font-semibold text-gray-900">{title} composition *</span>
            {mode === "takeAway" && (
              <button type="button" disabled={saving} className={`${commandClass} ml-auto`} onClick={() => { setTakeAway(dineIn.map((row) => ({ ...row }))); setFormError(""); }}>
                <FontAwesomeIcon icon={faCopy} aria-hidden="true" /> Copy dine-in
              </button>
            )}
          </span>
        </legend>
        {rows.map((row, index) => {
          const unit = materials.find((material) => material._id === row.productId)?.unit ?? "";
          return (
            <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_40px] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_120px_40px]">
              <label className="min-w-0">
                <span className="mb-1 block text-xs font-medium text-gray-600">Raw material *</span>
                <MaterialSelect
                  materials={materials}
                  value={row.productId}
                  excludedIds={rows.filter((other) => other.key !== row.key).map((other) => other.productId)}
                  label={`${title} material ${index + 1}`}
                  onChange={(productId) => change(row.key, { productId })}
                />
              </label>
              <label className="col-start-1 row-start-2 min-w-0 sm:col-start-2 sm:row-start-1">
                <span className="mb-1 block text-xs font-medium text-gray-600">Quantity{unit ? ` (${unit})` : ""} *</span>
                <input required type="number" min="0" step="any" value={row.quantity} onChange={(event) => change(row.key, { quantity: event.target.value })} className={inputClass} aria-label={`${title} quantity ${index + 1}`} />
              </label>
              <button type="button" title="Remove material" aria-label={`Remove ${title.toLowerCase()} material ${index + 1}`} disabled={saving || rows.length === 1} onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} className="col-start-2 row-start-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-30 sm:col-start-3 sm:row-start-1">
                <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
              </button>
            </div>
          );
        })}
        <button type="button" disabled={saving || rows.length >= 100} className={commandClass} onClick={() => setRows((current) => [...current, { key: Math.max(-1, ...current.map((row) => row.key)) + 1, productId: "", quantity: "" }])}>
          <FontAwesomeIcon icon={faPlus} aria-hidden="true" /> Add material
        </button>
      </fieldset>
    );
  }

  function summary(items: Ingredient[]) {
    return items.map((item) => {
      const material = materials.find((candidate) => candidate._id === item.productId);
      return `${material?.name ?? "Unavailable material"}: ${item.quantity}${material?.unit ? ` ${material.unit}` : ""}`;
    }).join(", ");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-beige pb-5">
        <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
        {!formOpen && <button type="button" disabled={loading || Boolean(loadError) || !categories.length || !materials.length} onClick={() => openForm()} className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><FontAwesomeIcon icon={faPlus} aria-hidden="true" /> Add product</button>}
      </header>
      {loading ? <p className="py-12 text-center text-sm text-gray-500">Loading products...</p> : loadError ? (
        <div className="flex flex-wrap items-center gap-4 text-sm text-red-700"><span>{loadError}</span><button type="button" className="underline" onClick={() => setReloadKey((value) => value + 1)}>Retry</button></div>
      ) : formOpen ? (
        <form onSubmit={(event) => void saveProduct(event)} className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">{editingId ? "Edit product" : "Add product"}</h2>
          <fieldset disabled={saving} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label><span className="mb-1 block text-sm font-medium text-gray-700">Category *</span><select required autoFocus value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setFormError(""); }} className={inputClass}><option value="">Select category</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
              <label><span className="mb-1 block text-sm font-medium text-gray-700">Product name *</span><input required maxLength={100} autoComplete="off" value={name} onChange={(event) => { setName(event.target.value); setFormError(""); }} className={inputClass} /></label>
            </div>
            <div className="grid items-start gap-6 xl:grid-cols-2">{compositionEditor("dineIn")}{compositionEditor("takeAway")}</div>
          </fieldset>
          <div aria-live="polite"><FieldError message={formError} /></div>
          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button type="button" disabled={saving} onClick={() => setFormOpen(false)} className={commandClass}>Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving..." : "Save product"}</button>
          </div>
        </form>
      ) : !categories.length || !materials.length ? <p className="text-sm text-gray-500">No {categories.length ? "raw materials" : "product categories"} yet.</p> : !products.length ? <p className="py-12 text-center text-sm text-gray-500">No menu products yet.</p> : (
        <div className="overflow-x-auto border-y border-gray-200">
          <table className="w-full min-w-[700px] table-fixed text-sm">
            <thead className="border-b border-gray-200 bg-brand-sand/50 text-left text-xs font-semibold text-gray-600"><tr><th scope="col" className="w-1/5 px-4 py-3">Product</th><th scope="col" className="w-1/6 px-4 py-3">Category</th><th scope="col" className="px-4 py-3">Dine-in</th><th scope="col" className="px-4 py-3">Takeaway</th><th scope="col" className="w-20 px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{products.map((product) => <tr key={product._id} className="align-top hover:bg-brand-sand/30"><td className="break-words px-4 py-4 font-medium text-gray-900">{product.name}</td><td className="break-words px-4 py-4">{categories.find((category) => category._id === product.categoryId)?.name ?? "Unavailable category"}</td><td className="break-words px-4 py-4 text-gray-600">{summary(product.dineIn)}</td><td className="break-words px-4 py-4 text-gray-600">{summary(product.takeAway)}</td><td className="px-4 py-3 text-right"><button type="button" title="Edit product" aria-label={`Edit ${product.name}`} onClick={() => openForm(product)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-brand-teal hover:bg-brand-cyan/10"><FontAwesomeIcon icon={faPen} aria-hidden="true" /></button></td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}