import { NextRequest, NextResponse } from "next/server";
import Franchise from "@/models/Franchise";
import { getAuthInfo } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthorizedStoreAdminId } from "@/lib/api-auth";
import { isValidPeriod, getCycleRange, resolveCycleSettings } from "@/lib/salary-cycle";

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const franchiseId = params.get("franchiseId") ?? "";
  const period = params.get("period") ?? "";
  if (!isValidPeriod(period)) {
    return NextResponse.json({ message: "A valid period is required." }, { status: 400 });
  }

  await connectToDatabase();
  if (!(await getAuthorizedStoreAdminId(auth, franchiseId))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  const store = await Franchise.findById(franchiseId)
    .select("salaryCycleType salaryCycleStartDay salaryCycleEndDay salaryCycleConfiguredAt")
    .lean();
  if (!store) return NextResponse.json({ message: "Store not found." }, { status: 404 });

  const { cycleType, startDay, endDay } = resolveCycleSettings(store);
  const range = getCycleRange(period, cycleType, startDay);

  return NextResponse.json({
    cycle: {
      configured: Boolean(store.salaryCycleConfiguredAt),
      type: cycleType,
      startDay,
      endDay,
      ...range,
    },
  });
}
