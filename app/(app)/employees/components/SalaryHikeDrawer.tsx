"use client";

import { useState } from "react";
import { DatePicker } from "@/app/components/DatePicker";
import { OutlineCloseIcon } from "@/app/components/icons";
import { useDrawerClose } from "@/app/hooks/useDrawerClose";
import { useToast } from "@/app/hooks/useToast";
import { businessDateValue } from "@/lib/date-utils";
import type { Employee } from "@/types/employees";
import { employeesRequest } from "../apicall/employees";

export default function SalaryHikeDrawer({
  employee,
  storeId,
  mode = "hike",
  positions = [],
  onClose,
  onSaved,
}: Readonly<{
  employee: Employee;
  storeId: string;
  mode?: "hike" | "promotion";
  positions?: string[];
  onClose: () => void;
  onSaved: () => void;
}>) {
  const { visible, requestClose } = useDrawerClose();
  const { success } = useToast();
  const [salary, setSalary] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(businessDateValue);
  const [position, setPosition] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = () => {
    if (!busy) requestClose(onClose);
  };
  useEffect(() => {
    setPosition(positions.find((item) => item !== employee.position) ?? "");
  }, [employee, positions]);
  const money = (value: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(value);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const amount = Number(salary);
    if (
      !salary.trim() ||
      !Number.isFinite(amount) ||
      amount <= (employee.latestSalary ?? employee.salary ?? 0) ||
      !effectiveFrom
    ) {
      setError(
        "Enter a salary above the latest approved salary and choose an effective date."
      );
      return;
    }
    if (mode === "promotion" && (!position || position === employee.position)) {
      setError("Choose a new configured position for this promotion.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await employeesRequest(
        `/api/users/${encodeURIComponent(employee._id)}/salary-hikes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            franchiseId: storeId,
            salary: amount,
            effectiveFrom,
            ...(mode === "promotion" ? { position } : {}),
          }),
        }
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok)
        throw new Error(data.message ?? "Unable to save salary hike.");
      success(
        data.message ??
          (mode === "promotion"
            ? "Employee promotion saved."
            : "Salary hike saved.")
      );
      requestClose(() => {
        onSaved();
        onClose();
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save salary hike."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
        onClick={close}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="salary-hike-title"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl transition-transform duration-200 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-brand-beige p-5">
          <h2
            id="salary-hike-title"
            className="text-lg font-semibold text-gray-900"
          >
            {mode === "promotion" ? "Employee promotion" : "Salary hike"}
          </h2>
          <button
            type="button"
            aria-label="Close salary change"
            disabled={busy}
            onClick={close}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <OutlineCloseIcon className="h-4 w-4" />
          </button>
        </header>
        <form
          id="salary-hike-form"
          onSubmit={save}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
        >
          <p className="break-words font-medium text-gray-900">
            {employee.name}
            {employee.employeeCode ? ` (${employee.employeeCode})` : ""}
          </p>
          <dl className="space-y-2 text-sm text-gray-600">
            <div>
              <dt>Current monthly salary</dt>
              <dd className="font-semibold text-gray-900">
                {money(employee.salary ?? 0)}
              </dd>
            </div>
            <div>
              <dt>Latest approved monthly salary</dt>
              <dd className="font-semibold text-gray-900">
                {money(employee.latestSalary ?? employee.salary ?? 0)}
              </dd>
            </div>
          </dl>
          {mode === "promotion" ? (
            <label className="block text-sm font-medium text-gray-700">
              New position
              <select
                value={position}
                disabled={busy}
                onChange={(event) => {
                  setPosition(event.target.value);
                  setError("");
                }}
                className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900"
              >
                <option value="">Select position</option>
                {positions
                  .filter((item) => item !== employee.position)
                  .map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          <label className="block text-sm font-medium text-gray-700">
            New monthly salary
            <input
              type="text"
              inputMode="decimal"
              value={salary}
              disabled={busy}
              onChange={(event) => {
                setSalary(event.target.value.replace(/[^\d.]/g, ""));
                setError("");
              }}
              className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900"
              placeholder="0.00"
            />
          </label>
          <div>
            <label
              htmlFor="salary-hike-effective"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Effective from
            </label>
            <DatePicker
              id="salary-hike-effective"
              value={effectiveFrom}
              min={employee.dateOfJoining?.slice(0, 10)}
              onChange={setEffectiveFrom}
              className="min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
        </form>
        <footer className="flex gap-3 border-t border-brand-beige p-5">
          <button
            type="button"
            disabled={busy}
            onClick={close}
            className="min-h-11 flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="salary-hike-form"
            disabled={busy}
            className="min-h-11 flex-1 rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy
              ? "Saving…"
              : mode === "promotion"
              ? "Save promotion"
              : "Save hike"}
          </button>
        </footer>
      </section>
    </>
  );
}
