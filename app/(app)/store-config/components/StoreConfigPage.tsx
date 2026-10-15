"use client";

import { useCallback, useEffect, useState } from "react";
import { useStoreModal } from "@/app/(app)/store-context";
import { FieldError, fieldClass, focusFirstInvalidField } from "@/app/components/form-validation";
import { PencilIcon, TrashIcon } from "@/app/components/icons";
import { DatePicker } from "@/app/components/DatePicker";
import { useToast } from "@/app/hooks/useToast";
import type { StoreConfigData, StoreShiftOption } from "@/types/store-config";
import { storeConfigRequest } from "../apicall/storeConfig";
import { calculatedEndDate, currentPeriod, formatDate, initialStartDate, startDateFromDay } from "../utils";
import { StoreBrandingSection } from "./StoreBrandingSection";
import { StorePositionsSection } from "./StorePositionsSection";

function SalaryCycleConfirmModal({
  editing,
  cycleType,
  startDate,
  saving,
  onCancel,
  onConfirm,
}: Readonly<{
  editing: boolean;
  cycleType: "calendar_month" | "custom";
  startDate: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" aria-label="Cancel confirmation" className="absolute inset-0 bg-black/40" onClick={() => !saving && onCancel()} />
      <div role="dialog" aria-modal="true" aria-labelledby="config-confirm-title" className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 id="config-confirm-title" className="text-lg font-semibold text-gray-900">
          {editing ? "Confirm updated salary settings?" : "Confirm salary cycle?"}
        </h3>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          {cycleType === "calendar_month"
            ? "The cycle will run from the 1st through the last day of every month."
            : `The recurring cycle will run from day ${Number(startDate.slice(8))} through day ${Number(startDate.slice(8)) - 1} of the next month.`}{" "}
          {editing
            ? "This will apply to salary and incentive calculations going forward."
            : "You can edit this later from Store Config."}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={saving} className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white hover:bg-brand-orange/90 disabled:opacity-60">
            {saving ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StoreConfigPage() {
  const { activeStoreId } = useStoreModal();
  useEffect(() => { document.title = "Store Config · Polar Bear"; }, []);
  const { error, success } = useToast();
  const [data, setData] = useState<StoreConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [cycleType, setCycleType] = useState<"calendar_month" | "custom">(
    "calendar_month",
  );
  const [startDate, setStartDate] = useState(initialStartDate());
  const [errors, setErrors] = useState<{ startDate?: string }>({});
  const [shifts, setShifts] = useState<StoreShiftOption[]>([]);
  const [shiftName, setShiftName] = useState("");
  const [shiftStartTime, setShiftStartTime] = useState("");
  const [shiftEndTime, setShiftEndTime] = useState("");
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [savingShifts, setSavingShifts] = useState(false);

  const loadConfig = useCallback(async () => {
    if (!activeStoreId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [response, shiftsResponse] = await Promise.all([
        storeConfigRequest(
        `/api/salary?franchiseId=${encodeURIComponent(activeStoreId)}&period=${currentPeriod()}`,
        ),
        storeConfigRequest(`/api/stores/shifts?franchiseId=${encodeURIComponent(activeStoreId)}`),
      ]);
      const result = (await response.json()) as StoreConfigData & { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to load store configuration.");
      const shiftsResult = (await shiftsResponse.json()) as { shifts?: StoreShiftOption[]; message?: string };
      if (!shiftsResponse.ok) throw new Error(shiftsResult.message ?? "Failed to load store shifts.");
      result.shifts = shiftsResult.shifts ?? [];
      setData(result);
      setShifts(result.shifts);
      setEditing(false);
      if (!result.cycle.configured) {
        setCycleType("calendar_month");
        setStartDate(initialStartDate());
      }
    } catch (loadError) {
      error(loadError instanceof Error ? loadError.message : "Failed to load store configuration.");
    } finally {
      setLoading(false);
    }
  }, [activeStoreId, error]);

  useEffect(() => {
    queueMicrotask(() => void loadConfig());
  }, [loadConfig]);

  function prepareSave(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const start = new Date(`${startDate}T00:00:00`);
    const nextErrors: typeof errors = {};
    if (
      cycleType === "custom" &&
      (!startDate ||
        Number.isNaN(start.getTime()) ||
        start.getDate() < 2 ||
        start.getDate() > 28)
    ) {
      nextErrors.startDate = "Select a valid start date.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      focusFirstInvalidField("store-config-form");
      return;
    }
    setErrors({});
    setConfirming(true);
  }

  async function saveConfig() {
    if (!activeStoreId) return;
    setSaving(true);
    try {
      const response = await storeConfigRequest("/api/salary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          franchiseId: activeStoreId,
          cycleType,
          startDay:
            cycleType === "custom" ? Number(startDate.slice(8)) : undefined,
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to configure salary cycle.");
      setConfirming(false);
      success(editing ? "Salary cycle updated successfully." : "Salary cycle configured successfully.");
      await loadConfig();
    } catch (saveError) {
      error(saveError instanceof Error ? saveError.message : "Failed to configure salary cycle.");
    } finally {
      setSaving(false);
    }
  }

  function addShift() {
    const name = shiftName.trim();
    if (!name || !shiftStartTime || !shiftEndTime) {
      error("Enter a shift name, start time, and end time.");
      return;
    }
    if (shifts.some((shift) => shift.id !== editingShiftId && shift.name.toLowerCase() === name.toLowerCase())) {
      error("Shift names must be unique within this store.");
      return;
    }
    if (editingShiftId) {
      setShifts((current) => current.map((shift) =>
        shift.id === editingShiftId ? { ...shift, name, startTime: shiftStartTime, endTime: shiftEndTime } : shift,
      ));
    } else {
      setShifts((current) => [...current, { id: globalThis.crypto.randomUUID(), name, startTime: shiftStartTime, endTime: shiftEndTime }]);
    }
    cancelShiftEdit();
  }

  function editShift(shift: StoreShiftOption) {
    setEditingShiftId(shift.id);
    setShiftName(shift.name);
    setShiftStartTime(shift.startTime);
    setShiftEndTime(shift.endTime);
  }

  function cancelShiftEdit() {
    setEditingShiftId(null);
    setShiftName("");
    setShiftStartTime("");
    setShiftEndTime("");
  }

  function removeShift(shiftId: string) {
    setShifts((current) => current.filter((shift) => shift.id !== shiftId));
    if (editingShiftId === shiftId) cancelShiftEdit();
  }

  async function saveShifts() {
    if (!activeStoreId) return;
    setSavingShifts(true);
    try {
      const response = await storeConfigRequest("/api/stores/shifts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ franchiseId: activeStoreId, shifts }),
      });
      const result = (await response.json()) as { message?: string; shifts?: StoreShiftOption[] };
      if (!response.ok) throw new Error(result.message ?? "Failed to save store shifts.");
      setShifts(result.shifts ?? shifts);
      success(result.message ?? "Store shifts saved.");
    } catch (saveError) {
      error(saveError instanceof Error ? saveError.message : "Failed to save store shifts.");
      try {
        const response = await storeConfigRequest(`/api/stores/shifts?franchiseId=${encodeURIComponent(activeStoreId)}`);
        const result = (await response.json()) as { shifts?: StoreShiftOption[] };
        if (response.ok) setShifts(result.shifts ?? []);
      } catch {
        // Keep the current editor state if the recovery read also fails.
      }
    } finally {
      setSavingShifts(false);
    }
  }

  function startEditing() {
    if (!data) return;
    setCycleType(data.cycle.type);
    setStartDate(startDateFromDay(data.cycle.startDay));
    setErrors({});
    setEditing(true);
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-brand-beige bg-white/80 p-6 shadow-[0_10px_30px_rgba(36,50,58,0.05)]">
        <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-brand-teal sm:block">Workspace setup</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">Store Config</h2>
        <p className="mt-2 text-sm text-gray-500">{data?.store.name ?? "Configure the selected store"}</p>
      </div>

      {!activeStoreId ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          Select a store to view its configuration.
        </div>
      ) : loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-orange border-t-transparent" />
        </div>
      ) : data ? (
        <div className="space-y-8">
          <StoreBrandingSection activeStoreId={activeStoreId} />
          <StorePositionsSection activeStoreId={activeStoreId} />
          <section className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="font-semibold text-gray-900">Salary Cycle</h3>
            <p className="mt-1 text-sm text-gray-500">
              Payroll cycle dates for this store.
            </p>
          </div>
          {data.cycle.configured && !editing ? (
            <div className="mt-5 flex flex-wrap items-center gap-8">
              <div>
                <p className="text-xs font-medium text-gray-500">Cycle type</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {data.cycle.type === "calendar_month"
                    ? "Calendar Month"
                    : "Custom Monthly Cycle"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Recurring period</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {data.cycle.type === "calendar_month"
                    ? "1st to month end"
                    : `${data.cycle.startDay}th to ${data.cycle.endDay}th`}
                </p>
              </div>
              <span className="rounded-full bg-brand-teal/10 px-3 py-1 text-xs font-medium text-brand-teal">
                Configured
              </span>
              <button
                type="button"
                onClick={startEditing}
                className="rounded-lg border border-brand-orange px-4 py-2 text-sm font-medium text-brand-orange hover:bg-brand-peach/40"
              >
                Edit settings
              </button>
            </div>
          ) : (
            <form id="store-config-form" method="post" onSubmit={prepareSave} noValidate className="mt-5 space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  {
                    value: "calendar_month" as const,
                    label: "Calendar Month",
                    description: "From the 1st through the last day of each month.",
                  },
                  {
                    value: "custom" as const,
                    label: "Custom Monthly Cycle",
                    description: "From a chosen day through the previous day next month.",
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCycleType(option.value)}
                    className={`border p-4 text-left transition ${
                      cycleType === option.value
                        ? "border-brand-orange bg-brand-peach"
                        : "border-gray-200 bg-white hover:border-brand-orange"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-gray-900">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-gray-500">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
              {cycleType === "custom" && (
                <div className="flex flex-wrap items-start gap-4">
                  <label className="w-48">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      Cycle start date
                    </span>
                    <DatePicker
                      value={startDate}
                      onChange={(nextValue) => {
                        setStartDate(nextValue);
                        setErrors({});
                      }}
                      ariaInvalid={Boolean(errors.startDate)}
                      className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 ${fieldClass(Boolean(errors.startDate))}`}
                    />
                    <FieldError message={errors.startDate} />
                  </label>
                  <div className="w-48">
                    <p className="mb-1 text-sm font-medium text-gray-700">Calculated end date</p>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      {formatDate(calculatedEndDate(startDate))}
                    </div>
                  </div>
                  <p className="w-full text-xs text-gray-500">
                    Example: a start date on the 21st creates a recurring 21st to 20th cycle.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white hover:bg-brand-orange/90">
                  {editing ? "Save changes" : "Configure cycle"}
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <p className="w-full text-xs text-brand-orange">
                {editing
                  ? "Changing the cycle affects salary and incentive calculations going forward."
                  : "You can edit these settings later from this page if needed."}
              </p>
            </form>
          )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="font-semibold text-gray-900">Shift Options</h3>
            <p className="mt-1 text-sm text-gray-500">Define the shifts available for weekly rosters at {data.store.name}.</p>
          </div>
          <div className="mt-5 space-y-3">
            {shifts.length === 0 ? (
              <p className="text-sm text-gray-500">No shifts configured yet.</p>
            ) : shifts.map((shift) => (
              <div key={shift.id} className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
                <span className="min-w-0 flex-1 font-medium text-gray-900">{shift.name}</span>
                <span className="text-sm tabular-nums text-gray-600">{shift.startTime}–{shift.endTime}</span>
                <button type="button" onClick={() => editShift(shift)} title={`Edit ${shift.name} shift`} aria-label={`Edit ${shift.name} shift`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-brand-sky hover:bg-brand-sky/10 hover:text-brand-sky">
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => removeShift(shift.id)} title={`Delete ${shift.name} shift`} aria-label={`Delete ${shift.name} shift`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-orange-600 hover:bg-orange-50 hover:text-orange-700">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem_auto]">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Shift name</span>
              <input value={shiftName} onChange={(event) => setShiftName(event.target.value)} maxLength={40} placeholder="e.g. Morning" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Start time</span>
              <input type="time" value={shiftStartTime} onChange={(event) => setShiftStartTime(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">End time</span>
              <input type="time" value={shiftEndTime} onChange={(event) => setShiftEndTime(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange" />
            </label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={addShift} className="rounded-lg border border-brand-orange px-4 py-2 text-sm font-medium text-brand-orange hover:bg-brand-peach/40">{editingShiftId ? "Update Shift" : "Add Shift"}</button>
              {editingShiftId && <button type="button" onClick={cancelShiftEdit} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>}
            </div>
          </div>
          <button type="button" onClick={() => void saveShifts()} disabled={savingShifts} className="mt-5 min-h-11 w-full rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white hover:bg-brand-orange/90 disabled:opacity-60 sm:w-auto">
            {savingShifts ? "Saving…" : "Save Shifts"}
          </button>
          </section>

        </div>
      ) : null}

      {confirming && (
        <SalaryCycleConfirmModal
          editing={editing}
          cycleType={cycleType}
          startDate={startDate}
          saving={saving}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void saveConfig()}
        />
      )}
    </div>
  );
}