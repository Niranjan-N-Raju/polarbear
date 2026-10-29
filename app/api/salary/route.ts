import { NextRequest, NextResponse } from "next/server";
import { readJsonObject } from "@/lib/request-json";
import Attendance from "@/models/Attendance";
import Franchise from "@/models/Franchise";
import User from "@/models/User";
import Incentive from "@/models/Incentive";
import ExtraDay from "@/models/ExtraDay";
import Advance from "@/models/Advance";
import { connectToDatabase } from "@/lib/mongodb";
import { validateCsrf } from "@/lib/csrf";
import { getAuthorizedStoreAdminId, requireAuth } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit-log";
import { isValidPeriod, localDateValue, getCycleRange, resolveCycleSettings, roundCurrency } from "@/lib/salary-cycle";
import { datesBetween as enumerateDates } from "@/lib/date-utils";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const params = new URL(request.url).searchParams;
  const franchiseId = params.get("franchiseId") ?? "";
  const period = params.get("period") ?? "";
  if (!isValidPeriod(period)) {
    return NextResponse.json({ message: "A valid salary period is required." }, { status: 400 });
  }

  await connectToDatabase();
  if (!(await getAuthorizedStoreAdminId(auth, franchiseId))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  const store = await Franchise.findById(franchiseId)
    .select("name salaryCycleType salaryCycleStartDay salaryCycleEndDay salaryCycleConfiguredAt")
    .lean();
  if (!store) return NextResponse.json({ message: "Store not found." }, { status: 404 });

  const { cycleType, startDay, endDay } = resolveCycleSettings(store);
  const range = getCycleRange(period, cycleType, startDay);
  const cycleDates = enumerateDates(range.from, range.to);
  const today = localDateValue();

  const [employees, attendance, incentives, extraDays, advances] = await Promise.all([
    User.find({
      role: "employee",
      isActive: { $ne: false },
      franchises: franchiseId,
    })
      .select("name position employmentType salary dateOfJoining")
      .sort({ name: 1 })
      .lean(),
    Attendance.find({
      franchise: franchiseId,
      date: { $gte: range.from, $lte: range.to },
    }).lean(),
    Incentive.find({ franchise: franchiseId, period }).lean(),
    ExtraDay.find({ franchise: franchiseId, period }).lean(),
    Advance.find({ franchise: franchiseId, period }).lean(),
  ]);

  const attendanceByEmployee = new Map<string, Map<string, string>>();
  for (const record of attendance) {
    const employeeId = String(record.employee);
    const employeeRecords = attendanceByEmployee.get(employeeId) ?? new Map();
    employeeRecords.set(record.date, record.status);
    attendanceByEmployee.set(employeeId, employeeRecords);
  }

  const incentivesByEmployee = new Map<string, { id: string; type: string; amount: number; paidEarly: boolean }[]>();
  for (const incentive of incentives) {
    const employeeId = String(incentive.employee);
    const list = incentivesByEmployee.get(employeeId) ?? [];
    list.push({ id: String(incentive._id), type: incentive.type, amount: incentive.amount, paidEarly: incentive.paidEarly === true });
    incentivesByEmployee.set(employeeId, list);
  }

  const extraDaysByEmployee = new Map<string, { id: string; type: string; days: number }[]>();
  for (const extraDay of extraDays) {
    const employeeId = String(extraDay.employee);
    const list = extraDaysByEmployee.get(employeeId) ?? [];
    list.push({ id: String(extraDay._id), type: extraDay.type, days: extraDay.days });
    extraDaysByEmployee.set(employeeId, list);
  }

  const advancesByEmployee = new Map<string, { id: string; type: string; amount: number }[]>();
  for (const advance of advances) {
    const employeeId = String(advance.employee);
    const list = advancesByEmployee.get(employeeId) ?? [];
    list.push({ id: String(advance._id), type: advance.type, amount: advance.amount });
    advancesByEmployee.set(employeeId, list);
  }

  const projections = employees.map((employee) => {
    const employeeId = String(employee._id);
    const joiningDate = employee.dateOfJoining
      ? localDateValue(new Date(employee.dateOfJoining))
      : range.from;
    const payableDates = cycleDates.filter((date) => date >= joiningDate);
    const elapsedDates = payableDates.filter((date) => date <= today);
    const futureDays = payableDates.filter((date) => date > today).length;
    const records = attendanceByEmployee.get(employeeId) ?? new Map();
    const paidDays = elapsedDates.filter((date) => {
      const status = records.get(date);
      return status === "Present" || status === "Week Off";
    }).length;
    const absentDays = elapsedDates.filter((date) => records.get(date) === "Absent").length;
    const weekOffDays = elapsedDates.filter((date) => records.get(date) === "Week Off").length;
    const missingDays = elapsedDates.filter((date) => !records.has(date)).length;
    const salary = employee.salary ?? 0;
    const cycleDays = cycleDates.length;
    const projectedPaidDays = paidDays + futureDays;
    const employeeIncentives = incentivesByEmployee.get(employeeId) ?? [];
    const incentiveTotal = employeeIncentives.reduce((sum, item) => sum + item.amount, 0);
    const paidEarlyIncentiveTotal = roundCurrency(employeeIncentives.reduce((sum, item) => sum + (item.paidEarly ? item.amount : 0), 0));
    const employeeExtraDays = extraDaysByEmployee.get(employeeId) ?? [];
    const extraDaysTotal = employeeExtraDays.reduce((sum, item) => sum + item.days, 0);
    const employeeAdvances = advancesByEmployee.get(employeeId) ?? [];
    const advanceTotal = employeeAdvances.reduce((sum, item) => sum + item.amount, 0);

    // Salary is prorated across the full cycle; projectedSalary additionally
    // treats remaining eligible dates as paid until attendance is recorded.
    return {
      employeeId,
      name: employee.name,
      position: employee.position ?? "",
      employmentType: employee.employmentType ?? "",
      salary,
      paidDays,
      absentDays,
      weekOffDays,
      missingDays,
      futureDays,
      eligibleDays: payableDates.length,
      incentives: employeeIncentives,
      incentiveTotal,
      paidEarlyIncentiveTotal,
      extraDays: employeeExtraDays,
      extraDaysTotal,
      advances: employeeAdvances,
      advanceTotal,
      earnedSalary: roundCurrency((salary * (paidDays + extraDaysTotal)) / cycleDays) + incentiveTotal - advanceTotal - paidEarlyIncentiveTotal,
      projectedSalary: roundCurrency((salary * (projectedPaidDays + extraDaysTotal)) / cycleDays) + incentiveTotal - advanceTotal - paidEarlyIncentiveTotal,
    };
  });

  return NextResponse.json({
    store: { id: String(store._id), name: store.name },
    cycle: {
      configured: Boolean(store.salaryCycleConfiguredAt),
      type: cycleType,
      startDay,
      endDay,
      ...range,
      totalDays: cycleDates.length,
    },
    projections,
  });
}

export async function PUT(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const jsonBody = await readJsonObject<{
    franchiseId?: string;
    cycleType?: "calendar_month" | "custom";
    startDay?: number;
  }>(request);
  if (jsonBody.response) return jsonBody.response;
  const body = jsonBody.body;
  const franchiseId = body.franchiseId ?? "";
  const isCalendarMonth = body.cycleType === "calendar_month";
  if (
    (body.cycleType !== "calendar_month" && body.cycleType !== "custom") ||
    (!isCalendarMonth &&
      (!Number.isInteger(body.startDay) || body.startDay! < 2 || body.startDay! > 28))
  ) {
    return NextResponse.json(
      { message: "Choose a valid cycle type and a custom start day from 2 to 28." },
      { status: 400 },
    );
  }

  const startDay = isCalendarMonth ? 1 : body.startDay!;
  const endDay = isCalendarMonth ? 31 : startDay - 1;

  await connectToDatabase();
  if (!(await getAuthorizedStoreAdminId(auth, franchiseId))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  const store = await Franchise.findOneAndUpdate(
    { _id: franchiseId },
    {
      $set: {
        salaryCycleType: body.cycleType,
        salaryCycleStartDay: startDay,
        salaryCycleEndDay: endDay,
        salaryCycleConfiguredAt: new Date(),
      },
    },
    { new: true, runValidators: true },
  ).lean();
  if (!store) {
    return NextResponse.json({ message: "Store not found." }, { status: 404 });
  }

  auditLog("store.salary-cycle.updated", {
    actorId: auth.id,
    actorRole: auth.role,
    targetId: franchiseId,
    metadata: { cycleType: body.cycleType, startDay, endDay },
  });

  return NextResponse.json({
    message: "Salary cycle updated.",
    cycle: {
      startDay: store.salaryCycleStartDay,
      endDay: store.salaryCycleEndDay,
    },
  });
}