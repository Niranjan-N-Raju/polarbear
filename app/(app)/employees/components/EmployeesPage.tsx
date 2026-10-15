"use client";

import { useCallback, useEffect, useState } from "react";
import { faArchive, faCircleCheck, faUsers } from "@fortawesome/free-solid-svg-icons";
import { useToast } from "@/app/hooks/useToast";
import { useStoreModal } from "@/app/(app)/store-context";
import { SummaryCard } from "@/app/components/SummaryCard";
import { MobileSummaryDrawer } from "@/app/components/MobileSummaryDrawer";
import {
  ArchiveIcon,
  CakeIcon,
  PencilIcon,
  SwitchIcon,
} from "@/app/components/icons";
import { DatePicker } from "@/app/components/DatePicker";
import { employeesRequest } from "../apicall/employees";
import EmployeeFormDrawer from "./EmployeeFormDrawer";
import type {
  ActiveStore,
  Employee,
} from "@/types/employees";
import {
  formatExitDate,
  formatJoiningDate,
  isBirthdayToday,
  todayISO,
} from "../utils";

export default function EmployeesPage() {
  useEffect(() => { document.title = "Employees · Polar Bear"; }, []);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { error, success } = useToast();
  const { activeStoreId } = useStoreModal();

  const [activeStore, setActiveStore] = useState<ActiveStore>({
    id: null,
    name: null,
  });

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>();
  const [employeeToArchive, setEmployeeToArchive] = useState<Employee | null>(null);
  const [exitDate, setExitDate] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [employeeToUnarchive, setEmployeeToUnarchive] = useState<Employee | null>(null);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [employeeTab, setEmployeeTab] = useState<"active" | "archived">("active");

  const loadEmployees = useCallback(
    (franchiseId: string | null) => {
      setLoading(true);
      setHasError(false);
      const url = franchiseId
        ? `/api/users?franchiseId=${encodeURIComponent(franchiseId)}&includeArchived=true&limit=500`
        : "/api/users?includeArchived=true&limit=500";
      return employeesRequest(url)
        .then((r) => r.json())
        .then((data: { users?: Employee[]; message?: string }) => {
          if (data.users) {
            setHasError(false);
            setEmployees(data.users);
          } else {
            setHasError(true);
            error(data.message ?? "Failed to load employees.");
          }
        })
        .catch(() => {
          setHasError(true);
          error("Failed to load employees.");
        })
        .finally(() => setLoading(false));
    },
    [error],
  );

  // Re-fetch employees and active store name whenever the selected store changes.
  useEffect(() => {
    employeesRequest("/api/stores/active")
      .then((r) => r.json())
      .then((data: ActiveStore) => {
        setActiveStore(data);
        return loadEmployees(activeStoreId ?? data.id);
      })
      .catch(() => {
        loadEmployees(activeStoreId);
      });
  }, [activeStoreId, loadEmployees]);

  function openModal(employee?: Employee) {
    setEditingEmployee(employee);
    setShowModal(true);
  }

  async function archiveEmployee() {
    if (!employeeToArchive) return;
    setArchiving(true);
    try {
      const res = await employeesRequest(`/api/users/${employeeToArchive._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exitDate }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        error(data.message ?? "Failed to archive employee.");
        return;
      }
      setEmployeeToArchive(null);
      success("Employee archived successfully.");
      await loadEmployees(activeStore.id);
    } catch {
      error("Failed to archive employee. Please try again.");
    } finally {
      setArchiving(false);
    }
  }

  async function unarchiveEmployee() {
    if (!employeeToUnarchive) return;
    setUnarchivingId(employeeToUnarchive._id);
    try {
      const response = await employeesRequest(`/api/users/${employeeToUnarchive._id}`, {
        method: "PUT",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        error(data.message ?? "Failed to unarchive employee.");
        return;
      }
      setEmployeeToUnarchive(null);
      success("Employee unarchived successfully.");
      await loadEmployees(activeStore.id);
    } catch {
      error("Failed to unarchive employee. Please try again.");
    } finally {
      setUnarchivingId(null);
    }
  }

  const filteredEmployees = employees.filter((employee) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      employee.name.toLowerCase().includes(normalizedSearch) ||
      employee.phone?.toLowerCase().includes(normalizedSearch);
    const matchesStatus =
      employeeTab === "active"
        ? employee.isActive !== false
        : employee.isActive === false;
    return matchesSearch && matchesStatus;
  });
  const employeesInTab = employees.filter((employee) =>
    employeeTab === "active" ? employee.isActive !== false : employee.isActive === false,
  );
  const employeeWord = employeesInTab.length === 1 ? "employee" : "employees";
  const employeeCount = employeesInTab.length > 0 ? String(employeesInTab.length) : "No";
  const countLabel = loading ? "Loading…" : `${employeeCount} ${employeeWord}`;
  const hasFilters = searchTerm !== "";
  const activeEmployeeCount = employees.filter((employee) => employee.isActive !== false).length;
  const formerEmployeeCount = employees.filter((employee) => employee.isActive === false).length;
  const summaryCards = [
    { label: "Total Employees", value: employees.length, color: "teal" as const, icon: faUsers },
    { label: "Active Employees", value: activeEmployeeCount, color: "orange" as const, icon: faCircleCheck },
    { label: "Former Employees", value: formerEmployeeCount, color: "yellow" as const, icon: faArchive },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-nowrap items-center justify-between gap-3 rounded-2xl border border-brand-beige bg-white/80 p-4 shadow-[0_10px_30px_rgba(36,50,58,0.05)] sm:p-6">
        <div className="min-w-0">
          <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-brand-teal sm:block">People operations</p>
          <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:mt-2 sm:text-3xl">Employees</h2>
          <p className="mt-1 text-xs text-gray-500 sm:mt-2 sm:text-sm">{countLabel}</p>
        </div>
        <button
          onClick={() => void openModal()}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap bg-brand-orange text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-brand-orange/90 transition sm:gap-2 sm:px-4"
        >
          <span aria-hidden="true">+</span> <span className="sm:hidden">Add</span><span className="hidden sm:inline">Add Employee</span>
        </button>
      </div>

      {!loading && !hasError && (
        <div className="hidden gap-3 sm:grid sm:grid-cols-3 sm:gap-4">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} label={card.label} value={card.value} color={card.color} icon={card.icon} />
          ))}
        </div>
      )}
      {!loading && !hasError && <MobileSummaryDrawer cards={summaryCards} />}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && !hasError && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200 px-6" role="tablist" aria-label="Employee status">
            {[
              { value: "active" as const, label: "Active Employees" },
              { value: "archived" as const, label: "Archived Employees" },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={employeeTab === tab.value}
                onClick={() => {
                  setEmployeeTab(tab.value);
                  setSearchTerm("");
                }}
                className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
                  employeeTab === tab.value
                    ? "border-brand-orange text-brand-orange"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3 border-b border-gray-100 px-6 py-4">
            <label className="min-w-56 flex-1">
              <span className="mb-1 block text-xs font-medium text-gray-500">Search employees</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name or phone"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
              />
            </label>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear filters
              </button>
            )}
          </div>
          {employeesInTab.length === 0 ? (
            <div className="px-6 py-16 text-center text-gray-400 text-sm">
              {employeeTab === "active"
                ? "No active employees found."
                : "No archived employees found."}
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="px-6 py-16 text-center text-gray-400 text-sm">
              No employees match the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-brand-sand/50 border-b border-brand-beige">
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Name</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Phone</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Position</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Salary</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Joined</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                    {employeeTab === "archived" && (
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Exit Date</th>
                    )}
                    <th className="text-right px-5 py-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-beige/60">
                  {filteredEmployees.map((emp) => (
                    <tr
                      key={emp._id}
                      className={`transition ${
                        isBirthdayToday(emp)
                          ? "bg-brand-sky/10 hover:bg-brand-sky/20"
                          : "hover:bg-brand-sand/20"
                      }`}
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <span>{emp.name}</span>
                          {isBirthdayToday(emp) && (
                            <span
                              className="text-brand-orange"
                              aria-label={`${emp.name}'s birthday is today`}
                              title="Birthday today"
                            >
                              <CakeIcon className="h-5 w-5" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {emp.phone?.trim() ? emp.phone : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {emp.position?.trim() ? emp.position : "—"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-gray-600">
                        {emp.salary !== undefined
                          ? `₹${emp.salary.toLocaleString("en-IN")}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {formatJoiningDate(emp.dateOfJoining)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            emp.isActive
                              ? "bg-[#E8E4D7] text-brand-teal"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {emp.isActive ? "Active" : "Archived"}
                        </span>
                      </td>
                      {employeeTab === "archived" && (
                        <td className="px-5 py-3.5 text-gray-600">{formatExitDate(emp.archivedAt)}</td>
                      )}
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openModal(emp)}
                            aria-label={`Edit ${emp.name}`}
                            className="group relative rounded-md p-1.5 text-brand-teal transition hover:bg-brand-sand hover:text-brand-sky"
                          >
                            <PencilIcon className="h-4 w-4" />
                            <span className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 hidden whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] group-hover:block group-focus-visible:block">
                              Edit
                            </span>
                          </button>
                          {employeeTab === "active" ? (
                            <button
                              type="button"
                              onClick={() => { setEmployeeToArchive(emp); setExitDate(todayISO()); }}
                              aria-label={`Archive ${emp.name}`}
                              className="group relative rounded-md p-1.5 text-brand-orange transition hover:bg-brand-orange/10 hover:text-brand-orange"
                            >
                              <ArchiveIcon className="h-4 w-4" />
                              <span className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 hidden whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] group-hover:block group-focus-visible:block">
                                Archive
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEmployeeToUnarchive(emp)}
                              disabled={unarchivingId === emp._id}
                              aria-label={`Unarchive ${emp.name}`}
                              className="group relative rounded-md p-1.5 text-brand-teal transition hover:bg-brand-sand hover:text-brand-sky disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <SwitchIcon className="h-4 w-4" />
                              <span className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 hidden whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] group-hover:block group-focus-visible:block">
                                Unarchive
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {employeeToArchive && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            aria-hidden="true"
            onClick={() => !archiving && setEmployeeToArchive(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="archive-employee-title"
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            >
              <h3 id="archive-employee-title" className="text-lg font-semibold text-gray-900">
                Archive employee?
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Archive {employeeToArchive.name}? They will no longer appear in the active employee list.
              </p>
              <label className="mt-4 block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Exit date</span>
                <DatePicker
                  value={exitDate}
                  max={todayISO()}
                  onChange={setExitDate}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                />
              </label>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEmployeeToArchive(null)}
                  disabled={archiving}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void archiveEmployee()}
                  disabled={archiving}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {archiving ? "Archiving…" : "Archive employee"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {employeeToUnarchive && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            aria-hidden="true"
            onClick={() => !unarchivingId && setEmployeeToUnarchive(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="unarchive-employee-title"
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            >
              <h3
                id="unarchive-employee-title"
                className="text-lg font-semibold text-gray-900"
              >
                Unarchive employee?
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Unarchive {employeeToUnarchive.name}? They will return to the active employee list.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEmployeeToUnarchive(null)}
                  disabled={Boolean(unarchivingId)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void unarchiveEmployee()}
                  disabled={Boolean(unarchivingId)}
                  className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {unarchivingId ? "Unarchiving…" : "Unarchive employee"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <EmployeeFormDrawer
          activeStore={activeStore}
          employee={editingEmployee}
          onClose={() => {
            setShowModal(false);
            setEditingEmployee(undefined);
          }}
          onSaved={() => loadEmployees(activeStore.id)}
        />
      )}
    </div>
  );
}
