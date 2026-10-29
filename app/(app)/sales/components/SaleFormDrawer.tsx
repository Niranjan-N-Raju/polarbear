"use client";

import { useState } from "react";
import { OutlineCloseIcon, EyeIcon, PencilIcon, TrashIcon } from "@/app/components/icons";
import { FieldError, fieldClass } from "@/app/components/form-validation";
import { DatePicker } from "@/app/components/DatePicker";
import { useToast } from "@/app/hooks/useToast";
import { useDrawerClose } from "@/app/hooks/useDrawerClose";
import { useStoreModal } from "@/app/(app)/store-context";
import { salesRequest } from "../apicall/sales";
import type { ExpenseItem, SaleForm, SaleRecord } from "@/types/sales";
import {
  buildEmptyForm,
  buildExpenseItemsFromSale,
  buildFormFromSale,
  sanitizeNumericInput,
  todayISO,
  toNumber,
} from "../utils";

const REQUIRED_FIELDS: (keyof SaleForm)[] = [
  "date",
  "totalSale",
  "swiggy",
  "zomato",
  "upi",
  "upiCharge",
];

const NUMERIC_FIELDS: (keyof SaleForm)[] = [
  "totalSale",
  "swiggy",
  "zomato",
  "upi",
  "upiCharge",
];

const NUMBER_PATTERN = /^\d*\.?\d*$/;

export function SaleFormDrawer({
  onClose,
  onSaved,
  editSale,
  existingDates,
}: Readonly<{
  onClose: () => void;
  onSaved: () => void;
  editSale?: SaleRecord;
  existingDates: string[];
}>) {
  const { activeStoreId } = useStoreModal();
  const { error, success } = useToast();
  const { visible, requestClose } = useDrawerClose();
  const close = () => requestClose(onClose);
  const [form, setForm] = useState<SaleForm>(() => (editSale ? buildFormFromSale(editSale) : buildEmptyForm()));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SaleForm, string>>>({});
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>(() =>
    editSale ? buildExpenseItemsFromSale(editSale) : [],
  );
  const [expensesError, setExpensesError] = useState<string | undefined>();
  const [showExpensePopover, setShowExpensePopover] = useState(false);
  const [draftExpense, setDraftExpense] = useState<ExpenseItem>({ name: "", amount: "" });
  const [draftExpenseError, setDraftExpenseError] = useState<string | undefined>();
  const [editingExpenseIndex, setEditingExpenseIndex] = useState<number | null>(null);
  const [showExpenseView, setShowExpenseView] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalExpenses = expenseItems.reduce((sum, item) => sum + toNumber(item.amount), 0);
  const cash = toNumber(form.totalSale) - toNumber(form.swiggy) - toNumber(form.zomato) - toNumber(form.upi);
  const bankingCash = cash - totalExpenses;

  function updateField(field: keyof SaleForm, value: string) {
    const nextValue = NUMERIC_FIELDS.includes(field) ? sanitizeNumericInput(value) : value;
    setForm((f) => ({ ...f, [field]: nextValue }));
    setFieldErrors((current) => ({
      ...current,
      [field]:
        field === "date" && existingDates.includes(nextValue)
          ? "A sale already exists for this date. Edit the existing entry instead."
          : undefined,
    }));
  }

  function openExpensePopover() {
    setEditingExpenseIndex(null);
    setDraftExpense({ name: "", amount: "" });
    setDraftExpenseError(undefined);
    setShowExpensePopover(true);
  }

  function openEditExpensePopover(index: number) {
    setEditingExpenseIndex(index);
    setDraftExpense(expenseItems[index]);
    setDraftExpenseError(undefined);
    setShowExpensePopover(true);
  }

  function submitDraftExpense() {
    if (draftExpense.name.trim() === "" || draftExpense.amount.trim() === "" || !NUMBER_PATTERN.test(draftExpense.amount)) {
      setDraftExpenseError("Enter a name and a valid amount.");
      return;
    }
    if (editingExpenseIndex === null) {
      setExpenseItems((items) => [...items, draftExpense]);
    } else {
      setExpenseItems((items) => items.map((item, i) => (i === editingExpenseIndex ? draftExpense : item)));
    }
    setExpensesError(undefined);
    setShowExpensePopover(false);
  }

  function deleteExpenseItem(index: number) {
    setExpenseItems((items) => items.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors = getValidationErrors();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;
    if (!activeStoreId) {
      error("Select a store before saving a sale.");
      return;
    }

    void (async () => {
      const ok = await saveSale();
      if (ok) requestClose(onSaved);
    })();
  }

  function getValidationErrors(): Partial<Record<keyof SaleForm, string>> {
    const errors: Partial<Record<keyof SaleForm, string>> = {};
    for (const field of REQUIRED_FIELDS) {
      if (form[field].trim() === "") {
        errors[field] = "This field is required.";
      } else if (NUMERIC_FIELDS.includes(field) && !NUMBER_PATTERN.test(form[field])) {
        errors[field] = "Enter a valid number.";
      }
    }
    if (!errors.date && form.date > todayISO()) {
      errors.date = "Date cannot be in the future.";
    }
    if (!errors.date && existingDates.includes(form.date)) {
      errors.date = "A sale already exists for this date. Edit the existing entry instead.";
    }
    return errors;
  }

  async function saveSale(): Promise<boolean> {
    if (!activeStoreId) return false;
    setSaving(true);
    try {
      const response = await salesRequest(editSale ? `/api/sales/${editSale.id}` : "/api/sales", {
        method: editSale ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          franchiseId: activeStoreId,
          date: form.date,
          totalSale: toNumber(form.totalSale),
          swiggy: toNumber(form.swiggy),
          zomato: toNumber(form.zomato),
          upi: toNumber(form.upi),
          upiCharge: toNumber(form.upiCharge),
          expenses: expenseItems.map((item) => ({ name: item.name, amount: toNumber(item.amount) })),
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to save sale.");
      success(data.message ?? "Sale saved successfully.");
      return true;
    } catch (saveError) {
      error(saveError instanceof Error ? saveError.message : "Failed to save sale.");
      return false;
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

      {/* Card */}
      <div className={`bg-white shadow-2xl w-screen max-w-2xl h-full flex flex-col pointer-events-auto transition-transform duration-200 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-beige">
          <h2 className="text-lg font-bold text-gray-900">{editSale ? "Edit Sale" : "Add Sale"}</h2>
          <button
            onClick={close}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-brand-sand transition text-gray-500"
          >
            <OutlineCloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
        <form
          id="sale-form"
          method="post"
          onSubmit={handleSubmit}
          noValidate
          className="grid grid-cols-1 gap-y-2 gap-x-4 sm:grid-cols-2"
        >
          <div>
            <label htmlFor="sale-date" className="block text-sm font-medium text-gray-700 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <DatePicker
              id="sale-date"
              value={form.date}
              max={todayISO()}
              disabledDates={existingDates}
              onChange={(nextValue) => updateField("date", nextValue)}
              ariaInvalid={Boolean(fieldErrors.date)}
              ariaDescribedBy={fieldErrors.date ? "sale-date-error" : undefined}
              className={`w-full rounded-xl border px-4 py-2.5 text-left text-sm text-gray-900 focus:outline-none focus:ring-2 transition ${fieldClass(Boolean(fieldErrors.date))}`}
            />
            <FieldError id="sale-date-error" message={fieldErrors.date} />
          </div>

          <div>
            <label htmlFor="sale-total" className="block text-sm font-medium text-gray-700 mb-1">
              Total Sale <span className="text-red-500">*</span>
            </label>
            <input
              id="sale-total"
              type="text"
              inputMode="decimal"
              value={form.totalSale}
              onChange={(e) => updateField("totalSale", e.target.value)}
              aria-invalid={Boolean(fieldErrors.totalSale)}
              aria-describedby={fieldErrors.totalSale ? "sale-total-error" : undefined}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${fieldClass(Boolean(fieldErrors.totalSale))}`}
            />
            <FieldError id="sale-total-error" message={fieldErrors.totalSale} />
          </div>

          <div>
            <label htmlFor="sale-swiggy" className="block text-sm font-medium text-gray-700 mb-1">
              Swiggy <span className="text-red-500">*</span>
            </label>
            <input
              id="sale-swiggy"
              type="text"
              inputMode="decimal"
              value={form.swiggy}
              onChange={(e) => updateField("swiggy", e.target.value)}
              aria-invalid={Boolean(fieldErrors.swiggy)}
              aria-describedby={fieldErrors.swiggy ? "sale-swiggy-error" : undefined}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${fieldClass(Boolean(fieldErrors.swiggy))}`}
            />
            <FieldError id="sale-swiggy-error" message={fieldErrors.swiggy} />
          </div>

          <div>
            <label htmlFor="sale-zomato" className="block text-sm font-medium text-gray-700 mb-1">
              Zomato <span className="text-red-500">*</span>
            </label>
            <input
              id="sale-zomato"
              type="text"
              inputMode="decimal"
              value={form.zomato}
              onChange={(e) => updateField("zomato", e.target.value)}
              aria-invalid={Boolean(fieldErrors.zomato)}
              aria-describedby={fieldErrors.zomato ? "sale-zomato-error" : undefined}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${fieldClass(Boolean(fieldErrors.zomato))}`}
            />
            <FieldError id="sale-zomato-error" message={fieldErrors.zomato} />
          </div>

          <div>
            <label htmlFor="sale-upi" className="block text-sm font-medium text-gray-700 mb-1">
              UPI <span className="text-red-500">*</span>
            </label>
            <input
              id="sale-upi"
              type="text"
              inputMode="decimal"
              value={form.upi}
              onChange={(e) => updateField("upi", e.target.value)}
              aria-invalid={Boolean(fieldErrors.upi)}
              aria-describedby={fieldErrors.upi ? "sale-upi-error" : undefined}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${fieldClass(Boolean(fieldErrors.upi))}`}
            />
            <FieldError id="sale-upi-error" message={fieldErrors.upi} />
          </div>

          <div>
            <label htmlFor="sale-upi-charge" className="block text-sm font-medium text-gray-700 mb-1">
              UPI Charge <span className="text-red-500">*</span>
            </label>
            <input
              id="sale-upi-charge"
              type="text"
              inputMode="decimal"
              value={form.upiCharge}
              onChange={(e) => updateField("upiCharge", e.target.value)}
              aria-invalid={Boolean(fieldErrors.upiCharge)}
              aria-describedby={fieldErrors.upiCharge ? "sale-upi-charge-error" : undefined}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${fieldClass(Boolean(fieldErrors.upiCharge))}`}
            />
            <FieldError id="sale-upi-charge-error" message={fieldErrors.upiCharge} />
          </div>

          <div>
            <label htmlFor="sale-cash" className="block text-sm font-medium text-gray-700 mb-1">
              Cash
            </label>
            <input
              id="sale-cash"
              type="text"
              readOnly
              value={cash.toFixed(2)}
              className="w-full rounded-xl border border-gray-200 bg-brand-sand/50 px-4 py-2.5 text-sm text-gray-600 cursor-not-allowed"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="sale-expenses" className="block text-sm font-medium text-gray-700">
                Expenses
              </label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    type="button"
                    onClick={openExpensePopover}
                    className="text-xs font-medium text-brand-orange hover:text-brand-orange/80 transition"
                  >
                    + Add expense
                  </button>

                  {showExpensePopover && (
                    <>
                      <button
                        type="button"
                        aria-label="Close expense popover"
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => setShowExpensePopover(false)}
                      />
                      <div className="absolute right-0 bottom-full z-20 mb-2 w-72 rounded-xl border border-brand-beige bg-white p-4 shadow-[0_20px_45px_rgba(36,50,58,0.25)] text-left">
                        <div className="space-y-3">
                          <div>
                            <label htmlFor="expense-name" className="block text-xs font-medium text-gray-700 mb-1">
                              Expense Name
                            </label>
                            <input
                              id="expense-name"
                              type="text"
                              value={draftExpense.name}
                              onChange={(e) => {
                                setDraftExpense((d) => ({ ...d, name: e.target.value }));
                                setDraftExpenseError(undefined);
                              }}
                              placeholder="e.g. Electricity"
                              className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${fieldClass(false)}`}
                            />
                          </div>
                          <div>
                            <label htmlFor="expense-amount" className="block text-xs font-medium text-gray-700 mb-1">
                              Amount
                            </label>
                            <input
                              id="expense-amount"
                              type="text"
                              inputMode="decimal"
                              value={draftExpense.amount}
                              onChange={(e) => {
                                setDraftExpense((d) => ({ ...d, amount: sanitizeNumericInput(e.target.value) }));
                                setDraftExpenseError(undefined);
                              }}
                              placeholder="0.00"
                              className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${fieldClass(false)}`}
                            />
                          </div>
                          {draftExpenseError && (
                            <p className="text-xs text-red-600" role="alert">
                              {draftExpenseError}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={submitDraftExpense}
                            className="w-full bg-brand-orange text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-brand-orange/90 transition"
                          >
                            {editingExpenseIndex === null ? "Add" : "Save"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {expenseItems.length > 0 && (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowExpenseView((v) => !v)}
                      aria-label="View expenses"
                      className="flex items-center justify-center"
                    >
                      <EyeIcon className="w-4 h-4 text-brand-sky cursor-pointer" />
                    </button>

                    {showExpenseView && (
                      <>
                        <button
                          type="button"
                          aria-label="Close expense details"
                          className="fixed inset-0 z-10 cursor-default"
                          onClick={() => setShowExpenseView(false)}
                        />
                        <div className="absolute right-0 bottom-full z-30 mb-1 w-72 space-y-1 rounded-lg border border-brand-beige bg-white p-3 text-xs text-gray-700 shadow-[0_20px_45px_rgba(36,50,58,0.25)]">
                          {expenseItems.map((item, index) => (
                            <div
                              key={`expense-tooltip-${index}-${item.name}`}
                              className="flex items-center justify-between gap-2"
                            >
                              <span>
                                {item.name}: {toNumber(item.amount).toFixed(2)}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    openEditExpensePopover(index);
                                    setShowExpenseView(false);
                                  }}
                                  aria-label={`Edit ${item.name}`}
                                  className="text-gray-400 hover:text-brand-orange transition"
                                >
                                  <PencilIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteExpenseItem(index)}
                                  aria-label={`Delete ${item.name}`}
                                  className="text-gray-400 hover:text-red-500 transition"
                                >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <p className="mt-1 border-t border-gray-200 pt-1 font-semibold">
                            Total: {totalExpenses.toFixed(2)}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <input
              id="sale-expenses"
              type="text"
              readOnly
              value={totalExpenses.toFixed(2)}
              className="w-full rounded-xl border border-gray-200 bg-brand-sand/50 px-4 py-2.5 text-sm text-gray-600 cursor-not-allowed"
            />

            <FieldError id="expense-items-error" message={expensesError} />
          </div>

          <div>
            <label htmlFor="sale-banking-cash" className="block text-sm font-medium text-gray-700 mb-1">
              Banking Cash
            </label>
            <input
              id="sale-banking-cash"
              type="text"
              readOnly
              value={bankingCash.toFixed(2)}
              className="w-full rounded-xl border border-gray-200 bg-brand-sand/50 px-4 py-2.5 text-sm text-gray-600 cursor-not-allowed"
            />
          </div>
        </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-brand-beige">
          <button
            type="button"
            onClick={close}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-brand-sand transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="sale-form"
            disabled={saving || Boolean(fieldErrors.date)}
            className="bg-brand-orange text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-orange/90 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : editSale ? "Update Sale" : "Save Sale"}
          </button>
        </div>
      </div>
      </div>
    </>
  );
}
