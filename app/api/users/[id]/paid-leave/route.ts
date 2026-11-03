import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { auditLog } from "@/lib/audit-log";
import { getAuthorizedStoreId, requireAuth } from "@/lib/api-auth";
import { connectToDatabase } from "@/lib/mongodb";
import { validateCsrf } from "@/lib/csrf";
import { readJsonObject } from "@/lib/request-json";
import { isPaidLeaveEligible } from "@/lib/date-utils";
import Franchise from "@/models/Franchise";
import User from "@/models/User";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = validateCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "franchise_admin")
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!mongoose.isValidObjectId(id))
    return NextResponse.json({ message: "Employee not found." }, { status: 404 });
  const parsed = await readJsonObject<{
    franchiseId?: string;
    action?: string;
    amount?: number;
  }>(request);
  if (parsed.response) return parsed.response;
  const { action } = parsed.body;
  const amount = parsed.body.amount ?? 1;
  if (
    (action !== "increment" && action !== "decrement") ||
    typeof amount !== "number" ||
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > 30
  )
    return NextResponse.json({ message: "Choose a valid paid leave adjustment." }, { status: 400 });
  const storeId = await getAuthorizedStoreId(auth, parsed.body.franchiseId);
  if (!storeId)
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  await connectToDatabase();
  const store = await Franchise.findById(storeId).select("paidLeaveEnabled").lean();
  if (!store?.paidLeaveEnabled)
    return NextResponse.json({ message: "Paid leave is not enabled for this store." }, { status: 403 });
  const employee = await User.findOne({
    _id: id,
    role: "employee",
    franchises: storeId,
  });
  if (!employee)
    return NextResponse.json({ message: "Employee not found." }, { status: 404 });
  if (employee.isActive === false)
    return NextResponse.json({ message: "Archived employees cannot change paid leave." }, { status: 400 });
  if (!isPaidLeaveEligible(employee.dateOfJoining))
    return NextResponse.json({ message: "Paid leave is available after six months of service." }, { status: 403 });
  const delta = action === "increment" ? amount : -amount;
  const updated = await User.findOneAndUpdate(
    {
      _id: id,
      role: "employee",
      franchises: storeId,
      isActive: { $ne: false },
      ...(action === "decrement" ? { paidLeaveBalance: { $gte: amount } } : {}),
    },
    { $inc: { paidLeaveBalance: delta } },
    { new: true, runValidators: true }
  );
  if (!updated)
    return NextResponse.json({ message: "There is not enough paid leave to decrement." }, { status: 409 });
  auditLog(
    action === "increment"
      ? "employee.paid-leave.incremented"
      : "employee.paid-leave.decremented",
    {
      actorId: auth.id,
      actorRole: auth.role,
      targetId: id,
      metadata: {
        storeId: String(storeId),
        amount,
        paidLeaveBalance: updated.paidLeaveBalance ?? 0,
      },
    },
  );
  return NextResponse.json({
    message: `Paid leave ${action === "increment" ? "increased" : "decreased"}.`,
    paidLeaveBalance: updated.paidLeaveBalance ?? 0,
  });
}
