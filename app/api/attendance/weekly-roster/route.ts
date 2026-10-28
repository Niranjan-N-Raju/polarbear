import mongoose from "mongoose";
import { readJsonObject } from "@/lib/request-json";
import { NextRequest, NextResponse } from "next/server";
import WeeklyRoster from "@/models/WeeklyRoster";
import Franchise from "@/models/Franchise";
import User from "@/models/User";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthorizedStoreAdminId, requireAuth } from "@/lib/api-auth";
import { validateCsrf } from "@/lib/csrf";
import { datesBetween, isValidDate, localDateValue } from "@/lib/date-utils";
import { isEmployeeActiveOn } from "@/lib/employee-status";

function resolveShift(
  day: { shift?: string; status?: string; startTime?: string; endTime?: string },
  shifts: { id: string; name: string; startTime: string; endTime: string }[],
): string {
  // Resolve old roster representations to the current configured shift IDs.
  if (day.shift === "off" || day.status === "off") return "off";
  const saved = shifts.find((shift) => shift.id === day.shift);
  if (saved) return saved.id;
  const legacy = shifts.find((shift) => shift.startTime === day.startTime && shift.endTime === day.endTime);
  if (legacy) return legacy.id;
  const legacyLabel = day.shift?.toLowerCase();
  const defaultTimes = legacyLabel === "night" ? ["17:00", "02:00"] : legacyLabel === "morning" ? ["09:00", "18:00"] : null;
  return defaultTimes
    ? shifts.find((shift) => shift.startTime === defaultTimes[0] && shift.endTime === defaultTimes[1])?.id ?? "off"
    : "off";
}

function getWeekDates(weekStart: string): string[] {
  const [year, month, day] = weekStart.split("-").map(Number);
  const weekEnd = new Date(year, month - 1, day + 6);
  const endValue = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, "0")}-${String(weekEnd.getDate()).padStart(2, "0")}`;
  return datesBetween(weekStart, endValue);
}

function validWeekStart(value: string): boolean {
  return isValidDate(value) && new Date(`${value}T00:00:00`).getDay() === 1;
}

function mondayOnOrBefore(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return localDateValue(date);
}

type RosterToSerialize = {
  weekStart: string;
  entries: Array<{
    employee: unknown;
    days: Array<{
      date: string;
      shift?: string;
      status?: string;
      startTime?: string;
      endTime?: string;
    }>;
  }>;
};

function serializeRoster(roster: RosterToSerialize, shifts: { id: string; name: string; startTime: string; endTime: string }[]) {
  return {
    weekStart: roster.weekStart,
    entries: roster.entries.map((entry) => ({
      employeeId: String(entry.employee),
      days: entry.days.map((day) => {
        const shiftId = resolveShift(day, shifts);
        const shift = shifts.find((item) => item.id === shiftId);
        return {
          date: day.date,
          shift: shiftId,
          shiftName: shift?.name ?? (shiftId === "off" ? "Off" : "Unconfigured shift"),
          startTime: shift?.startTime ?? "",
          endTime: shift?.endTime ?? "",
        };
      }),
    })),
  };
}

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const params = new URL(request.url).searchParams;
  const franchiseId = await getAuthorizedStoreAdminId(authResult, params.get("franchiseId"));
  const weekStart = params.get("weekStart") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const hasRange = isValidDate(from) && isValidDate(to) && from <= to;
  if (!franchiseId || (!validWeekStart(weekStart) && !hasRange)) {
    return NextResponse.json({ message: "A valid store and week start or date range are required." }, { status: 400 });
  }

  await connectToDatabase();
  const firstWeek = hasRange ? mondayOnOrBefore(from) : weekStart;
  const lastWeek = hasRange ? mondayOnOrBefore(to) : weekStart;
  const weekStarts: string[] = [];
  for (let cursor = firstWeek; cursor <= lastWeek; ) {
    weekStarts.push(cursor);
    const next = new Date(`${cursor}T00:00:00`);
    next.setDate(next.getDate() + 7);
    cursor = localDateValue(next);
  }
  const [rosters, store] = await Promise.all([
    WeeklyRoster.find({ franchise: franchiseId, weekStart: { $in: weekStarts } }).sort({ weekStart: 1 }).lean(),
    Franchise.findById(franchiseId).select("shifts").lean(),
  ]);
  const shifts = store?.shifts ?? [];
  return NextResponse.json({
    shifts,
    rosters: rosters.map((roster) => serializeRoster(roster, shifts)),
    roster: hasRange || !rosters[0] ? null : serializeRoster(rosters[0], shifts),
  });
}

export async function PUT(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const jsonBody = await readJsonObject<{
    franchiseId?: string;
    weekStart?: string;
    entries?: Array<{
      employeeId?: string;
      days?: Array<{ date?: string; shift?: string }>;
    }>;
  }>(request);
  if (jsonBody.response) return jsonBody.response;
  const body = jsonBody.body;
  const franchiseId = await getAuthorizedStoreAdminId(authResult, body.franchiseId);
  const weekStart = body.weekStart ?? "";
  if (!franchiseId || !validWeekStart(weekStart) || !Array.isArray(body.entries) || body.entries.length > 500) {
    return NextResponse.json({ message: "A valid store, Monday week start, and roster entries are required." }, { status: 400 });
  }

  const weekDates = getWeekDates(weekStart);
  if (weekDates.length !== 7) {
    return NextResponse.json({ message: "The roster week must contain seven days." }, { status: 400 });
  }
  const employeeIds = body.entries.map((entry) => entry.employeeId ?? "");
  if (employeeIds.some((id) => !mongoose.isValidObjectId(id)) || new Set(employeeIds).size !== employeeIds.length) {
    return NextResponse.json({ message: "Each roster employee must be valid and listed once." }, { status: 400 });
  }

  for (const entry of body.entries) {
    if (!Array.isArray(entry.days) || entry.days.length !== 7) {
      return NextResponse.json({ message: "Each employee must have one schedule for every day." }, { status: 400 });
    }
    const dates = entry.days.map((day) => day.date ?? "");
    if (new Set(dates).size !== 7 || weekDates.some((date) => !dates.includes(date))) {
      return NextResponse.json({ message: "Roster dates must match the selected week." }, { status: 400 });
    }
  }

  await connectToDatabase();
  const store = await Franchise.findById(franchiseId).select("shifts").lean();
  if (!store) return NextResponse.json({ message: "Store not found." }, { status: 404 });
  const validShiftIds = new Set((store.shifts ?? []).map((shift) => shift.id));
  for (const entry of body.entries) {
    if (entry.days?.some((day) => !day.shift || (day.shift !== "off" && !validShiftIds.has(day.shift)))) {
      return NextResponse.json({ message: "Choose a configured shift or mark the day off." }, { status: 400 });
    }
  }
  const employees = await User.find({
    _id: { $in: employeeIds },
    role: "employee",
    franchises: franchiseId,
    isActive: { $ne: false },
  }).select("_id dateOfJoining isActive archivedAt").lean();
  if (employees.length !== employeeIds.length) {
    return NextResponse.json({ message: "Roster employees must be active employees assigned to this store." }, { status: 400 });
  }

  const employeeById = new Map(employees.map((employee) => [String(employee._id), employee]));
  for (const entry of body.entries) {
    const employee = employeeById.get(entry.employeeId ?? "");
    if (employee && entry.days?.some((day) => day.shift !== "off" && !isEmployeeActiveOn(employee, day.date ?? ""))) {
      return NextResponse.json({ message: "Cannot schedule an employee outside their active employment dates." }, { status: 400 });
    }
  }

  const entries = body.entries.map((entry) => ({
    employee: new mongoose.Types.ObjectId(entry.employeeId),
    days: entry.days!.map((day) => ({
      date: day.date!,
      shift: day.shift as "morning" | "night" | "off",
    })),
  }));
  const createdBy = mongoose.isValidObjectId(authResult.id)
    ? new mongoose.Types.ObjectId(authResult.id)
    : null;
  if (!createdBy) {
    return NextResponse.json({ message: "A valid authenticated user is required." }, { status: 400 });
  }

  await WeeklyRoster.findOneAndUpdate(
    { franchise: franchiseId, weekStart },
    { $set: { entries }, $setOnInsert: { createdBy } },
    { new: true, upsert: true, runValidators: true },
  );

  return NextResponse.json({ message: "Weekly roster saved successfully." });
}