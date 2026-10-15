import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Franchise from "@/models/Franchise";
import { getAuthInfo, type AuthInfo } from "@/lib/auth";
import {
  canManageTargetUser,
  getAllowedAssignableRoles,
  getAllowedFranchiseIdsForCaller,
  getTargetUserRole,
  isGlobalRole,
  USER_MANAGEMENT_CALLERS,
} from "@/lib/user-permissions";
import { validateCsrf } from "@/lib/csrf";
import { patchUserBodySchema, parseBodyWithLimit } from "@/lib/validation";
import { auditLog } from "@/lib/audit-log";
import { getClientIp } from "@/lib/rate-limit";
import { decryptUserFields } from "@/lib/crypto";
import { localDateValue } from "@/lib/date-utils";
import { DEFAULT_POSITION_OPTIONS } from "@/lib/employee-positions";

function isAdultDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00`);
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return date <= cutoff;
}

/** GET /api/users/:id — return editable user details */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthInfo();
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!USER_MANAGEMENT_CALLERS.has(auth.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();

  const targetRole = await getTargetUserRole(id);
  if (!targetRole) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }
  if (!(await canManageTargetUser(auth, id))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  const user = await User.findById(id).select("-password").lean();
  if (!user) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  const result = decryptUserFields({ ...user } as Record<string, unknown>);

  return NextResponse.json({ user: result });
}

async function validatePatchBody(
  auth: AuthInfo,
  role: string | undefined,
  franchiseIds: string[] | undefined,
): Promise<NextResponse | null> {
  if (role && !getAllowedAssignableRoles(auth.role).includes(role)) {
    return NextResponse.json(
      { message: "You are not allowed to assign this role." },
      { status: 403 },
    );
  }

  if (!isGlobalRole(auth.role) && franchiseIds !== undefined) {
    const allowedIds = await getAllowedFranchiseIdsForCaller(auth);
    const unauthorised = franchiseIds.filter(
      (fid) => !(allowedIds ?? []).includes(fid),
    );
    if (unauthorised.length > 0) {
      return NextResponse.json(
        { message: "You can only assign users to your own franchises." },
        { status: 403 },
      );
    }
  }

  return null;
}

/** PATCH /api/users/:id */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // CSRF protection
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await getAuthInfo();
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!USER_MANAGEMENT_CALLERS.has(auth.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const ip = getClientIp(request);

  // Body size limit and validation
  const rawBody = await parseBodyWithLimit(request, 10_000);
  if (rawBody === null) {
    return NextResponse.json({ message: "Request body too large." }, { status: 413 });
  }
  const parsed = patchUserBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const targetRole = await getTargetUserRole(id);
  if (!targetRole) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  // Hard API guard: sub_admin must never modify super admin records.
  if (auth.role === "sub_admin" && targetRole === "admin") {
    return NextResponse.json(
      { message: "You cannot modify super admin data." },
      { status: 403 },
    );
  }

  if (!(await canManageTargetUser(auth, id))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  const {
    name,
    role,
    franchiseIds,
    phone,
    position,
    employmentType,
    salary,
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactRelationship,
    actualDob,
    dobInRecords,
    aadharNumber,
    panNumber,
    bankAccountNumber,
    bankName,
    bankIfsc,
    bankBranch,
    dateOfJoining,
  } = parsed.data;

  const validationError = await validatePatchBody(auth, role, franchiseIds);
  if (validationError) return validationError;

  const target = await User.findById(id);
  if (!target) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  // franchise_admin and employee must always be assigned to at least one store.
  const effectiveRole = role ?? targetRole;
  if (effectiveRole === "employee" && phone && !/^\d{10}$/.test(phone)) {
    return NextResponse.json(
      { message: "Phone number must be exactly 10 digits." },
      { status: 400 },
    );
  }
  if (
    effectiveRole === "employee" &&
    emergencyContactPhone &&
    !/^\d{10}$/.test(emergencyContactPhone)
  ) {
    return NextResponse.json(
      { message: "Emergency contact number must be exactly 10 digits." },
      { status: 400 },
    );
  }
  if (
    effectiveRole === "employee" &&
    ((actualDob && !isAdultDate(actualDob)) ||
      (dobInRecords && !isAdultDate(dobInRecords)))
  ) {
    return NextResponse.json(
      { message: "Employees must be at least 18 years old." },
      { status: 400 },
    );
  }
  if (
    (effectiveRole === "franchise_admin" || effectiveRole === "employee") &&
    franchiseIds?.length === 0
  ) {
    return NextResponse.json(
      { message: "Store admin must be assigned to at least one store." },
      { status: 400 },
    );
  }
  if (effectiveRole === "employee" && franchiseIds !== undefined && franchiseIds.length !== 1) {
    return NextResponse.json(
      { message: "An employee must be assigned to exactly one store." },
      { status: 400 },
    );
  }

  if (effectiveRole === "employee" && position && position !== target.position) {
    const franchiseId = franchiseIds?.[0] ?? String(target.franchises[0] ?? "");
    const franchise = franchiseId
      ? await Franchise.findById(franchiseId).select("positions").lean()
      : null;
    const configuredPositions = franchise?.positions ?? DEFAULT_POSITION_OPTIONS;
    if (!configuredPositions.includes(position)) {
      return NextResponse.json(
        { message: "Select a position configured for this store." },
        { status: 400 },
      );
    }
  }

  const update: Record<string, unknown> = {};
  if (name?.trim()) update.name = name.trim();
  if (role) update.role = role;
  if (franchiseIds !== undefined) update.franchises = franchiseIds;
  if (phone !== undefined) update.phone = phone;
  if (position !== undefined) update.position = position;
  if (employmentType !== undefined) update.employmentType = employmentType;
  if (salary !== undefined) update.salary = salary;
  if (emergencyContactName !== undefined) {
    update.emergencyContactName = emergencyContactName;
  }
  if (emergencyContactPhone !== undefined) {
    update.emergencyContactPhone = emergencyContactPhone;
  }
  if (emergencyContactRelationship !== undefined) {
    update.emergencyContactRelationship = emergencyContactRelationship;
  }
  if (actualDob !== undefined) update.actualDob = actualDob ? new Date(actualDob) : null;
  if (dobInRecords !== undefined) update.dobInRecords = dobInRecords ? new Date(dobInRecords) : null;
  if (aadharNumber !== undefined) update.aadharNumber = aadharNumber;
  if (panNumber !== undefined) update.panNumber = panNumber.trim().toUpperCase();
  if (bankAccountNumber !== undefined) update.bankAccountNumber = bankAccountNumber;
  if (bankName !== undefined) update.bankName = bankName;
  if (bankIfsc !== undefined) update.bankIfsc = bankIfsc.trim().toUpperCase();
  if (bankBranch !== undefined) update.bankBranch = bankBranch;
  if (dateOfJoining !== undefined) update.dateOfJoining = dateOfJoining ? new Date(dateOfJoining) : null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { message: "No fields to update." },
      { status: 400 },
    );
  }

  const currentFranchiseIds = target.franchises.map(String);
  const assignmentsChanged = franchiseIds !== undefined && (
    currentFranchiseIds.length !== franchiseIds.length ||
    currentFranchiseIds.some((franchiseId) => !franchiseIds.includes(franchiseId))
  );
  if ((role !== undefined && role !== target.role) || assignmentsChanged) {
    target.sessionVersion = (target.sessionVersion ?? 0) + 1;
  }

  Object.assign(target, update);
  const updated = await target.save();

  if (!updated) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  auditLog("user.updated", {
    actorId: auth.id,
    actorRole: auth.role,
    targetId: id,
    ip,
    metadata: { fields: Object.keys(update) },
  });

  const safeUpdated = updated.toObject() as unknown as Record<string, unknown>;
  delete safeUpdated.password;
  return NextResponse.json({
    message: "User updated.",
    user: decryptUserFields(safeUpdated),
  });
}

/** PUT /api/users/:id — restore an archived employee */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await getAuthInfo();
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!USER_MANAGEMENT_CALLERS.has(auth.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const ip = getClientIp(request);
  await connectToDatabase();

  const targetRole = await getTargetUserRole(id);
  if (targetRole !== "employee") {
    return NextResponse.json({ message: "Employee not found." }, { status: 404 });
  }
  if (!(await canManageTargetUser(auth, id))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  const restored = await User.findByIdAndUpdate(
    id,
    { $set: { isActive: true }, $unset: { archivedAt: "" }, $inc: { sessionVersion: 1 } },
    { new: true },
  ).lean();
  if (!restored) {
    return NextResponse.json({ message: "Employee not found." }, { status: 404 });
  }

  auditLog("user.unarchived", {
    actorId: auth.id,
    actorRole: auth.role,
    targetId: id,
    ip,
  });

  return NextResponse.json({ message: "Employee unarchived." });
}

/** DELETE /api/users/:id */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // CSRF protection
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await getAuthInfo();
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!USER_MANAGEMENT_CALLERS.has(auth.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const ip = getClientIp(request);

  if (id === auth.id) {
    return NextResponse.json(
      { message: "You cannot delete your own account." },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const targetRole = await getTargetUserRole(id);
  if (!targetRole) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  // Hard API guard: sub_admin must never modify super admin records.
  if (auth.role === "sub_admin" && targetRole === "admin") {
    return NextResponse.json(
      { message: "You cannot modify super admin data." },
      { status: 403 },
    );
  }

  if (!(await canManageTargetUser(auth, id))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  if (targetRole === "employee") {
    let archivedAt = new Date();
    try {
      const body = (await request.json()) as { exitDate?: string };
      if (body.exitDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.exitDate)) {
          return NextResponse.json({ message: "A valid exit date is required." }, { status: 400 });
        }
        const today = localDateValue();
        if (body.exitDate > today) {
          return NextResponse.json({ message: "Exit date cannot be in the future." }, { status: 400 });
        }
        const [year, month, day] = body.exitDate.split("-").map(Number);
        // Employee stays "active" through their exit date; archivedAt marks the first inactive day.
        archivedAt = new Date(Date.UTC(year, month - 1, day + 1));
      }
    } catch {
      // No JSON body provided — fall back to archiving as of now.
    }

    const archived = await User.findByIdAndUpdate(
      id,
      { $set: { isActive: false, archivedAt }, $inc: { sessionVersion: 1 } },
      { new: true },
    ).lean();
    if (!archived) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    auditLog("user.archived", {
      actorId: auth.id,
      actorRole: auth.role,
      targetId: id,
      ip,
    });

    return NextResponse.json({ message: "Employee archived." });
  }

  const deleted = await User.findByIdAndDelete(id).lean();
  if (!deleted) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  auditLog("user.deleted", {
    actorId: auth.id,
    actorRole: auth.role,
    targetId: id,
    ip,
  });

  return NextResponse.json({ message: "User deleted." });
}
