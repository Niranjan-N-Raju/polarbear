import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import User from "@/models/User";
import Franchise from "@/models/Franchise";
import { requireAuth, getAuthorizedStoreAdminId } from "@/lib/api-auth";
import { connectToDatabase } from "@/lib/mongodb";
import { validateCsrf } from "@/lib/csrf";
import { readJsonObject } from "@/lib/request-json";
import { isValidDate } from "@/lib/date-utils";
import { isEmployeeActiveOn } from "@/lib/employee-status";
import { auditLog } from "@/lib/audit-log";
import { DEFAULT_POSITION_OPTIONS } from "@/lib/employee-positions";

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
    return NextResponse.json(
      { message: "Employee not found." },
      { status: 404 }
    );
  const parsed = await readJsonObject<{
    franchiseId?: string;
    salary?: number;
    effectiveFrom?: string;
    position?: string;
  }>(request);
  if (parsed.response) return parsed.response;
  const { salary, effectiveFrom } = parsed.body;
  await connectToDatabase();
  const storeId = await getAuthorizedStoreAdminId(
    auth,
    parsed.body.franchiseId
  );
  if (!storeId)
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  const employee = await User.findOne({
    _id: id,
    role: "employee",
    franchises: storeId,
  });
  if (!employee)
    return NextResponse.json(
      { message: "Employee not found." },
      { status: 404 }
    );
  if (employee.isActive === false)
    return NextResponse.json(
      { message: "Archived employees cannot receive a salary hike." },
      { status: 400 }
    );
  if (
    typeof salary !== "number" ||
    !Number.isFinite(salary) ||
    salary > 100_000_000 ||
    salary <= (employee.salary ?? 0) ||
    Math.abs(salary * 100 - Math.round(salary * 100)) >= 1e-6
  ) {
    return NextResponse.json(
      {
        message:
          "Enter a monthly salary greater than the latest approved salary, with at most two decimal places.",
      },
      { status: 400 }
    );
  }
  if (
    typeof effectiveFrom !== "string" ||
    !isValidDate(effectiveFrom) ||
    !isEmployeeActiveOn(employee, effectiveFrom)
  )
    return NextResponse.json(
      {
        message: "Choose a valid effective date on or after the joining date.",
      },
      { status: 400 }
    );
  if (parsed.body.position !== undefined) {
    if (
      typeof parsed.body.position !== "string" ||
      !parsed.body.position.trim() ||
      parsed.body.position.length > 100
    )
      return NextResponse.json(
        { message: "Choose a valid promotion position." },
        { status: 400 }
      );
    const store = await Franchise.findById(storeId).select("positions").lean();
    if (
      !(store?.positions ?? DEFAULT_POSITION_OPTIONS).includes(
        parsed.body.position.trim()
      )
    )
      return NextResponse.json(
        { message: "Select a position configured for this store." },
        { status: 400 }
      );
  }
  if (
    employee.salaryRevisions?.some(
      (revision) => revision.effectiveFrom >= effectiveFrom
    )
  )
    return NextResponse.json(
      { message: "Choose an effective date after the latest salary hike." },
      { status: 400 }
    );
  const updated = await User.findOneAndUpdate(
    {
      _id: id,
      role: "employee",
      franchises: storeId,
      isActive: { $ne: false },
      salary: employee.salary ?? null,
      "salaryRevisions.effectiveFrom": { $ne: effectiveFrom },
    },
    {
      $set: {
        salary,
        salaryBaseline: employee.salaryBaseline ?? employee.salary ?? 0,
      },
      $push: {
        salaryRevisions: {
          salary,
          effectiveFrom,
          ...(typeof parsed.body.position === "string"
            ? { position: parsed.body.position.trim() }
            : {}),
          storeId,
          createdBy: new mongoose.Types.ObjectId(auth.id),
          createdAt: new Date(),
        },
      },
    },
    { new: true, runValidators: true }
  );
  if (!updated)
    return NextResponse.json(
      {
        message:
          "Salary changed while you were editing. Reload the employee and try again.",
      },
      { status: 409 }
    );
  auditLog(
    typeof parsed.body.position === "string"
      ? "employee.promoted"
      : "employee.salary.hiked",
    {
      actorId: auth.id,
      actorRole: auth.role,
      targetId: id,
      metadata: {
        storeId: String(storeId),
        previousSalary: employee.salary,
        salary,
        ...(typeof parsed.body.position === "string"
          ? { position: parsed.body.position.trim() }
          : {}),
        effectiveFrom,
      },
    }
  );
  return NextResponse.json({
    message:
      typeof parsed.body.position === "string"
        ? "Employee promotion saved."
        : "Salary hike saved.",
    salary,
    ...(typeof parsed.body.position === "string"
      ? { position: parsed.body.position.trim() }
      : {}),
    effectiveFrom,
  });
}
