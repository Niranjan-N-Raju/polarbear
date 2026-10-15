"use client";

import {
  faClock,
  faHourglassHalf,
  faThumbsUp,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStoreModal } from "@/app/(app)/store-context";
import { useToast } from "@/app/hooks/useToast";
import { SummaryCard } from "@/app/components/SummaryCard";
import { MobileSummaryDrawer } from "@/app/components/MobileSummaryDrawer";
import { daysUntil, formatInventoryDate, formatInventoryQuantity } from "@/lib/inventory/view";
import type { InventoryFilter, InventoryItem, Product } from "@/types/inventory";
import { inventoryRequest } from "../apicall/inventory";
import InventoryCard from "./InventoryCard";
import InventoryRow from "./InventoryRow";
import ProductDrawer from "./ProductDrawer";
import ConfirmModal from "./ConfirmModal";
import StockDrawer from "./StockDrawer";

export default function InventoryPage() {
  const { activeStoreId } = useStoreModal();
  useEffect(() => { document.title = "Inventory · Polar Bear"; }, []);
  const { error, success } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [productModal, setProductModal] = useState(false);
  const [stockModal, setStockModal] = useState(false);
  const [productName, setProductName] = useState("");
  const [productError, setProductError] = useState("");
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const [highlightedProduct, setHighlightedProduct] = useState(0);
  const [expiryDate, setExpiryDate] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockError, setStockError] = useState("");
  const [busy, setBusy] = useState<boolean | string>(false);
  const [useItem, setUseItem] = useState<InventoryItem | null>(null);
  const [useQuantity, setUseQuantity] = useState("2");
  const [dumpItem, setDumpItem] = useState<InventoryItem | null>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!activeStoreId) { setProducts([]); setItems([]); setLoading(false); return; }
    setLoading(true);
    try {
          const [productResponse, inventoryResponse] = await Promise.all([
            inventoryRequest(`/api/products?storeId=${encodeURIComponent(activeStoreId)}`),
        inventoryRequest(`/api/inventory?storeId=${encodeURIComponent(activeStoreId)}`),
      ]);
      const productData = await productResponse.json() as { products?: Product[]; message?: string };
      const inventoryData = await inventoryResponse.json() as { items?: InventoryItem[]; message?: string };
      if (!productResponse.ok) throw new Error(productData.message ?? "Failed to load products.");
      if (!inventoryResponse.ok) throw new Error(inventoryData.message ?? "Failed to load inventory.");
      setProducts(productData.products ?? []);
      setItems(inventoryData.items ?? []);
    } catch (loadError) { error(loadError instanceof Error ? loadError.message : "Failed to load inventory."); }
    finally { setLoading(false); }
  }, [activeStoreId, error]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const filteredProducts = useMemo(() => products.filter((product) => product.name.toLowerCase().includes(productQuery.trim().toLowerCase())), [products, productQuery]);
  const visibleItems = useMemo(() => items.filter((item) => {
    const days = daysUntil(item.expiryDate);
    const matchesFilter = filter === "all" || (filter === "expired" && days < 0) || (filter === "one_day" && days >= 0 && days <= 1) || (filter === "urgent" && days >= 0 && days <= 30) || (filter === "healthy" && days > 30);
    return matchesFilter && item.product.toLowerCase().includes(search.trim().toLowerCase());
  }), [filter, items, search]);
  const expiredCount = items.filter((item) => daysUntil(item.expiryDate) < 0).length;
  const oneDayCount = items.filter((item) => {
    const days = daysUntil(item.expiryDate);
    return days >= 0 && days <= 1;
  }).length;
  const sevenDayCount = items.filter((item) => daysUntil(item.expiryDate) >= 0 && daysUntil(item.expiryDate) <= 7).length;
  const thirtyDayCount = items.filter((item) => daysUntil(item.expiryDate) >= 0 && daysUntil(item.expiryDate) <= 30).length;

  async function addProduct(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productName.trim() || !activeStoreId) { setProductError("Enter at least one product name."); return; }
    setBusy(true);
    try {
      const response = await inventoryRequest(`/api/products?storeId=${encodeURIComponent(activeStoreId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: productName }) });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to add product.");
      setProductName(""); setProductError(""); success("Product(s) added successfully."); await load();
    } catch (saveError) { setProductError(saveError instanceof Error ? saveError.message : "Failed to add product."); }
    finally { setBusy(false); }
  }
  async function saveProduct(productId: string) {
    if (!activeStoreId || !editingName.trim()) return;
    setBusy(true);
    try {
      const response = await inventoryRequest(`/api/products?storeId=${encodeURIComponent(activeStoreId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, name: editingName }) });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to update product.");
      setEditingProduct(null); success("Product updated successfully."); await load();
    } catch (saveError) { error(saveError instanceof Error ? saveError.message : "Failed to update product."); }
    finally { setBusy(false); }
  }
  async function deleteProduct(product: Product) {
    if (!activeStoreId || !window.confirm(`Delete "${product.name}" from the shared product catalog? This affects every store.`)) return;
    setBusy(product._id);
    try {
      const response = await inventoryRequest(`/api/products?storeId=${encodeURIComponent(activeStoreId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product._id }),
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to delete product.");
      if (editingProduct === product._id) setEditingProduct(null);
      success(data.message ?? "Product deleted.");
      await load();
    } catch (deleteError) {
      error(deleteError instanceof Error ? deleteError.message : "Failed to delete product.");
    } finally {
      setBusy(false);
    }
  }
  async function receiveStock(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeStoreId || !stockProduct || !expiryDate || !/^\d+$/.test(stockQuantity) || Number(stockQuantity) < 1) { setStockError("Choose a product, expiry date, and positive quantity."); return; }
    setBusy(true);
    try {
      const response = await inventoryRequest(`/api/inventory?storeId=${encodeURIComponent(activeStoreId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: stockProduct._id, expiryDate, quantity: Number(stockQuantity) }) });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to receive stock.");
      setStockModal(false); setStockError(""); setStockProduct(null); setProductQuery(""); setExpiryDate(""); setStockQuantity(""); success("Stock received successfully."); await load();
    } catch (saveError) { setStockError(saveError instanceof Error ? saveError.message : "Failed to receive stock."); }
    finally { setBusy(false); }
  }
  async function updateStock(action: "consume" | "dump", item: InventoryItem, quantity?: number) {
    setBusy(true);
    setBusy(item._id);
    try {
      const response = await inventoryRequest(`/api/inventory?storeId=${encodeURIComponent(activeStoreId ?? "")}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, inventoryItemId: item._id, quantity }) });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Inventory update failed.");
      setUseItem(null); setDumpItem(null); success(data.message ?? "Inventory updated."); await load();
    } catch (updateError) { error(updateError instanceof Error ? updateError.message : "Inventory update failed."); }
    finally { setBusy(false); }
  }
  function productKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); setHighlightedProduct((value) => Math.min(value + 1, filteredProducts.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setHighlightedProduct((value) => Math.max(value - 1, 0)); }
    if (event.key === "Enter" && filteredProducts[highlightedProduct]) { event.preventDefault(); setStockProduct(filteredProducts[highlightedProduct]); setProductQuery(filteredProducts[highlightedProduct].name); setProductMenuOpen(false); }
    if (event.key === "Escape") { setProductMenuOpen(false); setProductQuery(stockProduct?.name ?? ""); }
  }

  return <div className="inventory-page space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-brand-beige bg-white/80 p-6 shadow-[0_10px_30px_rgba(36,50,58,0.05)]">
      <div>
        <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange sm:block">Stock control</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">Inventory</h2>
        <p className="mt-2 text-sm text-gray-500">FEFO stock visibility and expiry control</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <button type="button" onClick={() => setProductModal(true)} className="rounded-lg border border-brand-cyan px-4 py-2 text-sm font-medium text-brand-cyan hover:bg-brand-cyan/10">Products</button>
        <button type="button" onClick={() => { setStockModal(true); setTimeout(() => productInputRef.current?.focus(), 50); }} className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white hover:bg-brand-orange/90">Add / Update Stock</button>
      </div>
    </div>
    <div className="hidden gap-3 sm:grid sm:grid-cols-4">
      {[
        { label: "Expired items", value: expiredCount, color: "orange" as const, icon: faTriangleExclamation, filter: "expired" as const, subtitle: "Needs disposal" },
        { label: "Expires in 1 day", value: oneDayCount, color: "teal" as const, icon: faClock, filter: "one_day" as const, subtitle: "Immediate action" },
        { label: "Use within 7 days", value: sevenDayCount, color: "teal" as const, icon: faHourglassHalf, filter: "urgent" as const, subtitle: "Highest priority" },
        { label: "Expiring in 30 days", value: thirtyDayCount, color: "orange" as const, icon: faThumbsUp, filter: "urgent" as const, subtitle: "Units at risk" },
      ].map((card) => (
        <SummaryCard
          key={card.label}
          label={card.label}
          value={card.value}
          color={card.color}
          icon={card.icon}
          subtitle={card.subtitle}
          onClick={() => setFilter(card.filter)}
          highlight={card.label === "Expires in 1 day" && card.value > 0}
        />
      ))}
    </div>
    <MobileSummaryDrawer
      cards={[
        { label: "Expired items", value: expiredCount, color: "orange", icon: faTriangleExclamation, subtitle: "Needs disposal", onClick: () => setFilter("expired"), highlight: false },
        { label: "Expires in 1 day", value: oneDayCount, color: "teal", icon: faClock, subtitle: "Immediate action", onClick: () => setFilter("one_day"), highlight: oneDayCount > 0 },
        { label: "Use within 7 days", value: sevenDayCount, color: "teal", icon: faHourglassHalf, subtitle: "Highest priority", onClick: () => setFilter("urgent") },
        { label: "Expiring in 30 days", value: thirtyDayCount, color: "orange", icon: faThumbsUp, subtitle: "Units at risk", onClick: () => setFilter("urgent") },
      ]}
    />
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="flex flex-wrap items-center gap-1 border-b border-gray-100 px-4 py-3" role="tablist" aria-label="Inventory filters">{[{ value: "all" as const, label: "All" }, { value: "expired" as const, label: "Expired" }, { value: "one_day" as const, label: "Expires in 1 day" }, { value: "urgent" as const, label: "Expiring in 30 days" }, { value: "healthy" as const, label: "Healthy" }].map((option) => <button key={option.value} type="button" role="tab" aria-selected={filter === option.value} onClick={() => setFilter(option.value)} className={`px-3 py-2 text-sm font-medium transition ${filter === option.value ? "bg-brand-yellow text-gray-900" : "text-gray-600 hover:bg-brand-sand"}`}>{option.label}</button>)}</div><div className="p-4"><label className="block min-w-56 max-w-md"><span className="mb-1 block text-xs font-medium text-gray-500">Search products</span><input autoComplete="off" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-cyan focus:outline-none focus:ring-1 focus:ring-brand-cyan" placeholder="Search product name" /></label></div></div>
    {!activeStoreId ? <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">Select a store to view inventory.</div> : loading ? <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-orange border-t-transparent" /></div> : <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="hidden overflow-x-auto md:block"><table className="w-full text-sm"><thead><tr className="bg-brand-sand/50 border-b border-brand-beige"><th className="text-left px-5 py-3 font-semibold text-gray-600">Priority</th><th className="text-left px-5 py-3 font-semibold text-gray-600">Product</th><th className="text-left px-5 py-3 font-semibold text-gray-600">Expiry</th><th className="text-left px-5 py-3 font-semibold text-gray-600">Remaining</th><th className="text-left px-5 py-3 font-semibold text-gray-600">Quantity</th><th className="text-right px-5 py-3 font-semibold text-gray-600">Actions</th></tr></thead><tbody className="divide-y divide-brand-beige/60">{visibleItems.map((item) => <InventoryRow key={item._id} item={item} busy={busy} onQuickUse={(stock) => void updateStock("consume", stock, 1)} onUse={setUseItem} onDump={setDumpItem} />)}</tbody></table></div><div className="space-y-3 p-3 md:hidden">{visibleItems.map((item) => <InventoryCard key={item._id} item={item} busy={busy} onQuickUse={(stock) => void updateStock("consume", stock, 1)} onUse={setUseItem} onDump={setDumpItem} />)}</div>{visibleItems.length === 0 && <p className="px-6 py-14 text-center text-sm text-gray-500">No inventory matches this view.</p>}</section>}
    {productModal && <ProductDrawer products={products} name={productName} errorMessage={productError} busy={Boolean(busy)} onNameChange={(value) => { setProductName(value); setProductError(""); }} onSubmit={addProduct} onClose={() => setProductModal(false)} editingProduct={editingProduct} editingName={editingName} onEdit={(product) => { setEditingProduct(product._id); setEditingName(product.name); }} onEditNameChange={setEditingName} onSaveEdit={(id) => void saveProduct(id)} onCancelEdit={() => setEditingProduct(null)} onDelete={(product) => void deleteProduct(product)} />}
    {stockModal && <StockDrawer productInputRef={productInputRef} productQuery={productQuery} onProductQueryChange={(value) => { setProductQuery(value); setStockProduct(null); setProductMenuOpen(true); }} onProductFocus={() => setProductMenuOpen(true)} onProductKeyDown={productKeyDown} productMenuOpen={productMenuOpen} filteredProducts={filteredProducts} highlightedProduct={highlightedProduct} onSelectProduct={(product) => { setStockProduct(product); setProductQuery(product.name); setProductMenuOpen(false); }} expiryDate={expiryDate} onExpiryDateChange={setExpiryDate} stockQuantity={stockQuantity} onStockQuantityChange={setStockQuantity} stockError={stockError} busy={Boolean(busy)} onSubmit={receiveStock} onClose={() => setStockModal(false)} />}
    {useItem && <ConfirmModal title="Use stock?" text={`Use stock from ${useItem.product} expiring ${formatInventoryDate(useItem.expiryDate)}?`} busy={Boolean(busy)} onClose={() => setUseItem(null)} onConfirm={() => void updateStock("consume", useItem, Number(useQuantity))}><select value={useQuantity} onChange={(event) => setUseQuantity(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">{Array.from({ length: Math.max(0, useItem.quantity - 1) }, (_, index) => <option key={index + 2} value={index + 2}>{index + 2}</option>)}</select></ConfirmModal>}
    {dumpItem && <ConfirmModal title="Mark stock dumped?" text={`Dump ${formatInventoryQuantity(dumpItem.quantity)} units of ${dumpItem.product}? This stock is expired.`} busy={Boolean(busy)} onClose={() => setDumpItem(null)} onConfirm={() => void updateStock("dump", dumpItem)} />}
  </div>;
}
