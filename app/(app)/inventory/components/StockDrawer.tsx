"use client";

import { DatePicker } from "@/app/components/DatePicker";
import { FieldError } from "@/app/components/form-validation";
import { useDrawerClose } from "@/app/hooks/useDrawerClose";
import type { Product } from "@/types/inventory";

interface Props {
  productInputRef: React.RefObject<HTMLInputElement | null>;
  productQuery: string;
  onProductQueryChange: (value: string) => void;
  onProductFocus: () => void;
  onProductKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  productMenuOpen: boolean;
  filteredProducts: Product[];
  highlightedProduct: number;
  onSelectProduct: (product: Product) => void;
  expiryDate: string;
  onExpiryDateChange: (value: string) => void;
  stockQuantity: string;
  onStockQuantityChange: (value: string) => void;
  stockError: string;
  busy: boolean;
  onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export default function StockDrawer({
  productInputRef,
  productQuery,
  onProductQueryChange,
  onProductFocus,
  onProductKeyDown,
  productMenuOpen,
  filteredProducts,
  highlightedProduct,
  onSelectProduct,
  expiryDate,
  onExpiryDateChange,
  stockQuantity,
  onStockQuantityChange,
  stockError,
  busy,
  onSubmit,
  onClose,
}: Props) {
  const { visible, requestClose } = useDrawerClose();
  const close = () => requestClose(onClose);
  return (
    <>
      <div className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`} aria-hidden="true" onClick={() => !busy && close()} style={{ height: "100vh" }} />
      <div className="fixed inset-y-0 right-0 z-50 flex max-w-full pointer-events-none">
        <form
          method="post"
          onSubmit={onSubmit}
          className={`flex h-full w-screen max-w-lg flex-col bg-white shadow-2xl pointer-events-auto transition-transform duration-200 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-gray-900">Add / Update Stock</h3>
            <label className="mt-5 block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Product</span>
            <div className="relative">
              <input
                ref={productInputRef}
                autoComplete="off"
                value={productQuery}
                onChange={(event) => onProductQueryChange(event.target.value)}
                onFocus={onProductFocus}
                onKeyDown={onProductKeyDown}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-cyan focus:outline-none focus:ring-1 focus:ring-brand-cyan"
                placeholder="Search predefined products"
              />
              {productMenuOpen && (
                <div className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {filteredProducts.map((product, index) => (
                    <button
                      type="button"
                      key={product._id}
                      onMouseDown={() => onSelectProduct(product)}
                      className={`block w-full px-3 py-2 text-left text-sm ${index === highlightedProduct ? "bg-brand-cyan/10" : "hover:bg-brand-sand"}`}
                    >
                      {product.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            </label>
            <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Expiry date</span>
            <DatePicker value={expiryDate} onChange={onExpiryDateChange} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
            </label>
            <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Quantity</span>
            <input
              type="number"
              min={1}
              value={stockQuantity}
              onChange={(event) => onStockQuantityChange(event.target.value.replace(/\D/g, ""))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
            </label>
            <FieldError message={stockError} />
          </div>
          <div className="flex shrink-0 justify-end gap-3 border-t border-gray-200 p-6">
            <button type="button" onClick={close} disabled={Boolean(busy)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={Boolean(busy)} className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy ? "Saving…" : "Receive stock"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
