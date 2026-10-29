"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { OutlineCloseIcon } from "@/app/components/icons";
import { useDrawerClose } from "@/app/hooks/useDrawerClose";
import { useToast } from "@/app/hooks/useToast";
import { datesBetween, localDateValue } from "@/lib/date-utils";
import type { AttendanceEmployee } from "@/types/attendance";
import type { StoreShiftOption } from "@/types/store-config";
import type { WeeklyRosterData, WeeklyRosterDay } from "@/types/weekly-roster";
import { attendanceRequest } from "../apicall/attendance";

type EmployeeSchedule = { employeeId: string; days: WeeklyRosterDay[] };

function mondayOf(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return localDateValue(date);
}

function nextWeekStart(): string {
  return shiftWeek(mondayOf(localDateValue()), 1);
}

function shiftWeek(weekStart: string, amount: number): string {
  const date = new Date(`${weekStart}T00:00:00`);
  date.setDate(date.getDate() + amount * 7);
  return localDateValue(date);
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function defaultSchedule(employeeId: string, dates: string[], shifts: StoreShiftOption[]): EmployeeSchedule {
  return {
    employeeId,
    days: dates.map((date) => ({ date, shift: shifts[0]?.id ?? "" })),
  };
}

export function WeeklyRosterDrawer({
  franchiseId,
  employees,
  onClose,
  onSaved,
}: Readonly<{ franchiseId: string; employees: AttendanceEmployee[]; onClose: () => void; onSaved: () => void }>) {
  const { visible, requestClose } = useDrawerClose();
  const { error, success } = useToast();
  const close = () => requestClose(onClose);
  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.isActive !== false).sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
  );
  const [weekStart, setWeekStart] = useState(nextWeekStart);
  const weekDates = useMemo(() => {
    const start = new Date(`${weekStart}T00:00:00`);
    start.setDate(start.getDate() + 6);
    return datesBetween(weekStart, localDateValue(start));
  }, [weekStart]);
  const [schedules, setSchedules] = useState<EmployeeSchedule[]>([]);
  const [shifts, setShifts] = useState<StoreShiftOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadRoster = useCallback(async () => {
    setLoading(true);
    try {
      const response = await attendanceRequest(
        `/api/attendance/weekly-roster?franchiseId=${encodeURIComponent(franchiseId)}&weekStart=${encodeURIComponent(weekStart)}`,
      );
      const data = (await response.json()) as { roster?: WeeklyRosterData | null; shifts?: StoreShiftOption[]; message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to load weekly roster.");
      const availableShifts = data.shifts ?? [];
      setShifts(availableShifts);
      const savedByEmployee = new Map((data.roster?.entries ?? []).map((entry) => [entry.employeeId, entry.days]));
      setSchedules(
        activeEmployees.map((employee) => {
          const savedDays = savedByEmployee.get(employee._id);
          if (!savedDays) return defaultSchedule(employee._id, weekDates, availableShifts);
          const byDate = new Map(savedDays.map((day) => [day.date, day]));
          return {
            employeeId: employee._id,
            days: weekDates.map((date) => byDate.get(date) ?? { date, shift: availableShifts[0]?.id ?? "" }),
          };
        }),
      );
    } catch (loadError) {
      error(loadError instanceof Error ? loadError.message : "Failed to load weekly roster.");
      setShifts([]);
      setSchedules(activeEmployees.map((employee) => defaultSchedule(employee._id, weekDates, [])));
    } finally {
      setLoading(false);
    }
  }, [activeEmployees, error, franchiseId, weekDates, weekStart]);

  useEffect(() => {
    queueMicrotask(() => void loadRoster());
  }, [loadRoster]);

  function updateDay(employeeId: string, date: string, update: Partial<WeeklyRosterDay>) {
    setSchedules((current) => current.map((schedule) =>
      schedule.employeeId !== employeeId
        ? schedule
        : { ...schedule, days: schedule.days.map((day) => day.date === date ? { ...day, ...update } : day) },
    ));
  }

  function updateEmployeeWeek(employeeId: string, shift: string) {
    setSchedules((current) => current.map((schedule) =>
      schedule.employeeId !== employeeId
        ? schedule
        : { ...schedule, days: schedule.days.map((day) => ({ ...day, shift })) },
    ));
  }

  async function saveRoster() {
    if (shifts.length === 0) {
      error("Configure at least one shift in Store Config before saving the roster.");
      return;
    }
    if (schedules.some((schedule) => schedule.days.some((day) => day.shift !== "off" && day.shift !== "leave" && !shifts.some((shift) => shift.id === day.shift)))) {
      error("Choose a configured shift, day off, or leave for each day.");
      return;
    }
    setSaving(true);
    try {
      const response = await attendanceRequest("/api/attendance/weekly-roster", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ franchiseId, weekStart, entries: schedules }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to save weekly roster.");
      success(data.message ?? "Weekly roster saved.");
      onSaved();
      close();
    } catch (saveError) {
      error(saveError instanceof Error ? saveError.message : "Failed to save weekly roster.");
    } finally {
      setSaving(false);
    }
  }

  const weekEnd = weekDates[6];

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        style={{ height: "100vh" }}
        aria-hidden="true"
        onClick={close}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex justify-end">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="weekly-roster-title"
          className={`pointer-events-auto flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl transition-transform duration-200 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-brand-beige px-5 py-4 sm:px-6">
            <div>
              <h2 id="weekly-roster-title" className="text-lg font-semibold text-gray-900">Weekly Roster</h2>
              <p className="mt-1 text-sm text-gray-500">Set Monday to apply that shift for the week, then adjust any days individually.</p>
            </div>
            <button type="button" onClick={close} aria-label="Close weekly roster" className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-brand-sand">
              <OutlineCloseIcon className="h-4 w-4" />
            </button>
          </header>

          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-3 sm:px-6">
            <button type="button" onClick={() => setWeekStart((value) => shiftWeek(value, -1))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Previous week</button>
            <p className="text-center text-sm font-semibold text-gray-800">{dateLabel(weekStart)} – {weekEnd ? dateLabel(weekEnd) : ""}</p>
            <button type="button" onClick={() => setWeekStart((value) => shiftWeek(value, 1))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Next week</button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-orange border-t-transparent" />
              </div>
            ) : shifts.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-gray-600">No shifts have been configured for this store.</p>
                <Link href="/store-config" onClick={close} className="mt-3 inline-flex rounded-lg border border-brand-orange px-4 py-2 text-sm font-medium text-brand-orange hover:bg-brand-peach/40">Open Store Config</Link>
              </div>
            ) : activeEmployees.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-gray-500">No active employees in this store.</p>
            ) : (
              <table className="min-w-[1000px] table-fixed border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-brand-sand text-left text-xs font-semibold uppercase text-gray-600">
                  <tr>
                    <th className="sticky left-0 z-20 w-40 border-b border-r border-brand-beige bg-brand-sand px-3 py-3">Employee</th>
                    {weekDates.map((date) => (
                      <th key={date} className="w-[120px] border-b border-r border-brand-beige px-1 py-3 text-center">{dateLabel(date)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeEmployees.map((employee) => {
                    const schedule = schedules.find((item) => item.employeeId === employee._id);
                    return (
                      <tr key={employee._id} className="border-b border-gray-100 align-top">
                        <th scope="row" className="sticky left-0 z-[1] border-r border-gray-100 bg-white px-3 py-3 text-left text-sm font-medium text-gray-800">{employee.name}</th>
                        {weekDates.map((date) => {
                          const day = schedule?.days.find((item) => item.date === date);
                          if (!day) return <td key={date} className="border-r border-gray-100 px-2 py-2" />;
                          const selectedShift = shifts.find((shift) => shift.id === day.shift);
                          return (
                            <td key={date} className="border-r border-gray-100 px-2 py-2">
                              <select
                                aria-label={`${employee.name} shift for ${dateLabel(date)}`}
                                value={day.shift}
                                onChange={(event) => {
                                  const shift = event.target.value;
                                  if (date === weekDates[0] && shift !== "off" && shift !== "leave") updateEmployeeWeek(employee._id, shift);
                                  else updateDay(employee._id, date, { shift });
                                }}
                                className="w-full min-w-0 rounded-md border border-gray-300 bg-white px-1.5 py-1.5 text-[11px] text-gray-800 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                              >
                                <option value="" disabled>Select shift</option>
                                {shifts.map((shift) => (
                                  <option key={shift.id} value={shift.id}>{shift.name}</option>
                                ))}
                                <option value="off">Off</option>
                                <option value="leave">Leave</option>
                              </select>
                              <p className="mt-1 text-center text-[10px] text-gray-500">
                                {day.shift === "leave" ? "Leave" : day.shift === "off" ? "Day off" : selectedShift ? `${selectedShift.startTime}–${selectedShift.endTime}` : "Select a shift"}
                              </p>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <footer className="flex shrink-0 justify-end gap-3 border-t border-brand-beige bg-white p-4 sm:px-6">
            <button type="button" onClick={close} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={() => void saveRoster()} disabled={saving || loading || activeEmployees.length === 0} className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white hover:bg-brand-orange/90 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving…" : "Save Roster"}</button>
          </footer>
        </section>
      </div>
    </>
  );
}
