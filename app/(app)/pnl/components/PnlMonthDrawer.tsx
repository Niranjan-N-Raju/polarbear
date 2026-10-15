"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/app/hooks/useToast";
import { useDrawerClose } from "@/app/hooks/useDrawerClose";
import { OutlineCloseIcon } from "@/app/components/icons";
import type { PnlMonth, PnlInputData } from "@/types/pnl";
import { PNL_COST_OF_GOODS_KEYS, PNL_EXPENSE_KEYS, PNL_RENT_KEYS, PNL_STAFF_SALARY_KEY } from "@/lib/pnl-expenses";
import { pnlRequest } from "../apicall/pnl";
import { formatCurrency, formatPercent, formatPeriodLabel, formatRangeLabel } from "../utils";
import { PNL_FIELD_GROUPS } from "./pnlFieldGroups";

function Row({ label, value, strong }: Readonly<{ label: string; value: React.ReactNode; strong?: boolean }>) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 py-2.5 text-sm last:border-0">
      <span className={strong ? "font-semibold text-gray-900" : "text-gray-500"}>{label}</span>
      <span className={strong ? "font-semibold text-gray-900" : "font-medium text-gray-900"}>{value}</span>
    </div>
  );
}

function SummaryRow({
  label,
  amount,
  value,
  strong,
}: Readonly<{ label: string; amount: number; value: React.ReactNode; strong?: boolean }>) {
  return amount === 0 ? null : <Row label={label} value={value} strong={strong} />;
}

function InputRow({
  label,
  value,
  onChange,
}: Readonly<{ label: string; value: string; onChange: (value: string) => void }>) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 py-2.5 text-sm last:border-0">
      <span className="text-gray-500">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value.replaceAll(/[^\d.]/g, ""))}
        placeholder="0"
        className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
      />
    </div>
  );
}

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="mt-6 first:mt-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-1 shadow-sm">{children}</div>
    </div>
  );
}

function toNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const SPECIAL_KEYS = [
  "netSales",
  "nob",
  "food",
  "packaging",
  "houseKeeping",
  "localPurchase",
  "wastage",
  "swiggyFee",
  "zomatoFee",
  "amazonFee",
  "dotPeFee",
  "rent",
  "rentStaffRoom",
  "electricityCharges",
];
const GROUP_KEYS = PNL_FIELD_GROUPS.flatMap((group) => group.fields.map((field) => field.key));
const ALL_KEYS = [...SPECIAL_KEYS, ...GROUP_KEYS];

export function PnlMonthDrawer({
  month,
  franchiseId,
  onClose,
  onSaved,
}: Readonly<{ month: PnlMonth; franchiseId: string; onClose: () => void; onSaved: () => void }>) {
  const { error, success } = useToast();
  const { visible, requestClose } = useDrawerClose();
  const close = () => requestClose(onClose);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const get = useCallback((key: string) => values[key] ?? "", [values]);
  const set = useCallback(
    (key: string) => (value: string) => setValues((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const loadInput = useCallback(async () => {
    setLoading(true);
    try {
      const response = await pnlRequest(
        `/api/pnl/inputs?franchiseId=${encodeURIComponent(franchiseId)}&period=${encodeURIComponent(month.period)}`,
      );
      const result = (await response.json()) as { input: PnlInputData | null; message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to load P&L inputs.");
      const loaded: Record<string, string> = {};
      for (const [key, value] of Object.entries(result.input?.values ?? {})) {
        loaded[key] = value ? String(value) : "";
      }
      // First time opening this period — suggest an auto-calculated starting value the user can edit.
      if (loaded.netSales === undefined) loaded.netSales = String(round2((month.revenue || 0) * 0.95));
      if (loaded.swiggyFee === undefined) loaded.swiggyFee = String(round2((month.swiggyRevenue || 0) * 0.185));
      if (loaded.zomatoFee === undefined) loaded.zomatoFee = String(round2((month.zomatoRevenue || 0) * 0.18));
      setValues(loaded);
    } catch (loadError) {
      error(loadError instanceof Error ? loadError.message : "Failed to load P&L inputs.");
    } finally {
      setLoading(false);
    }
  }, [franchiseId, month.period, month.revenue, month.swiggyRevenue, month.zomatoRevenue, error]);

  useEffect(() => {
    queueMicrotask(() => void loadInput());
  }, [loadInput]);

  async function save() {
    setSaving(true);
    try {
      const payloadValues: Record<string, number> = {};
      for (const key of ALL_KEYS) payloadValues[key] = toNumber(get(key));
      const response = await pnlRequest("/api/pnl/inputs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ franchiseId, period: month.period, values: payloadValues }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to save P&L inputs.");
      success(result.message ?? "P&L inputs saved.");
      onSaved();
      close();
    } catch (saveError) {
      error(saveError instanceof Error ? saveError.message : "Failed to save P&L inputs.");
    } finally {
      setSaving(false);
    }
  }

  const grossSales = month.revenue || 0;
  const netSales = toNumber(get("netSales"));
  const nobValue = toNumber(get("nob"));
  const apc = nobValue > 0 ? netSales / nobValue : 0;
  const consumption = PNL_COST_OF_GOODS_KEYS.reduce((sum, key) => sum + toNumber(get(key)), 0);
  const grossProfit = netSales - consumption;
  const actualFoodCost = toNumber(get("food")) + toNumber(get("localPurchase")) + toNumber(get("packaging"));
  const foodCostPercent = netSales > 0 ? (actualFoodCost / netSales) * 100 : 0;
  const swiggyFee = toNumber(get("swiggyFee"));
  const zomatoFee = toNumber(get("zomatoFee"));
  const homeDeliveryCharges = swiggyFee + toNumber(get("amazonFee")) + toNumber(get("dotPeFee")) + zomatoFee;
  const rentExpenses = PNL_RENT_KEYS.reduce((sum, key) => sum + toNumber(get(key)), 0);
  const otherManualExpenses = PNL_EXPENSE_KEYS.reduce(
    (sum, key) =>
      sum + (key === PNL_STAFF_SALARY_KEY || PNL_COST_OF_GOODS_KEYS.includes(key as typeof PNL_COST_OF_GOODS_KEYS[number]) || PNL_RENT_KEYS.includes(key as typeof PNL_RENT_KEYS[number])
        ? 0
        : toNumber(get(key))),
    0,
  );
  const payroll = toNumber(get(PNL_STAFF_SALARY_KEY)) || month.payroll;
  const totalStoreExpenses = rentExpenses + otherManualExpenses;
  const totalExpenses = totalStoreExpenses + payroll;
  const netProfit = grossProfit - totalExpenses;
  const margin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        style={{ height: "100vh" }}
        aria-hidden="true"
        onClick={close}
      />
      <div className="fixed inset-y-0 right-0 z-50 flex max-w-full pointer-events-none">
        <div
          className={`h-full w-screen max-w-md flex flex-col overflow-hidden bg-white shadow-2xl pointer-events-auto transition-transform duration-200 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h3 className="font-semibold text-gray-900">{formatPeriodLabel(month.period)}</h3>
              <p className="text-xs text-gray-500">{formatRangeLabel(month.from, month.to)}</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-brand-sand"
              aria-label="Close"
            >
              <OutlineCloseIcon className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <p className="flex-1 px-6 py-10 text-center text-sm text-gray-500">Loading…</p>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <Section title="Sales">
                <Row label="Sales (Gross)" value={formatCurrency(grossSales)} />
                <InputRow label="Sales (Net)" value={get("netSales")} onChange={set("netSales")} />
                <InputRow label="Number of Bills (NOB)" value={get("nob")} onChange={set("nob")} />
                <Row label="Average Per Cover (APC)" value={formatCurrency(apc)} />
              </Section>

              <Section title="Consumption">
                <InputRow label="Food" value={get("food")} onChange={set("food")} />
                <InputRow label="Packaging" value={get("packaging")} onChange={set("packaging")} />
                <InputRow label="House Keeping" value={get("houseKeeping")} onChange={set("houseKeeping")} />
                <InputRow label="Local Purchase" value={get("localPurchase")} onChange={set("localPurchase")} />
                <InputRow label="Wastage" value={get("wastage")} onChange={set("wastage")} />
                <Row label="Total Consumption" value={formatCurrency(consumption)} strong />
              </Section>

              <Section title="Food Cost">
                <Row label="Actual Food Cost" value={formatCurrency(actualFoodCost)} />
                <Row label="Food Cost %" value={formatPercent(foodCostPercent)} strong />
                <Row label="Gross Profit" value={formatCurrency(grossProfit)} strong />
              </Section>

              <Section title="Other Expenses">
                <InputRow label="Swiggy Commission" value={get("swiggyFee")} onChange={set("swiggyFee")} />
                <InputRow label="Amazon Commission" value={get("amazonFee")} onChange={set("amazonFee")} />
                <InputRow label="Dot Pe Commission" value={get("dotPeFee")} onChange={set("dotPeFee")} />
                <InputRow label="Zomato Commission" value={get("zomatoFee")} onChange={set("zomatoFee")} />
                <Row label="Home Delivery Charges" value={formatCurrency(homeDeliveryCharges)} strong />
              </Section>

              <Section title="Rent & Utilities">
                <InputRow label="Rent" value={get("rent")} onChange={set("rent")} />
                <InputRow label="Rent (Staff Room)" value={get("rentStaffRoom")} onChange={set("rentStaffRoom")} />
                <InputRow label="Electricity Charges" value={get("electricityCharges")} onChange={set("electricityCharges")} />
                <Row
                  label="Total Rent & Utilities"
                  value={formatCurrency(
                    toNumber(get("rent")) + toNumber(get("rentStaffRoom")) + toNumber(get("electricityCharges")),
                  )}
                  strong
                />
              </Section>

              {PNL_FIELD_GROUPS.map((group) => (
                <Section key={group.title} title={group.title}>
                  {group.fields.map((field) => (
                    <InputRow key={field.key} label={field.label} value={get(field.key)} onChange={set(field.key)} />
                  ))}
                  {group.fields.length > 1 && (
                    <Row
                      label="Total"
                      value={formatCurrency(group.fields.reduce((sum, field) => sum + toNumber(get(field.key)), 0))}
                      strong
                    />
                  )}
                </Section>
              ))}

              <Section title="Summary">
                <SummaryRow label="Gross Profit" amount={grossProfit} value={formatCurrency(grossProfit)} strong />
                <SummaryRow label="Total Expenses" amount={totalExpenses} value={formatCurrency(totalExpenses)} strong />
                <SummaryRow label="Net Profit" amount={netProfit} value={formatCurrency(netProfit)} strong />
                <SummaryRow label="% of Profit" amount={margin} value={formatPercent(margin)} strong />
              </Section>

            </div>
          )}
          <div className="flex shrink-0 gap-3 border-t border-brand-beige bg-white p-6">
            <button
              type="button"
              onClick={close}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || loading}
              className="flex-1 rounded-lg bg-brand-orange py-2 text-sm font-medium text-white hover:bg-brand-orange/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
