import type { AttendanceCycleRange, AttendanceRecord, AttendanceStatus } from "@/types/attendance";
import { cycleRangeLabel, enumerateDates, monthLabel, monthNames, STATUS_OPTIONS, weekdayLabels } from "../utils";

type Summary = Record<AttendanceStatus, number>;
interface Props { cycle: AttendanceCycleRange | null; month: string; selectedDate: string; loading: boolean; records: AttendanceRecord[]; employeeFilter: string; onSelect: (date: string) => void; onMoveMonth: (amount: number) => void; onSelectMonth: (month: string) => void; }

export function AttendanceCalendar({ cycle, month, selectedDate, loading, records, employeeFilter, onSelect, onMoveMonth, onSelectMonth }: Props) {
  const cycleDates = cycle ? enumerateDates(cycle.from, cycle.to) : [];
  const leadingBlanks = cycle ? (new Date(`${cycle.from}T00:00:00`).getDay() + 6) % 7 : 0;
  const calendarCells: (string | null)[] = [...Array.from({ length: leadingBlanks }, () => null), ...cycleDates];
  const [viewYear, viewMonthNumber] = month.split("-").map(Number);
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, index) => currentYear - 5 + index);
  function summary(date: string): Summary {
    const dayRecords = records.filter((record) => record.date === date && (employeeFilter === "all" || record.employeeId === employeeFilter));
    return STATUS_OPTIONS.reduce((result, status) => { result[status] = dayRecords.filter((record) => record.status === status).length; return result; }, { Present: 0, "Week Off": 0, Absent: 0 } as Summary);
  }
  return <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
    <div className="border-b border-gray-100 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => onMoveMonth(-1)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Previous</button>
        <div className="flex items-center gap-2">
          <select
            aria-label="Select month"
            value={viewMonthNumber - 1}
            onChange={(event) => onSelectMonth(`${viewYear}-${String(Number(event.target.value) + 1).padStart(2, "0")}`)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
          >
            {monthNames.map((name, index) => <option key={name} value={index}>{name}</option>)}
          </select>
          <select
            aria-label="Select year"
            value={viewYear}
            onChange={(event) => onSelectMonth(`${event.target.value}-${String(viewMonthNumber).padStart(2, "0")}`)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
          >
            {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => onMoveMonth(1)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Next</button>
      </div>
      <p className="mt-2 text-center text-xs text-gray-500">{cycle ? cycleRangeLabel(cycle) : monthLabel(month)}</p>
    </div>
    <div className="grid grid-cols-7 border-b border-gray-100 bg-brand-sand text-center text-xs font-medium uppercase text-gray-500">{weekdayLabels.map((label) => <div key={label} className="px-2 py-3">{label}</div>)}</div>
    {loading ? <p className="px-6 py-12 text-center text-sm text-gray-500">Loading attendance…</p> : <div className="grid grid-cols-7">{calendarCells.map((date, index) => {
      if (!date) return <div key={`blank-${index}`} className="min-h-20 border-b border-r border-gray-100 bg-gray-50/50 sm:min-h-28" />;
      const counts = summary(date); const selected = date === selectedDate; const dayNumber = Number(date.slice(8));
      const dayLabel = index === 0 || dayNumber === 1 ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00`)) : String(dayNumber);
      return <button key={date} type="button" onClick={() => onSelect(date)} className={`min-h-20 border-b border-r border-gray-100 p-2 text-left transition hover:bg-brand-peach/30 sm:min-h-28 ${selected ? "bg-brand-peach/40 ring-2 ring-inset ring-brand-orange" : "bg-white"}`}><span className="text-sm font-semibold text-gray-900">{dayLabel}</span><div className="mt-2 flex flex-nowrap items-center gap-1.5 text-[11px] font-semibold sm:hidden"><span className="text-brand-sky">{counts.Present}</span><span className="text-brand-orange">{counts["Week Off"]}</span><span className="text-red-600">{counts.Absent}</span></div><div className="mt-3 hidden space-y-1 text-[11px] text-gray-500 sm:block"><p className="text-brand-teal">Present {counts.Present}</p><p className="text-brand-orange">Week Off {counts["Week Off"]}</p><p className="text-red-600">Absent {counts.Absent}</p></div></button>;
    })}</div>}
  </section>;
}
