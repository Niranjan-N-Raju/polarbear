import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Franchise from "@/models/Franchise";
import Sale from "@/models/Sale";
import { getAuthInfo } from "@/lib/auth";
import { computeMonthlyAttrition } from "@/lib/attrition";
import { computeExpenseBreakdown, computePaymentMixTrend, computeWeekdayPerformance } from "@/lib/sales-insights";

const FRANCHISE_COOKIE = "em_franchise";

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

/** GET /api/dashboard — returns role-scoped stats for the dashboard */
export async function GET() {
  const auth = await getAuthInfo();
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const activeFranchiseId = cookieStore.get(FRANCHISE_COOKIE)?.value ?? null;

  await connectToDatabase();

  const isGlobal = auth.role === "admin";

  if (isGlobal) {
    const [
      totalStores,
      activeStores,
      franchiseStores,
      companyStores,
      totalUsers,
      storeAdmins,
      subAdmins,
      employees,
    ] = await Promise.all([
      Franchise.countDocuments({}),
      Franchise.countDocuments({ isActive: true }),
      Franchise.countDocuments({ storeType: "franchise" }),
      Franchise.countDocuments({ storeType: "company" }),
      User.countDocuments({ role: { $ne: "admin" } }),
      User.countDocuments({ role: "franchise_admin" }),
      User.countDocuments({ role: "sub_admin" }),
      User.countDocuments({ role: "employee", isActive: { $ne: false } }),
    ]);

    return NextResponse.json({
      totalStores,
      activeStores,
      inactiveStores: totalStores - activeStores,
      franchiseStores,
      companyStores,
      totalUsers,
      storeAdmins,
      subAdmins,
      employees,
    });
  }

  if (auth.role === "sub_admin") {
    const [totalUsers, storeAdmins, subAdmins, employees, me] =
      await Promise.all([
        User.countDocuments({ createdBy: auth.id, role: { $ne: "admin" } }),
        User.countDocuments({ createdBy: auth.id, role: "franchise_admin" }),
        User.countDocuments({ createdBy: auth.id, role: "sub_admin" }),
        User.countDocuments({
          createdBy: auth.id,
          role: "employee",
          isActive: { $ne: false },
        }),
        User.findById(auth.id).select("franchises").lean(),
      ]);

    const assignedStoreIds = (
      (me as { franchises?: unknown[] })?.franchises ?? []
    ).map(String);
    const createdStores = await Franchise.find({ createdBy: auth.id })
      .select("_id")
      .lean();
    const scopedFranchiseIds = [
      ...new Set([
        ...assignedStoreIds,
        ...createdStores.map((s) => String(s._id)),
      ]),
    ];

    const [totalStores, activeStores, franchiseStores, companyStores] =
      scopedFranchiseIds.length > 0
        ? await Promise.all([
            Franchise.countDocuments({ _id: { $in: scopedFranchiseIds } }),
            Franchise.countDocuments({
              _id: { $in: scopedFranchiseIds },
              isActive: true,
            }),
            Franchise.countDocuments({
              _id: { $in: scopedFranchiseIds },
              storeType: "franchise",
            }),
            Franchise.countDocuments({
              _id: { $in: scopedFranchiseIds },
              storeType: "company",
            }),
          ])
        : [0, 0, 0, 0];

    return NextResponse.json({
      totalStores,
      activeStores,
      inactiveStores: totalStores - activeStores,
      franchiseStores,
      companyStores,
      totalUsers,
      storeAdmins,
      subAdmins,
      employees,
    });
  }

  if (auth.role === "franchise_admin") {
    const me = await User.findById(auth.id).select("franchises").lean();
    const assignedStoreIds = (
      (me as { franchises?: unknown[] })?.franchises ?? []
    ).map(String);

    const createdStores = await Franchise.find({ createdBy: auth.id })
      .select("_id")
      .lean();
    const visibleStoreIds = [
      ...new Set([
        ...assignedStoreIds,
        ...createdStores.map((s) => String(s._id)),
      ]),
    ];

    const scopeIds =
      activeFranchiseId && visibleStoreIds.includes(activeFranchiseId)
        ? [activeFranchiseId]
        : visibleStoreIds;

    const employeeCount = await User.countDocuments({
      franchises: { $in: scopeIds },
      role: "employee",
      isActive: { $ne: false },
    });

    const { from, to } = currentMonthRange();
    const salesAgg = await Sale.aggregate([
      { $match: { franchise: { $in: scopeIds.map((id) => new mongoose.Types.ObjectId(id)) }, date: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: "$totalSale" } } },
    ]);
    const salesSummary = salesAgg[0]?.total ?? 0;

    const attritionEmployees = await User.find({
      franchises: { $in: scopeIds },
      role: "employee",
    })
      .select("dateOfJoining archivedAt isActive")
      .lean();
    const attritionTrend = computeMonthlyAttrition(attritionEmployees);

    const allSales = await Sale.find({
      franchise: { $in: scopeIds.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select("date totalSale swiggy zomato upi cash expenses")
      .lean();
    const weekdayPerformance = computeWeekdayPerformance(allSales);
    const expenseBreakdown = computeExpenseBreakdown(allSales);
    const paymentMixTrend = computePaymentMixTrend(allSales);

    // Attendance summary will be populated once that aggregation is defined
    return NextResponse.json({
      storeCount: visibleStoreIds.length,
      employeeSummary: employeeCount,
      salesSummary,
      attendanceSummary: 0,
      attritionTrend,
      weekdayPerformance,
      expenseBreakdown,
      paymentMixTrend,
    });
  }

  // employee — minimal stats
  return NextResponse.json({
    totalStores: 0,
    activeStores: 0,
    inactiveStores: 0,
    franchiseStores: 0,
    companyStores: 0,
    totalUsers: 0,
    storeAdmins: 0,
    subAdmins: 0,
    employees: 0,
  });
}
