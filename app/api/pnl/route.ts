import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import Sale from "@/models/Sale";
import Attendance from "@/models/Attendance";
import Franchise from "@/models/Franchise";
import User from "@/models/User";
import Incentive from "@/models/Incentive";
import ExtraDay from "@/models/ExtraDay";
import Advance from "@/models/Advance";
import PnlInput from "@/models/PnlInput";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthorizedStoreAdminId, requireAuth } from "@/lib/api-auth";
import { isEmployeeActiveOn } from "@/lib/employee-status";
import { localDateValue, datesBetween } from "@/lib/date-utils";
import { getCycleRange, resolveCycleSettings, roundCurrency } from "@/lib/salary-cycle";
import { PNL_COST_OF_GOODS_KEYS, PNL_EXPENSE_KEYS, PNL_RENT_KEYS, PNL_STAFF_SALARY_KEY } from "@/lib/pnl-expenses";

const MAX_MONTHS = 36;

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function periodForDate(dateStr: string, cycleType: "calendar_month" | "custom", startDay: number) {
  const date = new Date(`${dateStr}T00:00:00`);
  if (cycleType === "calendar_month") return monthValue(date);
  const shifted = new Date(date);
  if (date.getDate() >= startDay) shifted.setMonth(shifted.getMonth() + 1);
  return monthValue(shifted);
}

function nextPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  return monthValue(new Date(year, month, 1));
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const franchiseId = new URL(request.url).searchParams.get("franchiseId") ?? "";

  await connectToDatabase();
  if (!(await getAuthorizedStoreAdminId(auth, franchiseId))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  const store = await Franchise.findById(franchiseId)
    .select("name salaryCycleType salaryCycleStartDay salaryCycleEndDay")
    .lean();
  if (!store) return NextResponse.json({ message: "Store not found." }, { status: 404 });

  const { cycleType, startDay } = resolveCycleSettings(store);
  const today = localDateValue();
  const currentPeriod = periodForDate(today, cycleType, startDay);

  const earliestSale = await Sale.findOne({ franchise: franchiseId }).sort({ date: 1 }).select("date").lean();
  if (!earliestSale) {
    return NextResponse.json({ store: { id: String(store._id), name: store.name }, months: [] });
  }

  const earliestPeriod = periodForDate(earliestSale.date, cycleType, startDay);
  const periods: string[] = [];
  for (let cursor = earliestPeriod; cursor <= currentPeriod && periods.length < MAX_MONTHS; cursor = nextPeriod(cursor)) {
    periods.push(cursor);
  }
  // Only the most recent MAX_MONTHS periods are shown when the sales history is longer than that.
  const periodsToShow = periods.slice(-MAX_MONTHS);

  const overallFrom = getCycleRange(periodsToShow[0], cycleType, startDay).from;
  const overallTo = getCycleRange(periodsToShow[periodsToShow.length - 1], cycleType, startDay).to;

  const [employees, sales, attendance, incentives, extraDays, advances, pnlInputs] = await Promise.all([
    User.find({ role: "employee", franchises: franchiseId })
      .select("name salary dateOfJoining isActive archivedAt")
      .lean(),
    Sale.find({ franchise: franchiseId, date: { $gte: overallFrom, $lte: overallTo } })
      .select("date totalSale totalExpenses swiggy zomato")
      .lean(),
    Attendance.find({ franchise: franchiseId, date: { $gte: overallFrom, $lte: overallTo } })
      .select("employee date status")
      .lean(),
    Incentive.find({ franchise: franchiseId, period: { $in: periodsToShow } }).lean(),
    ExtraDay.find({ franchise: franchiseId, period: { $in: periodsToShow } }).lean(),
    Advance.find({ franchise: franchiseId, period: { $in: periodsToShow } }).lean(),
    PnlInput.find({ franchise: franchiseId, period: { $in: periodsToShow } })
      .select("period values")
      .lean(),
  ]);

  const attendanceByEmployee = new Map<string, Map<string, string>>();
  for (const record of attendance) {
    const employeeId = String(record.employee);
    const map = attendanceByEmployee.get(employeeId) ?? new Map();
    map.set(record.date, record.status);
    attendanceByEmployee.set(employeeId, map);
  }
  const sumByEmployeePeriod = (rows: { employee: mongoose.Types.ObjectId; period: string; amount?: number; days?: number }[], field: "amount" | "days") => {
    const totals = new Map<string, number>();
    for (const row of rows) {
      const key = `${row.employee}:${row.period}`;
      totals.set(key, (totals.get(key) ?? 0) + (row[field] ?? 0));
    }
    return totals;
  };
  const incentiveTotals = sumByEmployeePeriod(incentives, "amount");
  const extraDayTotals = sumByEmployeePeriod(extraDays, "days");
  const advanceTotals = sumByEmployeePeriod(advances, "amount");
  const pnlInputsByPeriod = new Map(
    pnlInputs.map((input) => [
      input.period,
      input.values instanceof Map ? Object.fromEntries(input.values) : input.values ?? {},
    ]),
  );

  const months = periodsToShow.map((period) => {
    const range = getCycleRange(period, cycleType, startDay);
    const periodSales = sales.filter((sale) => sale.date >= range.from && sale.date <= range.to);
    const revenue = periodSales.reduce((sum, sale) => sum + sale.totalSale, 0);
    const storeExpenses = periodSales.reduce((sum, sale) => sum + sale.totalExpenses, 0);
    const swiggyRevenue = periodSales.reduce((sum, sale) => sum + sale.swiggy, 0);
    const zomatoRevenue = periodSales.reduce((sum, sale) => sum + sale.zomato, 0);

    const cycleDates = datesBetween(range.from, range.to);
    // Only count attendance up to today so an in-progress period reflects actual incurred cost, not a forecast.
    const elapsedDates = cycleDates.filter((date) => date <= today);

    let calculatedPayroll = 0;
    for (const employee of employees) {
      const employeeId = String(employee._id);
      const payableDates = elapsedDates.filter((date) => isEmployeeActiveOn(employee, date));
      const records = attendanceByEmployee.get(employeeId) ?? new Map();
      const paidDays = payableDates.filter((date) => {
        const status = records.get(date);
        return status === "Present" || status === "Week Off";
      }).length;
      const salary = employee.salary ?? 0;
      const incentiveTotal = incentiveTotals.get(`${employeeId}:${period}`) ?? 0;
      const extraDaysTotal = extraDayTotals.get(`${employeeId}:${period}`) ?? 0;
      const advanceTotal = advanceTotals.get(`${employeeId}:${period}`) ?? 0;
      if (paidDays === 0 && incentiveTotal === 0 && extraDaysTotal === 0 && advanceTotal === 0) continue;
      calculatedPayroll += roundCurrency((salary * (paidDays + extraDaysTotal)) / cycleDates.length) + incentiveTotal - advanceTotal;
    }

    const inputValues = pnlInputsByPeriod.get(period) ?? {};
    const enteredStaffSalary = inputValues[PNL_STAFF_SALARY_KEY] ?? 0;
    const payroll = enteredStaffSalary > 0 ? enteredStaffSalary : calculatedPayroll;
    const netSales = inputValues.netSales ?? roundCurrency(revenue * 0.95);
    const costOfGoods = PNL_COST_OF_GOODS_KEYS.reduce((sum, key) => sum + (inputValues[key] ?? 0), 0);
    const grossProfit = netSales - costOfGoods;
    const rentExpenses = PNL_RENT_KEYS.reduce((sum, key) => sum + (inputValues[key] ?? 0), 0);
    const manualExpenses = PNL_EXPENSE_KEYS.reduce(
      (sum, key) =>
        sum + (key === PNL_STAFF_SALARY_KEY || PNL_COST_OF_GOODS_KEYS.includes(key as typeof PNL_COST_OF_GOODS_KEYS[number]) || PNL_RENT_KEYS.includes(key as typeof PNL_RENT_KEYS[number])
          ? 0
          : inputValues[key] ?? 0),
      0,
    );
    const totalStoreExpenses = rentExpenses + manualExpenses;
    const totalExpenses = totalStoreExpenses + payroll;
    const netProfit = grossProfit - totalExpenses;
    const margin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

    return {
      period,
      from: range.from,
      to: range.to,
      revenue,
      netSales,
      grossProfit,
      salesExpenses: storeExpenses,
      storeExpenses: totalStoreExpenses,
      payroll,
      totalExpenses,
      netProfit,
      margin,
      swiggyRevenue,
      zomatoRevenue,
      isCurrent: period === currentPeriod,
    };
  });

  return NextResponse.json({
    store: { id: String(store._id), name: store.name },
    cycle: { type: cycleType, startDay },
    months: months.reverse(),
  });
}
