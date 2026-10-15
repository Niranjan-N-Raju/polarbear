"use client";

import { useEffect, useState } from "react";
import {
  faCalendarDay,
  faCircleCheck,
  faCircleXmark,
} from "@fortawesome/free-solid-svg-icons";
import { SummaryCard } from "@/app/components/SummaryCard";
import { MobileSummaryDrawer } from "@/app/components/MobileSummaryDrawer";
import { useStoreModal } from "@/app/(app)/store-context";
import { isEmployeeActiveOn } from "@/lib/employee-status";
import { localDateValue } from "@/lib/date-utils";
import type { AttendanceStatus } from "@/types/attendance";
import { AttendanceCalendar } from "./components/AttendanceCalendar";
import {
  AttendanceDetailsDrawer,
  type AttendancePerson,
} from "./components/AttendanceDetailsDrawer";
import { AttendanceEntryDrawer } from "./components/AttendanceEntryDrawer";
import { WeeklyRosterDrawer } from "./components/WeeklyRosterDrawer";
import { useAttendanceData } from "./hooks/useAttendanceData";
import {
  cycleRangeLabel,
  formatDate,
  monthLabel,
  monthValue,
  periodForDate,
  STATUS_OPTIONS,
} from "./utils";

export default function AttendancePage() {
  const { activeStoreId } = useStoreModal();
  const [month, setMonth] = useState(monthValue(new Date()));
  const [selectedDate, setSelectedDate] = useState(localDateValue());
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWeeklyRoster, setShowWeeklyRoster] = useState(false);
  const [bulkMode, setBulkMode] = useState<"employees" | "days">("employees");
  const [bulkDate, setBulkDate] = useState(selectedDate);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeMenuOpen, setEmployeeMenuOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>("Present");
  const [bulkComment, setBulkComment] = useState("");
  const [bulkEmployeeIds, setBulkEmployeeIds] = useState<string[]>([]);
  const [bulkEmployeeMenuOpen, setBulkEmployeeMenuOpen] = useState(false);
  const [bulkFromDate, setBulkFromDate] = useState(selectedDate);
  const [bulkToDate, setBulkToDate] = useState(selectedDate);
  const [detailsDate, setDetailsDate] = useState<string | null>(null);
  const [draggedEmployeeId, setDraggedEmployeeId] = useState<string | null>(
    null,
  );
  const [dragOverStatus, setDragOverStatus] = useState<AttendanceStatus | null>(
    null,
  );
  const {
    employees,
    records,
    cycle,
    loading,
    saving,
    loadMonth,
    removingAttendanceId,
    updatingStatusId,
    removeAttendance,
    moveAttendanceStatus,
    saveBulkAttendance,
    saveDaysAttendance,
  } = useAttendanceData({ activeStoreId, month, setMonth });

  useEffect(() => {
    document.title = "Attendance · Polar Bear";
  }, []);

  function daySummary(date: string) {
    const dayRecords = records.filter(
      (record) =>
        record.date === date &&
        (employeeFilter === "all" || record.employeeId === employeeFilter),
    );
    return STATUS_OPTIONS.reduce(
      (summary, status) => {
        summary[status] = dayRecords.filter(
          (record) => record.status === status,
        ).length;
        return summary;
      },
      { Present: 0, "Week Off": 0, Absent: 0 } as Record<
        AttendanceStatus,
        number
      >,
    );
  }
  // `records` are already scoped to the current cycle range by useAttendanceData, so no date filter is needed here.
  function periodSummary() {
    const periodRecords = records.filter(
      (record) => employeeFilter === "all" || record.employeeId === employeeFilter,
    );
    return STATUS_OPTIONS.reduce(
      (summary, status) => {
        summary[status] = periodRecords.filter(
          (record) => record.status === status,
        ).length;
        return summary;
      },
      { Present: 0, "Week Off": 0, Absent: 0 } as Record<
        AttendanceStatus,
        number
      >,
    );
  }
  function dayDetails(date: string) {
    return STATUS_OPTIONS.reduce(
      (grouped, status) => {
        grouped[status] = records
          .filter((record) => record.date === date && record.status === status)
          .map((record): AttendancePerson => {
            const employee = employees.find(
              (item) => item._id === record.employeeId,
            );
            return {
              employeeId: record.employeeId,
              name: employee?.name ?? "Unknown",
              comment: record.comment,
              archived: employee?.isActive === false,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        return grouped;
      },
      {} as Record<AttendanceStatus, AttendancePerson[]>,
    );
  }
  // Eligible employees with no attendance record for this date — unmarked, pending a drag into a status.
  function unmarkedForDate(date: string) {
    const markedIds = new Set(
      records.filter((record) => record.date === date).map((record) => record.employeeId),
    );
    return employees
      .filter(
        (employee) =>
          (employeeFilter === "all" || employee._id === employeeFilter) &&
          !markedIds.has(employee._id) &&
          isEmployeeActiveOn(employee, date),
      )
      .map(
        (employee): AttendancePerson => ({
          employeeId: employee._id,
          name: employee.name,
          comment: "",
          archived: employee.isActive === false,
        }),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  function openAddModal() {
    const today = localDateValue();
    setBulkMode("employees");
    setBulkDate(today);
    setSelectedEmployeeIds([]);
    setEmployeeMenuOpen(false);
    setBulkStatus("Present");
    setBulkComment("");
    setBulkEmployeeIds([]);
    setBulkEmployeeMenuOpen(false);
    setBulkFromDate(today);
    setBulkToDate(today);
    setShowAddModal(true);
  }
  function updateBulkDate(nextDate: string) {
    setBulkDate(nextDate);
    setSelectedEmployeeIds((current) =>
      current.filter((id) => {
        const employee = employees.find((item) => item._id === id);
        return employee ? isEmployeeActiveOn(employee, nextDate) : false;
      }),
    );
  }
  // Keep the "To" date from silently becoming an invalid stale value if "From" moves past it.
  function updateBulkFromDate(nextFromDate: string) {
    setBulkFromDate(nextFromDate);
    setBulkToDate((currentTo) => (nextFromDate > currentTo ? nextFromDate : currentTo));
  }
  function goToMonth(nextMonth: string) {
    setMonth(nextMonth);
    const today = new Date();
    const todayPeriod = cycle
      ? periodForDate(today, cycle.type, cycle.startDay)
      : monthValue(today);
    setSelectedDate(
      todayPeriod === nextMonth ? localDateValue(today) : `${nextMonth}-01`,
    );
  }
  function moveMonth(amount: number) {
    const [year, monthNumber] = month.split("-").map(Number);
    goToMonth(monthValue(new Date(year, monthNumber - 1 + amount, 1)));
  }
  function afterSave(lastDate: string) {
    setShowAddModal(false);
    setSelectedDate(lastDate);
    setMonth(
      cycle
        ? periodForDate(
            new Date(`${lastDate}T00:00:00`),
            cycle.type,
            cycle.startDay,
          )
        : lastDate.slice(0, 7),
    );
  }
  const daySummaryCounts = daySummary(selectedDate);
  const summaryCards = [
    { label: "Present" as const, value: daySummaryCounts.Present, color: "teal" as const, icon: faCircleCheck, subtitle: `on ${formatDate(selectedDate)}` },
    { label: "Week Off" as const, value: daySummaryCounts["Week Off"], color: "orange" as const, icon: faCalendarDay, subtitle: `on ${formatDate(selectedDate)}` },
    { label: "Absent" as const, value: daySummaryCounts.Absent, color: "orange" as const, icon: faCircleXmark, subtitle: `on ${formatDate(selectedDate)}` },
  ];
  const periodSummaryCounts = periodSummary();
  const periodLabel = cycle ? cycleRangeLabel(cycle) : monthLabel(month);
  const periodSummaryCards = [
    { label: "Present (period)" as const, value: periodSummaryCounts.Present, color: "teal" as const, icon: faCircleCheck, subtitle: periodLabel },
    { label: "Week Off (period)" as const, value: periodSummaryCounts["Week Off"], color: "orange" as const, icon: faCalendarDay, subtitle: periodLabel },
    { label: "Absent (period)" as const, value: periodSummaryCounts.Absent, color: "orange" as const, icon: faCircleXmark, subtitle: periodLabel },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-brand-beige bg-white/80 p-6 shadow-[0_10px_30px_rgba(36,50,58,0.05)]">
        <div>
          <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange sm:block">
            People operations
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
            Attendance
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Track attendance by employee and day.
          </p>
        </div>
        <div className="flex flex-nowrap items-end gap-2 sm:flex-wrap sm:gap-3">
          <label className="block min-w-0 flex-1 sm:flex-none">
            <span className="mb-1 block text-xs font-medium text-gray-500">
              Employee
            </span>
            <select
              value={employeeFilter}
              onChange={(event) => setEmployeeFilter(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange sm:w-auto"
            >
              <option value="all">All employees</option>
                {employees.filter((employee) => employee.isActive !== false).map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {employee.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setShowWeeklyRoster(true)}
            disabled={!activeStoreId || employees.filter((employee) => employee.isActive !== false).length === 0}
            className="shrink-0 whitespace-nowrap rounded-lg border border-brand-orange px-4 py-2 text-sm font-medium text-brand-orange hover:bg-brand-peach disabled:cursor-not-allowed disabled:opacity-60"
          >
            Weekly Roster
          </button>
          <button
            type="button"
            onClick={openAddModal}
            disabled={!activeStoreId || employees.length === 0}
            className="shrink-0 whitespace-nowrap rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white hover:bg-brand-orange/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            + Add Attendance
          </button>
        </div>
      </div>
      <div className="hidden sm:block">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
          Today
        </p>
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {summaryCards.map((card) => (
            <SummaryCard
              key={card.label}
              label={card.label}
              value={card.value}
              color={card.color}
              icon={card.icon}
              subtitle={card.subtitle}
            />
          ))}
        </div>
      </div>
      <div className="hidden sm:block">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
          {periodLabel}
        </p>
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {periodSummaryCards.map((card) => (
            <SummaryCard
              key={card.label}
              label={card.label}
              value={card.value}
              color={card.color}
              icon={card.icon}
              subtitle={card.subtitle}
            />
          ))}
        </div>
      </div>
      <MobileSummaryDrawer cards={[...summaryCards, ...periodSummaryCards]} />
      {!activeStoreId ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          Select a store to view attendance.
        </div>
      ) : (
        <AttendanceCalendar
          cycle={cycle}
          month={month}
          selectedDate={selectedDate}
          loading={loading}
          records={records}
          employeeFilter={employeeFilter}
          onSelect={(date) => {
            setSelectedDate(date);
            setDetailsDate(date);
          }}
          onMoveMonth={moveMonth}
          onSelectMonth={goToMonth}
        />
      )}
      <AttendanceEntryDrawer
        open={showAddModal}
        mode={bulkMode}
        setMode={setBulkMode}
        bulkDate={bulkDate}
        setBulkDate={setBulkDate}
        selectedEmployeeIds={selectedEmployeeIds}
        setSelectedEmployeeIds={setSelectedEmployeeIds}
        employeeMenuOpen={employeeMenuOpen}
        setEmployeeMenuOpen={setEmployeeMenuOpen}
        bulkStatus={bulkStatus}
        setBulkStatus={setBulkStatus}
        bulkComment={bulkComment}
        setBulkComment={setBulkComment}
        bulkEmployeeIds={bulkEmployeeIds}
        setBulkEmployeeIds={setBulkEmployeeIds}
        bulkEmployeeMenuOpen={bulkEmployeeMenuOpen}
        setBulkEmployeeMenuOpen={setBulkEmployeeMenuOpen}
        bulkFromDate={bulkFromDate}
        setBulkFromDate={updateBulkFromDate}
        bulkToDate={bulkToDate}
        setBulkToDate={setBulkToDate}
        employees={employees}
        saving={saving}
        onClose={() => setShowAddModal(false)}
        onUpdateBulkDate={updateBulkDate}
        onSaveEmployees={() =>
          void saveBulkAttendance(
            bulkDate,
            selectedEmployeeIds,
            bulkStatus,
            bulkComment,
            () => afterSave(bulkDate),
          )
        }
        onSaveDays={() =>
          void saveDaysAttendance(
            bulkEmployeeIds,
            bulkFromDate,
            bulkToDate,
            bulkStatus,
            bulkComment,
            (lastDate) => afterSave(lastDate),
          )
        }
      />
      {showWeeklyRoster && activeStoreId && (
        <WeeklyRosterDrawer
          franchiseId={activeStoreId}
          employees={employees}
          onClose={() => setShowWeeklyRoster(false)}
          onSaved={() => void loadMonth()}
        />
      )}
      {detailsDate && (
        <AttendanceDetailsDrawer
          date={detailsDate}
          details={dayDetails(detailsDate)}
          unmarked={unmarkedForDate(detailsDate)}
          draggedEmployeeId={draggedEmployeeId}
          dragOverStatus={dragOverStatus}
          removingAttendanceId={removingAttendanceId}
          updatingStatusId={updatingStatusId}
          formatDate={formatDate}
          onClose={() => setDetailsDate(null)}
          onDragStart={(event, employeeId) => {
            event.dataTransfer.setData("text/plain", employeeId);
            event.dataTransfer.effectAllowed = "move";
            setDraggedEmployeeId(employeeId);
          }}
          onDragEnd={() => {
            setDraggedEmployeeId(null);
            setDragOverStatus(null);
          }}
          onDragOver={(event, status) => {
            if (draggedEmployeeId) {
              event.preventDefault();
              setDragOverStatus(status);
            }
          }}
          onDragLeave={(status) =>
            setDragOverStatus((current) =>
              current === status ? null : current,
            )
          }
          onDrop={(event, status) => {
            event.preventDefault();
            setDragOverStatus(null);
            const employeeId =
              event.dataTransfer.getData("text/plain") || draggedEmployeeId;
            if (employeeId)
              void moveAttendanceStatus(employeeId, detailsDate, status);
            setDraggedEmployeeId(null);
          }}
          onRemove={(employeeId) =>
            void removeAttendance(employeeId, detailsDate)
          }
        />
      )}
    </div>
  );
}
