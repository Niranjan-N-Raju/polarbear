"use client";

import { useCallback, useEffect, useState } from "react";
import { faGift } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useStoreModal } from "@/app/(app)/store-context";
import { useToast } from "@/app/hooks/useToast";
import { salaryRequest } from "@/app/(app)/salary/apicall/salary";
import type { Employee } from "@/types/employees";
import SalaryHikeDrawer from "@/app/(app)/employees/components/SalaryHikeDrawer";

export default function SalaryHikesPage() {
  const { activeStoreId } = useStoreModal();
  const { error, success } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [changeMode, setChangeMode] = useState<'hike' | 'promotion'>('hike');
  const [positions, setPositions] = useState<string[]>([]);

  const loadEmployees = useCallback(async () => {
    if (!activeStoreId) { setEmployees([]); setLoading(false); return; }
    setLoading(true);
    try {
      const [response, positionsResponse] = await Promise.all([
        salaryRequest(`/api/users?franchiseId=${encodeURIComponent(activeStoreId)}&limit=500`),
        salaryRequest(`/api/stores/positions?franchiseId=${encodeURIComponent(activeStoreId)}`),
      ]);
      const result = await response.json() as { users?: Employee[]; message?: string };
      const positionsResult = await positionsResponse.json() as { positions?: string[] };
      if (!response.ok) throw new Error(result.message ?? "Unable to load employees.");
      setEmployees((result.users ?? []).filter((employee) => employee.role === "employee" && employee.isActive !== false).sort((a, b) => a.name.localeCompare(b.name)));
      if (!positionsResponse.ok) throw new Error("Unable to load store positions.");
      setPositions(positionsResult.positions ?? []);
    } catch (reason) { error(reason instanceof Error ? reason.message : "Unable to load employees."); }
    finally { setLoading(false); }
  }, [activeStoreId, error]);

  useEffect(() => { void loadEmployees(); }, [loadEmployees]);
  useEffect(() => { document.title = "Hikes & Promotions · Polar Bear"; }, []);

  const currency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
  const hikeSaved = () => { setSelectedEmployee(null); success(changeMode === 'promotion' ? "Employee promotion saved." : "Salary hike saved."); void loadEmployees(); };

  return <div className="space-y-6">
    <header className="flex items-center gap-3 rounded-xl border border-brand-beige bg-white p-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal"><FontAwesomeIcon icon={faGift} className="h-5 w-5" /></span>
      <div><h1 className="text-xl font-semibold text-gray-900">Hikes &amp; Promotions</h1><p className="mt-1 text-sm text-gray-500">Review employee salaries and record effective-dated hikes.</p></div>
    </header>
    <section className="overflow-hidden rounded-xl border border-brand-beige bg-white">
      <div className="flex items-center justify-between border-b border-brand-beige px-5 py-3"><h2 className="text-sm font-semibold text-gray-800">Active employees</h2><span className="text-xs text-gray-500">{employees.length} employees</span></div>
      {loading ? <div className="p-8 text-center text-sm text-gray-500">Loading employees…</div> : employees.length === 0 ? <p className="p-8 text-center text-sm text-gray-500">No active employees found.</p> : <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead><tr className="border-b border-brand-beige bg-brand-sand/50 text-left text-xs font-semibold text-gray-600"><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Position</th><th className="px-5 py-3">Current salary</th><th className="px-5 py-3">Latest approved</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
          <tbody className="divide-y divide-brand-beige/60">{employees.map((employee) => <tr key={employee._id} className="hover:bg-brand-sand/20">
            <td className="px-5 py-3.5 font-medium text-gray-900">{employee.name}{employee.employeeCode ? ` (${employee.employeeCode})` : ""}</td>
            <td className="px-5 py-3.5 text-gray-600">{employee.position || "—"}</td>
            <td className="px-5 py-3.5 tabular-nums text-gray-700">{currency(employee.salary ?? 0)}</td>
            <td className="px-5 py-3.5 tabular-nums text-gray-700">{currency(employee.latestSalary ?? employee.salary ?? 0)}</td>
            <td className="px-5 py-3.5 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => { setChangeMode('hike'); setSelectedEmployee(employee); }} className="min-h-10 rounded-lg border border-brand-orange px-3 py-2 text-xs font-medium text-brand-orange hover:bg-brand-orange/10">Salary hike</button><button type="button" onClick={() => { setChangeMode('promotion'); setSelectedEmployee(employee); }} className="min-h-10 rounded-lg bg-brand-orange px-3 py-2 text-xs font-medium text-white hover:bg-brand-orange/90">Promote</button></div></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
    {selectedEmployee && activeStoreId ? <SalaryHikeDrawer employee={selectedEmployee} storeId={activeStoreId} mode={changeMode} positions={positions} onClose={() => setSelectedEmployee(null)} onSaved={hikeSaved} /> : null}
  </div>;
}
