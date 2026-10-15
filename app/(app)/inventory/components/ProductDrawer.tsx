"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faPencil, faTrashCan, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FieldError, fieldClass } from "@/app/components/form-validation";
import { useDrawerClose } from "@/app/hooks/useDrawerClose";
import type { Product } from "@/types/inventory";

type Props = {
  products: Product[];
  name: string;
  errorMessage: string;
  busy: boolean;
  onNameChange: (value: string) => void;
  onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => void;
  onClose: () => void;
  editingProduct: string | null;
  editingName: string;
  onEdit: (product: Product) => void;
  onEditNameChange: (value: string) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (product: Product) => void;
};

export default function ProductDrawer({
  products,
  name,
  errorMessage,
  busy,
  onNameChange,
  onSubmit,
  onClose,
  editingProduct,
  editingName,
  onEdit,
  onEditNameChange,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: Props) {
  const { visible, requestClose } = useDrawerClose();
  const close = () => requestClose(onClose);
  return (
    <>
      <div className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`} aria-hidden="true" onClick={close} style={{ height: "100vh" }} />
      <div className="fixed inset-y-0 right-0 z-50 flex max-w-full pointer-events-none">
        <div className={`flex h-full w-screen max-w-lg flex-col bg-white shadow-2xl pointer-events-auto transition-transform duration-200 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex shrink-0 items-center justify-between border-b border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900">Products</h3>
            <button type="button" onClick={close} className="text-gray-400">×</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <form id="product-form" method="post" onSubmit={onSubmit} noValidate className="flex gap-2">
          <input autoComplete="off" value={name} onChange={(event) => onNameChange(event.target.value)} className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm ${fieldClass(Boolean(errorMessage), "border-gray-300 focus:border-brand-cyan focus:ring-brand-cyan")}`} placeholder="Add one product" />
        </form>
        <FieldError message={errorMessage} />
        <div className="mt-6 divide-y divide-gray-100">
          {products.map((product, index) => (
            <div key={product._id} className="flex items-center gap-2 py-3">
              <span className="w-8 shrink-0 text-right text-xs tabular-nums text-gray-500">{index + 1}.</span>
              {editingProduct === product._id ? (
                <input autoComplete="off" autoFocus value={editingName} onChange={(event) => onEditNameChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onSaveEdit(product._id); } if (event.key === "Escape") onCancelEdit(); }} className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              ) : (
                <span className="min-w-0 flex-1 text-sm text-gray-800">{product.name}</span>
              )}
              <button type="button" onClick={() => editingProduct === product._id ? onSaveEdit(product._id) : onEdit(product)} className="p-2 text-brand-cyan" aria-label={editingProduct === product._id ? "Save product" : `Edit ${product.name}`}>
                <FontAwesomeIcon icon={editingProduct === product._id ? faCheck : faPencil} />
              </button>
              {editingProduct === product._id && <button type="button" onClick={onCancelEdit} className="p-2 text-gray-500" aria-label="Cancel product edit"><FontAwesomeIcon icon={faXmark} /></button>}
              <button type="button" onClick={() => onDelete(product)} disabled={busy} className="p-2 text-red-600 disabled:opacity-50" aria-label={`Delete ${product.name}`} title="Delete product">
                <FontAwesomeIcon icon={faTrashCan} />
              </button>
            </div>
          ))}
          </div>
          </div>
          <div className="flex shrink-0 justify-end border-t border-gray-200 p-6">
            <button type="submit" form="product-form" disabled={busy} className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white">Add</button>
          </div>
        </div>
      </div>
    </>
  );
}
