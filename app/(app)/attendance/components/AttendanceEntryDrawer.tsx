import { useEffect, useRef } from "react";
import { DatePicker } from "@/app/components/DatePicker";
import type { AttendanceEmployee, AttendanceStatus } from "@/types/attendance";
import { isEmployeeActiveOn } from "@/lib/employee-status";
import { useDrawerVisibility } from "@/app/hooks/useDrawerClose";
import { enumerateDates, STATUS_OPTIONS, statusStyle } from "../utils";

interface Props {
  open: boolean;
  mode: "employees" | "days";
  setMode: (mode: "employees" | "days") => void;
  bulkDate: string;
  setBulkDate: (value: string) => void;
  selectedEmployeeIds: string[];
  setSelectedEmployeeIds: React.Dispatch<React.SetStateAction<string[]>>;
  employeeMenuOpen: boolean;
  setEmployeeMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  bulkStatus: AttendanceStatus;
  setBulkStatus: (value: AttendanceStatus) => void;
  bulkComment: string;
  setBulkComment: (value: string) => void;
  bulkEmployeeIds: string[];
  setBulkEmployeeIds: React.Dispatch<React.SetStateAction<string[]>>;
  bulkEmployeeMenuOpen: boolean;
  setBulkEmployeeMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  bulkFromDate: string;
  setBulkFromDate: (value: string) => void;
  bulkToDate: string;
  setBulkToDate: (value: string) => void;
  employees: AttendanceEmployee[];
  saving: boolean;
  onClose: () => void;
  onUpdateBulkDate: (value: string) => void;
  onSaveEmployees: () => void;
  onSaveDays: () => void;
}

export function AttendanceEntryDrawer(props: Props) {
  const {
    open,
    mode,
    setMode,
    bulkDate,
    selectedEmployeeIds,
    setSelectedEmployeeIds,
    employeeMenuOpen,
    setEmployeeMenuOpen,
    bulkStatus,
    setBulkStatus,
    bulkComment,
    setBulkComment,
    bulkEmployeeIds,
    setBulkEmployeeIds,
    bulkEmployeeMenuOpen,
    setBulkEmployeeMenuOpen,
    bulkFromDate,
    setBulkFromDate,
    bulkToDate,
    setBulkToDate,
    employees,
    saving,
    onClose,
    onUpdateBulkDate,
    onSaveEmployees,
    onSaveDays,
  } = props;
  const employeeMenuRef = useRef<HTMLDivElement | null>(null);
  const bulkEmployeeMenuRef = useRef<HTMLDivElement | null>(null);
  const { shouldRender, visible } = useDrawerVisibility(open);
  useEffect(() => {
    if (!employeeMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        employeeMenuRef.current &&
        !employeeMenuRef.current.contains(event.target as Node)
      )
        setEmployeeMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [employeeMenuOpen, setEmployeeMenuOpen]);
  useEffect(() => {
    if (!bulkEmployeeMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        bulkEmployeeMenuRef.current &&
        !bulkEmployeeMenuRef.current.contains(event.target as Node)
      )
        setBulkEmployeeMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [bulkEmployeeMenuOpen, setBulkEmployeeMenuOpen]);
  if (!shouldRender) return null;
  const eligibleEmployees = employees
    .filter((employee) => isEmployeeActiveOn(employee, bulkDate))
    .sort((a, b) => a.name.localeCompare(b.name));
  const activeEmployeesForDays = employees
    .filter((employee) => employee.isActive !== false)
    .sort((a, b) => a.name.localeCompare(b.name));
  const bulkDaysInRange =
    bulkFromDate <= bulkToDate ? enumerateDates(bulkFromDate, bulkToDate) : [];
  const bulkSelectedEmployees = bulkEmployeeIds
    .map((id) => employees.find((employee) => employee._id === id))
    .filter((employee): employee is AttendanceEmployee => Boolean(employee));
  const bulkTotalRecords = bulkSelectedEmployees.reduce(
    (sum, employee) =>
      sum + bulkDaysInRange.filter((date) => isEmployeeActiveOn(employee, date)).length,
    0,
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        style={{ height: "100vh" }}
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 flex max-w-full pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-attendance-title"
          className={`h-full w-screen max-w-xl bg-white shadow-2xl pointer-events-auto flex flex-col transition-transform duration-200 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex shrink-0 items-start justify-between border-b border-gray-100 px-6 py-5">
            <div>
              <h3
                id="add-attendance-title"
                className="text-lg font-semibold text-gray-900"
              >
                Add Attendance
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {mode === "employees"
                  ? "Record attendance for one day across multiple employees."
                  : "Record attendance for one employee across multiple days."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xl leading-none text-gray-400 hover:text-gray-700"
              aria-label="Close add attendance dialog"
            >
              ×
            </button>
          </div>
          <div className="flex shrink-0 gap-2 border-b border-gray-100 px-6 pt-4">
            <button
              type="button"
              onClick={() => setMode("employees")}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${mode === "employees" ? "border-b-2 border-brand-orange text-brand-orange" : "text-gray-500 hover:text-gray-700"}`}
            >
              Multiple Employees
            </button>
            <button
              type="button"
              onClick={() => setMode("days")}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${mode === "days" ? "border-b-2 border-brand-orange text-brand-orange" : "text-gray-500 hover:text-gray-700"}`}
            >
              Multiple Days
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {mode === "employees" ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">
                    Attendance date
                  </span>
                  <DatePicker
                    value={bulkDate}
                    onChange={onUpdateBulkDate}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                  />
                </label>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">
                      Employees
                    </p>
                  </div>
                  <div className="relative" ref={employeeMenuRef}>
                    <button
                      type="button"
                      onClick={() =>
                        setEmployeeMenuOpen((openState) => !openState)
                      }
                      aria-expanded={employeeMenuOpen}
                      aria-haspopup="listbox"
                      className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                    >
                      <span className="truncate">
                        {selectedEmployeeIds.length === 0
                          ? "Select employees"
                          : `${selectedEmployeeIds.length} employee${selectedEmployeeIds.length === 1 ? "" : "s"} selected`}
                      </span>
                      <span className="ml-3 text-gray-400" aria-hidden="true">
                        {employeeMenuOpen ? "▴" : "▾"}
                      </span>
                    </button>
                    {employeeMenuOpen && (
                      <div
                        role="listbox"
                        aria-multiselectable="true"
                        className="absolute left-0 right-0 z-10 mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedEmployeeIds((current) =>
                              current.length === eligibleEmployees.length
                                ? []
                                : eligibleEmployees.map(
                                    (employee) => employee._id,
                                  ),
                            )
                          }
                          className="mb-1 w-full rounded-md px-3 py-2 text-left text-xs font-medium text-brand-teal hover:bg-brand-sand"
                        >
                          {selectedEmployeeIds.length ===
                          eligibleEmployees.length
                            ? "Clear all"
                            : "Select all employees"}
                        </button>
                        {eligibleEmployees.length === 0 && (
                          <p className="px-3 py-2 text-xs text-gray-500">
                            No employees were active on this date.
                          </p>
                        )}
                        {eligibleEmployees.map((employee) => {
                          const selected = selectedEmployeeIds.includes(
                            employee._id,
                          );
                          return (
                            <button
                              key={employee._id}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onClick={() =>
                                setSelectedEmployeeIds((current) =>
                                  selected
                                    ? current.filter(
                                        (id) => id !== employee._id,
                                      )
                                    : [...current, employee._id],
                                )
                              }
                              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                            >
                              <span
                                className={`flex h-4 w-4 items-center justify-center rounded border text-xs ${selected ? "border-brand-orange bg-brand-orange text-white" : "border-gray-300 bg-white"}`}
                                aria-hidden="true"
                              >
                                {selected ? "✓" : ""}
                              </span>
                              <span className="truncate">{employee.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    {selectedEmployeeIds.length} employee
                    {selectedEmployeeIds.length === 1 ? "" : "s"} selected
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">
                      Employees
                    </p>
                  </div>
                  <div className="relative" ref={bulkEmployeeMenuRef}>
                    <button
                      type="button"
                      onClick={() =>
                        setBulkEmployeeMenuOpen((openState) => !openState)
                      }
                      aria-expanded={bulkEmployeeMenuOpen}
                      aria-haspopup="listbox"
                      className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                    >
                      <span className="truncate">
                        {bulkEmployeeIds.length === 0
                          ? "Select employees"
                          : `${bulkEmployeeIds.length} employee${bulkEmployeeIds.length === 1 ? "" : "s"} selected`}
                      </span>
                      <span className="ml-3 text-gray-400" aria-hidden="true">
                        {bulkEmployeeMenuOpen ? "▴" : "▾"}
                      </span>
                    </button>
                    {bulkEmployeeMenuOpen && (
                      <div
                        role="listbox"
                        aria-multiselectable="true"
                        className="absolute left-0 right-0 z-10 mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setBulkEmployeeIds((current) =>
                              current.length === activeEmployeesForDays.length
                                ? []
                                : activeEmployeesForDays.map(
                                    (employee) => employee._id,
                                  ),
                            )
                          }
                          className="mb-1 w-full rounded-md px-3 py-2 text-left text-xs font-medium text-brand-teal hover:bg-brand-sand"
                        >
                          {bulkEmployeeIds.length ===
                          activeEmployeesForDays.length
                            ? "Clear all"
                            : "Select all employees"}
                        </button>
                        {activeEmployeesForDays.length === 0 && (
                          <p className="px-3 py-2 text-xs text-gray-500">
                            No active employees.
                          </p>
                        )}
                        {activeEmployeesForDays.map((employee) => {
                          const selected = bulkEmployeeIds.includes(
                            employee._id,
                          );
                          return (
                            <button
                              key={employee._id}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onClick={() =>
                                setBulkEmployeeIds((current) =>
                                  selected
                                    ? current.filter(
                                        (id) => id !== employee._id,
                                      )
                                    : [...current, employee._id],
                                )
                              }
                              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                            >
                              <span
                                className={`flex h-4 w-4 items-center justify-center rounded border text-xs ${selected ? "border-brand-orange bg-brand-orange text-white" : "border-gray-300 bg-white"}`}
                                aria-hidden="true"
                              >
                                {selected ? "✓" : ""}
                              </span>
                              <span className="truncate">{employee.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">
                      From
                    </span>
                    <DatePicker
                      value={bulkFromDate}
                      max={bulkToDate}
                      onChange={setBulkFromDate}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">
                      To
                    </span>
                    <DatePicker
                      value={bulkToDate}
                      min={bulkFromDate}
                      onChange={setBulkToDate}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                    />
                  </label>
                </div>
                <p className={`text-xs ${bulkFromDate > bulkToDate ? "font-medium text-red-600" : "text-gray-500"}`}>
                  {bulkFromDate > bulkToDate ? (
                    "The \"To\" date must be on or after the \"From\" date."
                  ) : (
                    <>
                      {bulkTotalRecords} record{bulkTotalRecords === 1 ? "" : "s"}{" "}
                      will be saved across {bulkDaysInRange.length} day
                      {bulkDaysInRange.length === 1 ? "" : "s"} and{" "}
                      {bulkSelectedEmployees.length} employee
                      {bulkSelectedEmployees.length === 1 ? "" : "s"}
                      {bulkSelectedEmployees.length > 0 &&
                      bulkTotalRecords < bulkDaysInRange.length * bulkSelectedEmployees.length
                        ? " (some employees weren't active on every day)."
                        : "."}
                    </>
                  )}
                </p>
              </>
            )}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-gray-700">
                Status
              </legend>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setBulkStatus(status)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${bulkStatus === status ? statusStyle[status] : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"}`}
                    aria-pressed={bulkStatus === status}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                Comment{" "}
                <span className="font-normal text-gray-400">(optional)</span>
              </span>
              <textarea
                rows={3}
                value={bulkComment}
                onChange={(event) => setBulkComment(event.target.value)}
                placeholder="Add a comment for this attendance record"
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
              />
            </label>
          </div>
          <div className="flex shrink-0 gap-3 border-t border-gray-100 bg-white px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={mode === "employees" ? onSaveEmployees : onSaveDays}
              disabled={
                saving ||
                (mode === "employees"
                  ? selectedEmployeeIds.length === 0
                  : bulkEmployeeIds.length === 0 || bulkTotalRecords === 0)
              }
              className="flex-1 rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-orange/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Attendance"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
