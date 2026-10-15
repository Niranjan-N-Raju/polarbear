import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/app/hooks/useToast";
import { isEmployeeActiveOn } from "@/lib/employee-status";
import type { AttendanceCycleRange, AttendanceEmployee, AttendanceRecord, AttendanceStatus } from "@/types/attendance";
import { enumerateDates, monthValue, periodForDate } from "../utils";
import { attendanceRequest } from "../apicall/attendance";

interface UseAttendanceDataOptions {
  activeStoreId: string | null;
  month: string;
  setMonth: (month: string) => void;
}

export function useAttendanceData({ activeStoreId, month, setMonth }: UseAttendanceDataOptions) {
  const { error, success } = useToast();
  const [employees, setEmployees] = useState<AttendanceEmployee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [cycle, setCycle] = useState<AttendanceCycleRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingAttendanceId, setRemovingAttendanceId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeStoreId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await attendanceRequest(`/api/stores/cycle?franchiseId=${encodeURIComponent(activeStoreId)}&period=${monthValue(new Date())}`);
        const result = await response.json() as { cycle?: { type: "calendar_month" | "custom"; startDay: number } };
        if (!response.ok || !result.cycle || cancelled) return;
        setMonth(periodForDate(new Date(), result.cycle.type, result.cycle.startDay));
      } catch {
        // fall back to the plain calendar month already set as the default
      }
    })();
    return () => { cancelled = true; };
  }, [activeStoreId, setMonth]);

  const loadMonth = useCallback(async () => {
    if (!activeStoreId) { setEmployees([]); setRecords([]); setCycle(null); setLoading(false); return; }
    setLoading(true);
    try {
      const [employeeResponse, cycleResponse] = await Promise.all([
        attendanceRequest(`/api/users?franchiseId=${encodeURIComponent(activeStoreId)}&includeArchived=true&limit=500`),
        attendanceRequest(`/api/stores/cycle?franchiseId=${encodeURIComponent(activeStoreId)}&period=${month}`),
      ]);
      const employeeData = await employeeResponse.json() as { users?: AttendanceEmployee[]; message?: string };
      const cycleData = await cycleResponse.json() as { cycle?: AttendanceCycleRange; message?: string };
      if (!employeeResponse.ok) throw new Error(employeeData.message ?? "Failed to load employees.");
      if (!cycleResponse.ok || !cycleData.cycle) throw new Error(cycleData.message ?? "Failed to load salary cycle.");
      const range = cycleData.cycle;
      setCycle(range);
      const attendanceResponse = await attendanceRequest(`/api/attendance?franchiseId=${encodeURIComponent(activeStoreId)}&from=${range.from}&to=${range.to}`);
      const attendanceData = await attendanceResponse.json() as { records?: AttendanceRecord[]; message?: string };
      if (!attendanceResponse.ok) throw new Error(attendanceData.message ?? "Failed to load attendance.");
      setEmployees(employeeData.users ?? []);
      setRecords(attendanceData.records ?? []);
    } catch (loadError) {
      error(loadError instanceof Error ? loadError.message : "Failed to load attendance.");
    } finally { setLoading(false); }
  }, [activeStoreId, error, month]);

  useEffect(() => { queueMicrotask(() => { void loadMonth(); }); }, [loadMonth]);

  async function removeAttendance(employeeId: string, date: string) {
    if (!activeStoreId) return;
    setRemovingAttendanceId(employeeId);
    try {
      const response = await attendanceRequest(`/api/attendance?franchiseId=${encodeURIComponent(activeStoreId)}&date=${date}&employeeId=${employeeId}`, { method: "DELETE" });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to remove attendance.");
      setRecords((current) => current.filter((record) => !(record.date === date && record.employeeId === employeeId)));
      success(data.message ?? "Attendance record removed.");
    } catch (removeError) {
      error(removeError instanceof Error ? removeError.message : "Failed to remove attendance.");
    } finally { setRemovingAttendanceId(null); }
  }

  async function moveAttendanceStatus(employeeId: string, date: string, nextStatus: AttendanceStatus) {
    if (!activeStoreId) return;
    const existing = records.find((record) => record.date === date && record.employeeId === employeeId);
    if (existing && existing.status === nextStatus) return;
    setUpdatingStatusId(employeeId);
    try {
      const comment = existing?.comment ?? "";
      const response = await attendanceRequest("/api/attendance", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ franchiseId: activeStoreId, date, records: [{ employeeId, status: nextStatus, comment }] }) });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to update attendance.");
      setRecords((current) =>
        existing
          ? current.map((record) => record.date === date && record.employeeId === employeeId ? { ...record, status: nextStatus } : record)
          : [...current, { employeeId, date, status: nextStatus, comment }],
      );
      success(data.message ?? "Attendance updated.");
    } catch (moveError) {
      error(moveError instanceof Error ? moveError.message : "Failed to update attendance.");
    } finally { setUpdatingStatusId(null); }
  }

  async function saveBulkAttendance(date: string, employeeIds: string[], status: AttendanceStatus, comment: string, onSaved: () => void) {
    if (!activeStoreId || employeeIds.length === 0) return;
    setSaving(true);
    try {
      const response = await attendanceRequest("/api/attendance", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ franchiseId: activeStoreId, date, records: employeeIds.map((employeeId) => ({ employeeId, status, comment })) }) });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to save attendance.");
      onSaved();
      success(data.message ?? "Attendance saved successfully.");
      await loadMonth();
    } catch (saveError) {
      error(saveError instanceof Error ? saveError.message : "Failed to save attendance.");
    } finally { setSaving(false); }
  }

  async function saveDaysAttendance(employeeIds: string[], fromDate: string, toDate: string, status: AttendanceStatus, comment: string, onSaved: (lastDate: string) => void) {
    if (!activeStoreId || employeeIds.length === 0 || fromDate > toDate) return;
    const selectedEmployees = employeeIds
      .map((id) => employees.find((item) => item._id === id))
      .filter((employee): employee is AttendanceEmployee => Boolean(employee));
    const dates = enumerateDates(fromDate, toDate);
    let recordCount = 0;
    let skippedCount = 0;
    setSaving(true);
    try {
      for (const date of dates) {
        const dayEmployees = selectedEmployees.filter((employee) => isEmployeeActiveOn(employee, date));
        skippedCount += selectedEmployees.length - dayEmployees.length;
        if (dayEmployees.length === 0) continue;
        const response = await attendanceRequest("/api/attendance", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ franchiseId: activeStoreId, date, records: dayEmployees.map((employee) => ({ employeeId: employee._id, status, comment })) }) });
        const data = await response.json() as { message?: string };
        if (!response.ok) throw new Error(data.message ?? `Failed to save attendance for ${date}.`);
        recordCount += dayEmployees.length;
      }
      if (recordCount === 0) {
        error(
          skippedCount > 0
            ? "None of the selected employees were active on any date in this range — nothing was saved."
            : "No dates in this range are eligible — nothing was saved.",
        );
        return;
      }
      onSaved(toDate);
      success(
        `Attendance saved for ${recordCount} record${recordCount === 1 ? "" : "s"}.` +
          (skippedCount > 0 ? ` ${skippedCount} employee/day combination${skippedCount === 1 ? "" : "s"} were skipped because the employee wasn't active on that date.` : ""),
      );
      await loadMonth();
    } catch (saveError) {
      error(saveError instanceof Error ? saveError.message : "Failed to save attendance.");
    } finally { setSaving(false); }
  }

  return { employees, records, cycle, loading, saving, removingAttendanceId, updatingStatusId, loadMonth, removeAttendance, moveAttendanceStatus, saveBulkAttendance, saveDaysAttendance };
}
