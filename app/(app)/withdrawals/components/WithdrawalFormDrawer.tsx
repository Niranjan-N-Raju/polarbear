"use client";

import { useState } from "react";
import { OutlineCloseIcon } from "@/app/components/icons";
import { FieldError, fieldClass } from "@/app/components/form-validation";
import { DatePicker } from "@/app/components/DatePicker";
import { useToast } from "@/app/hooks/useToast";
import { useDrawerClose } from "@/app/hooks/useDrawerClose";
import { useStoreModal } from "@/app/(app)/store-context";
import { withdrawalsRequest } from "../apicall/withdrawals";
import { buildEmptyForm, toNumber, todayISO, WITHDRAWAL_TYPE_OPTIONS } from "../utils";
import type { WithdrawalForm, WithdrawalRecord } from "@/types/withdrawals";

const NUMBER_PATTERN = /^\d*\.?\d*$/;

export function WithdrawalFormDrawer({
  onClose,
  onSaved,
  editRecord,
}: Readonly<{
  onClose: () => void;
  onSaved: () => void;
  editRecord?: WithdrawalRecord;
}>) {
  const { activeStoreId } = useStoreModal();
  const { error, success } = useToast();
  const { visible, requestClose } = useDrawerClose();
  const close = () => requestClose(onClose);
  const [form, setForm] = useState<WithdrawalForm>(
    () =>
      editRecord
        ? { date: editRecord.date, amount: String(editRecord.amount), type: editRecord.type, reason: editRecord.reason }
        : buildEmptyForm(),
  );
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof WithdrawalForm, string>>>({});
  const [saving, setSaving] = useState(false);

  function updateField<K extends keyof WithdrawalForm>(field: K, value: WithdrawalForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function getValidationErrors(): Partial<Record<keyof WithdrawalForm, string>> {
    const errors: Partial<Record<keyof WithdrawalForm, string>> = {};
    if (!form.date) errors.date = "This field is required.";
    else if (form.date > todayISO()) errors.date = "Date cannot be in the future.";
    if (!form.amount.trim() || !NUMBER_PATTERN.test(form.amount) || toNumber(form.amount) <= 0) {
      errors.amount = "Enter a valid amount.";
    }
    return errors;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errors = getValidationErrors();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (!activeStoreId) {
      error("Select a store before saving an entry.");
      return;
    }

    setSaving(true);
    try {
      const response = await withdrawalsRequest(editRecord ? `/api/withdrawals/${editRecord.id}` : "/api/withdrawals", {
        method: editRecord ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          franchiseId: activeStoreId,
          date: form.date,
          amount: toNumber(form.amount),
          type: form.type,
          reason: form.reason.trim(),
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to save entry.");
      success(data.message ?? "Entry saved successfully.");
      requestClose(onSaved);
    } catch (saveError) {
      error(saveError instanceof Error ? saveError.message : "Failed to save entry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        aria-hidden="true"
        onClick={close}
        style={{ height: "100vh" }}
      />
      <div className="fixed inset-y-0 right-0 z-50 flex max-w-full pointer-events-none">
        <div className={`bg-white shadow-2xl w-screen max-w-md h-full flex flex-col pointer-events-auto transition-transform duration-200 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-brand-beige">
            <h2 className="text-lg font-bold text-gray-900">{editRecord ? "Edit Entry" : "Add Entry"}</h2>
            <button
              onClick={close}
              data-unsaved-reset="true"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-brand-sand transition text-gray-500"
            >
              <OutlineCloseIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <form id="withdrawal-form" method="post" onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-4">
              <div>
                <label htmlFor="withdrawal-date" className="block text-sm font-medium text-gray-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  id="withdrawal-date"
                  value={form.date}
                  max={todayISO()}
                  onChange={(nextValue) => updateField("date", nextValue)}
                  ariaInvalid={Boolean(fieldErrors.date)}
                  ariaDescribedBy={fieldErrors.date ? "withdrawal-date-error" : undefined}
                  className={`w-full rounded-xl border px-4 py-2.5 text-left text-sm text-gray-900 focus:outline-none focus:ring-2 transition ${fieldClass(Boolean(fieldErrors.date))}`}
                />
                <FieldError id="withdrawal-date-error" message={fieldErrors.date} />
              </div>

              <div>
                <p className="mb-2 block text-sm font-medium text-gray-700">
                  Type <span className="text-red-500">*</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {WITHDRAWAL_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateField("type", option.value)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        form.type === option.value
                          ? "border-brand-orange bg-brand-peach text-brand-orange"
                          : "border-gray-200 bg-white text-gray-600 hover:border-brand-orange"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="withdrawal-amount" className="block text-sm font-medium text-gray-700 mb-1">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  id="withdrawal-amount"
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => updateField("amount", event.target.value.replaceAll(/[^\d.]/g, ""))}
                  aria-invalid={Boolean(fieldErrors.amount)}
                  aria-describedby={fieldErrors.amount ? "withdrawal-amount-error" : undefined}
                  placeholder="0.00"
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${fieldClass(Boolean(fieldErrors.amount))}`}
                />
                <FieldError id="withdrawal-amount-error" message={fieldErrors.amount} />
              </div>

              <div>
                <label htmlFor="withdrawal-reason" className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <textarea
                  id="withdrawal-reason"
                  value={form.reason}
                  onChange={(event) => updateField("reason", event.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="Optional note"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition"
                />
              </div>
            </form>
          </div>

          <div className="flex items-center gap-3 px-6 py-4 border-t border-brand-beige">
            <button
              type="button"
              onClick={close}
              data-unsaved-reset="true"
              className="flex-1 rounded-xl border border-brand-beige py-2.5 text-sm font-medium text-gray-600 hover:bg-brand-sand transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="withdrawal-form"
              disabled={saving}
              className="flex-1 rounded-xl bg-brand-orange py-2.5 text-sm font-semibold text-white hover:bg-brand-orange/90 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
