import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import Attendance from "@/models/Attendance";
import Franchise from "@/models/Franchise";
import User from "@/models/User";
import Incentive from "@/models/Incentive";
import ExtraDay from "@/models/ExtraDay";
import Advance from "@/models/Advance";
import { getAuthInfo } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { getAllowedFranchiseIdsForCaller } from "@/lib/user-permissions";
import { isValidPeriod, localDateValue, getCycleRange, resolveCycleSettings, roundCurrency } from "@/lib/salary-cycle";
import { datesBetween } from "@/lib/date-utils";
import { decryptUserFields } from "@/lib/crypto";

async function authorizeStore(authId: string, role: string, franchiseId: string) {
  if (role !== "franchise_admin" || !mongoose.isValidObjectId(franchiseId)) return false;
  const allowedIds = await getAllowedFranchiseIdsForCaller({ id: authId, role });
  return allowedIds?.includes(franchiseId) ?? false;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const franchiseId = params.get("franchiseId") ?? "";
  const employeeId = params.get("employeeId") ?? "";
  const period = params.get("period") ?? "";
  if (!isValidPeriod(period)) {
    return NextResponse.json({ message: "A valid salary period is required." }, { status: 400 });
  }
  if (!mongoose.isValidObjectId(employeeId)) {
    return NextResponse.json({ message: "A valid employee is required." }, { status: 400 });
  }

  await connectToDatabase();
  if (!(await authorizeStore(auth.id, auth.role, franchiseId))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  const store = await Franchise.findById(franchiseId)
    .select("name address phone logo salaryCycleType salaryCycleStartDay salaryCycleEndDay")
    .lean();
  if (!store) return NextResponse.json({ message: "Store not found." }, { status: 404 });

  const employee = await User.findOne({ _id: employeeId, role: "employee", franchises: franchiseId })
    .select("name position employmentType salary dateOfJoining bankName bankAccountNumber bankIfsc panNumber")
    .lean();
  if (!employee) return NextResponse.json({ message: "Employee not found." }, { status: 404 });
  decryptUserFields(employee as unknown as Record<string, unknown>);

  const { cycleType, startDay } = resolveCycleSettings(store);
  const range = getCycleRange(period, cycleType, startDay);
  const cycleDates = datesBetween(range.from, range.to);
  const today = localDateValue();

  const joiningDate = employee.dateOfJoining ? localDateValue(new Date(employee.dateOfJoining)) : range.from;
  const payableDates = cycleDates.filter((date) => date >= joiningDate);
  const elapsedDates = payableDates.filter((date) => date <= today);

  const [attendance, incentives, extraDays, advances] = await Promise.all([
    Attendance.find({ franchise: franchiseId, employee: employeeId, date: { $gte: range.from, $lte: range.to } })
      .select("date status")
      .lean(),
    Incentive.find({ franchise: franchiseId, employee: employeeId, period }).select("type amount").lean(),
    ExtraDay.find({ franchise: franchiseId, employee: employeeId, period }).select("type days").lean(),
    Advance.find({ franchise: franchiseId, employee: employeeId, period }).select("type amount").lean(),
  ]);

  const attendanceByDate = new Map(attendance.map((record) => [record.date, record.status]));
  const presentDays = elapsedDates.filter((date) => attendanceByDate.get(date) === "Present").length;
  const weekOffDays = elapsedDates.filter((date) => attendanceByDate.get(date) === "Week Off").length;
  const absentDays = elapsedDates.filter((date) => attendanceByDate.get(date) === "Absent").length;
  const paidDays = presentDays + weekOffDays;

  const extraDaysTotal = extraDays.reduce((sum, item) => sum + item.days, 0);
  const incentiveTotal = incentives.reduce((sum, item) => sum + item.amount, 0);
  const advanceTotal = advances.reduce((sum, item) => sum + item.amount, 0);
  const salary = employee.salary ?? 0;
  // Gross earnings before incentives/deductions, prorated for the days actually paid this cycle.
  const basicSalary = roundCurrency((salary * (paidDays + extraDaysTotal)) / cycleDates.length);
  const totalDeductions = advanceTotal;
  const netPay = basicSalary + incentiveTotal - totalDeductions;

  return NextResponse.json({
    store: {
      name: store.name,
      address: store.address ?? "",
      phone: store.phone ?? "",
      logoUrl: store.logo?.fileId ? `/api/stores/logo?franchiseId=${franchiseId}` : "",
    },
    period,
    periodLabel: new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
      new Date(`${period}-01T00:00:00`),
    ),
    employee: {
      name: employee.name,
      position: employee.position ?? "",
      employmentType: employee.employmentType ?? "",
      bankName: employee.bankName ?? "",
      bankAccountNumber: employee.bankAccountNumber ?? "",
      bankIfsc: employee.bankIfsc ?? "",
      panNumber: employee.panNumber ?? "",
    },
    attendance: {
      totalWorkingDays: payableDates.length,
      presentDays,
      weekOffDays,
      absentDays,
      extraDays: extraDays.map((item) => ({ type: item.type, days: item.days })),
      extraDaysTotal,
    },
    earnings: {
      basicSalary,
      grossEarnings: basicSalary,
    },
    deductions: {
      advances,
      advanceTotal,
      totalDeductions,
    },
    incentives,
    incentiveTotal,
    netPay,
  });
}
