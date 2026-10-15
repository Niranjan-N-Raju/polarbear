"use client";

type Props = {
  title: string;
  text: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  children?: React.ReactNode;
};

export default function ConfirmModal({ title, text, busy, onClose, onConfirm, children }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" aria-label="Close confirmation" className="absolute inset-0 bg-black/40" onClick={() => !busy && onClose()} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{text}</p>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? "Updating…" : "Confirm"}</button>
        </div>
      </div>
    </div>
  );
}
