import { NextRequest, NextResponse } from "next/server";
import { readJsonObject } from "@/lib/request-json";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Franchise from "@/models/Franchise";
import { DEFAULT_POSITION_OPTIONS } from "@/lib/employee-positions";
import bcrypt from "bcryptjs";
import type { AuthInfo } from "@/lib/auth";
import { requireAuth } from "@/lib/api-auth";
import {
  getAllowedAssignableRoles,
  getAllowedFranchiseIdsForCaller,
  isGlobalRole,
  USER_MANAGEMENT_CALLERS,
} from "@/lib/user-permissions";
import { validateCsrf } from "@/lib/csrf";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { createUserBodySchema } from "@/lib/validation";
import { auditLog } from "@/lib/audit-log";
import { nextEmployeeCode } from "@/lib/employee-code";

/**
 * GET /api/users?franchiseId=xxx&page=1&limit=50
 * - admin             : see all users (optionally filtered by franchise)
 * - sub_admin         : see all users except super admin (optionally filtered by franchise)
 * - franchise_admin   : see only employees in their own franchises
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!USER_MANAGEMENT_CALLERS.has(auth.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const franchiseId = searchParams.get("franchiseId");
  const includeArchived = searchParams.get("includeArchived") === "true";
  const excludeEmployees = searchParams.get("excludeEmployees") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const skip = (page - 1) * limit;
  const allowedIds = await getAllowedFranchiseIdsForCaller(auth);

  const query: Record<string, unknown> = {};

  // Never return the calling user themselves
  query._id = { $ne: auth.id };

  // Sub-admins see users they created; store admins see employees by assigned store.
  if (auth.role === "sub_admin") {
    query.createdBy = auth.id;
  }

  if (allowedIds !== null) {
    // franchise_admin: scope to their franchises, only employees visible
    const scopedIds =
      franchiseId && allowedIds.includes(franchiseId)
        ? [franchiseId]
        : allowedIds;
    query.franchises = { $in: scopedIds };
    query.role = "employee";
  } else if (auth.role === "sub_admin") {
    // sub_admin cannot see super admin users
    query.role = { $ne: "admin" };
  } else if (franchiseId) {
    query.franchises = franchiseId;
  }

  if (auth.role === "admin" && excludeEmployees) {
    query.role = { $ne: "employee" };
  }

  if (!includeArchived) {
    query.isActive = { $ne: false };
  }

  const users = await User.find(query)
    .select("-password")
    .sort({ name: 1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const totalCount = await User.countDocuments(query);

  const allFranchiseIds = [
    ...new Set(
      users.flatMap((u) =>
        ((u as { franchises?: unknown[] }).franchises ?? []).map(String),
      ),
    ),
  ];
  const franchises =
    allFranchiseIds.length > 0
      ? await Franchise.find({ _id: { $in: allFranchiseIds } })
          .select("_id name")
          .lean()
      : [];
  const franchiseMap = Object.fromEntries(
    franchises.map((f) => [String(f._id), f.name]),
  );

  const result = users.map((u) => ({
    _id: String(u._id),
    name: u.name,
    employeeCode: u.employeeCode,
    email: u.email,
    phone: u.phone,
    position: u.position,
    employmentType: u.employmentType,
    salary: u.salary,
    role: u.role,
    isActive: u.isActive !== false,
    actualDob: u.actualDob,
    dateOfJoining: u.dateOfJoining,
    archivedAt: u.archivedAt,
    franchises: ((u as { franchises?: unknown[] }).franchises ?? []).map(
      (id) => ({
        _id: String(id),
        name: franchiseMap[String(id)] ?? "Unknown",
      }),
    ),
    createdAt: u.createdAt,
  }));

  return NextResponse.json({
    users: result,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  });
}

type CreateUserBody = {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  franchiseIds?: string[];
  phone?: string;
  position?: string;
  employmentType?: "full_time" | "part_time";
  salary?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  actualDob?: string;
  dobInRecords?: string;
  aadharNumber?: string;
  panNumber?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankIfsc?: string;
  bankBranch?: string;
  dateOfJoining?: string;
};

function normalizeCreateUserInput(body: CreateUserBody, callerRole: string) {
  const role =
    callerRole === "sub_admin" ? "franchise_admin" : (body.role ?? "employee");
  const franchiseIds = Array.isArray(body.franchiseIds)
    ? body.franchiseIds
    : [];

  return {
    role,
    franchiseIds,
    name: body.name,
    email: body.email,
    password: body.password,
    phone: body.phone,
    position: body.position,
    employmentType: body.employmentType,
    salary: body.salary,
    emergencyContactName: body.emergencyContactName,
    emergencyContactPhone: body.emergencyContactPhone,
    emergencyContactRelationship: body.emergencyContactRelationship,
    actualDob: body.actualDob,
    dobInRecords: body.dobInRecords,
    aadharNumber: body.aadharNumber,
    panNumber: body.panNumber,
    bankAccountNumber: body.bankAccountNumber,
    bankName: body.bankName,
    bankIfsc: body.bankIfsc,
    bankBranch: body.bankBranch,
    dateOfJoining: body.dateOfJoining,
  };
}

function validateCreateUserFields(
  name: string | undefined,
  role: string,
  email: string | undefined,
  password: string | undefined,
): NextResponse | null {
  if (!name?.trim()) {
    return NextResponse.json({ message: "Name is required." }, { status: 400 });
  }

  if (role === "employee") {
    return null;
  }

  if (!email?.trim()) {
    return NextResponse.json(
      { message: "Email is required." },
      { status: 400 },
    );
  }
  if (!password || password.length < 12) {
    return NextResponse.json(
      { message: "Password must be at least 12 characters." },
      { status: 400 },
    );
  }
  if (!/[A-Z]/.test(password)) {
    return NextResponse.json(
      { message: "Password must contain at least one uppercase letter." },
      { status: 400 },
    );
  }
  if (!/[a-z]/.test(password)) {
    return NextResponse.json(
      { message: "Password must contain at least one lowercase letter." },
      { status: 400 },
    );
  }
  if (!/[0-9]/.test(password)) {
    return NextResponse.json(
      { message: "Password must contain at least one digit." },
      { status: 400 },
    );
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return NextResponse.json(
      { message: "Password must contain at least one special character." },
      { status: 400 },
    );
  }

  return null;
}

function validateRoleAssignment(
  callerRole: string,
  role: string,
): NextResponse | null {
  const allowedRoles = getAllowedAssignableRoles(callerRole);
  if (allowedRoles.includes(role)) {
    return null;
  }

  return NextResponse.json(
    { message: "You are not allowed to assign this role." },
    { status: 403 },
  );
}

async function validateSubAdminStoreEligibility(
  auth: AuthInfo,
): Promise<NextResponse | null> {
  if (auth.role !== "sub_admin") {
    return null;
  }

  const assignedCount = (await User.findById(auth.id)
    .select("franchises")
    .lean()) as {
    franchises?: unknown[];
  };
  const assignedStores = (assignedCount?.franchises ?? []).length;
  const createdStores = await Franchise.countDocuments({ createdBy: auth.id });
  if (assignedStores > 0 || createdStores > 0) {
    return null;
  }

  return NextResponse.json(
    {
      message: "You need to be assigned to at least one store to create users.",
    },
    { status: 403 },
  );
}

function validateFranchiseAdminAssignment(
  role: string,
  franchiseIds: string[],
): NextResponse | null {
  if (role !== "franchise_admin" || franchiseIds.length > 0) {
    return null;
  }

  return NextResponse.json(
    { message: "Store admin must be assigned to at least one store." },
    { status: 400 },
  );
}

async function validateFranchiseScope(
  auth: AuthInfo,
  franchiseIds: string[],
): Promise<NextResponse | null> {
  if (isGlobalRole(auth.role) || franchiseIds.length === 0) {
    return null;
  }

  const allowedIds = await getAllowedFranchiseIdsForCaller(auth);
  const unauthorised = franchiseIds.filter(
    (id: string) => !(allowedIds ?? []).includes(id),
  );
  if (unauthorised.length === 0) {
    return null;
  }

  return NextResponse.json(
    { message: "You can only assign users to your own franchises." },
    { status: 403 },
  );
}

async function validateEmployeePosition(
  franchiseId: string,
  position: string,
): Promise<NextResponse | null> {
  const franchise = await Franchise.findById(franchiseId).select("positions").lean();
  const positions = franchise?.positions ?? DEFAULT_POSITION_OPTIONS;
  if (positions.includes(position)) return null;
  return NextResponse.json(
    { message: "Select a position configured for this store." },
    { status: 400 },
  );
}

async function validateUniqueEmail(
  resolvedEmail: string | undefined,
): Promise<NextResponse | null> {
  if (!resolvedEmail) {
    return null;
  }

  const existing = await User.findOne({ email: resolvedEmail }).lean();
  if (!existing) {
    return null;
  }

  return NextResponse.json(
    { message: "A user with this email already exists." },
    { status: 409 },
  );
}

async function buildPasswordHash(
  password: string | undefined,
): Promise<string> {
  if (password) {
    return bcrypt.hash(password, 12);
  }
  return bcrypt.hash(Math.random().toString(36), 12);
}

function normalizeEmail(email: string | undefined): string | undefined {
  const trimmedEmail = email?.trim();
  return trimmedEmail ? trimmedEmail.toLowerCase() : undefined;
}

function isAdultDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00`);
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return date <= cutoff;
}

function buildCreateUserDocument(input: {
  name: string;
  resolvedEmail: string | undefined;
  hashedPassword: string;
  role: string;
  createdBy: string;
  franchiseIds: string[];
  phone?: string;
  position?: string;
  employmentType?: "full_time" | "part_time";
  salary?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  actualDob?: string;
  dobInRecords?: string;
  aadharNumber?: string;
  panNumber?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankIfsc?: string;
  bankBranch?: string;
  dateOfJoining?: string;
}): Record<string, unknown> {
  const userDoc: Record<string, unknown> = {
    name: input.name,
    email: input.resolvedEmail ?? `emp_${Date.now()}@nologin.internal`,
    password: input.hashedPassword,
    role: input.role,
    isActive: true,
    createdBy: input.createdBy,
    // Global roles (admin / sub_admin) don't need franchise assignments
    franchises: isGlobalRole(input.role) ? [] : input.franchiseIds,
  };

  if (input.phone) userDoc.phone = input.phone.trim();
  if (input.position) userDoc.position = input.position;
  if (input.employmentType) userDoc.employmentType = input.employmentType;
  if (input.salary !== undefined) userDoc.salary = input.salary;
  if (input.emergencyContactName) {
    userDoc.emergencyContactName = input.emergencyContactName.trim();
  }
  if (input.emergencyContactPhone) {
    userDoc.emergencyContactPhone = input.emergencyContactPhone.trim();
  }
  if (input.emergencyContactRelationship) {
    userDoc.emergencyContactRelationship = input.emergencyContactRelationship.trim();
  }
  if (input.actualDob) userDoc.actualDob = new Date(input.actualDob);
  if (input.dobInRecords) userDoc.dobInRecords = new Date(input.dobInRecords);
  if (input.aadharNumber) userDoc.aadharNumber = input.aadharNumber.trim();
  if (input.panNumber) userDoc.panNumber = input.panNumber.trim().toUpperCase();
  if (input.bankAccountNumber) {
    userDoc.bankAccountNumber = input.bankAccountNumber.trim();
  }
  if (input.bankName) userDoc.bankName = input.bankName.trim();
  if (input.bankIfsc) userDoc.bankIfsc = input.bankIfsc.trim().toUpperCase();
  if (input.bankBranch) userDoc.bankBranch = input.bankBranch.trim();
  if (input.dateOfJoining)
    userDoc.dateOfJoining = new Date(input.dateOfJoining);

  return userDoc;
}

/**
 * POST /api/users — create a user
 * - admin     : can create sub_admin / franchise_admin / employee
 * - sub_admin : can create franchise_admin / employee
 * - franchise_admin : can create employee (within own franchises only)
 */
export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!USER_MANAGEMENT_CALLERS.has(auth.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // Rate limiting
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`user-create:${auth.id}`, RATE_LIMITS.userCreate);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { message: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000)) } },
    );
  }

  // Body size limit
  const jsonBody = await readJsonObject(request, 50_000);
  if (jsonBody.response) return jsonBody.response;
  const rawBody = jsonBody.body;

  // Schema validation
  const parsed = createUserBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const {
    role,
    franchiseIds,
    name,
    email,
    password,
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
  } = normalizeCreateUserInput(body as CreateUserBody, auth.role);

  const fieldError = validateCreateUserFields(name, role, email, password);
  if (fieldError) return fieldError;

  if (role === "employee" && phone && !/^\d{10}$/.test(phone)) {
    return NextResponse.json(
      { message: "Phone number must be exactly 10 digits." },
      { status: 400 },
    );
  }
  if (role === "employee" && !position) {
    return NextResponse.json(
      { message: "Position is required for employees." },
      { status: 400 },
    );
  }
  if (role === "employee" && !employmentType) {
    return NextResponse.json(
      { message: "Employment type is required for employees." },
      { status: 400 },
    );
  }
  if (role === "employee" && salary === undefined) {
    return NextResponse.json(
      { message: "Salary is required for employees." },
      { status: 400 },
    );
  }

  if (
    role === "employee" &&
    ((actualDob && !isAdultDate(actualDob)) ||
      (dobInRecords && !isAdultDate(dobInRecords)))
  ) {
    return NextResponse.json(
      { message: "Employees must be at least 18 years old." },
      { status: 400 },
    );
  }

  if (role === "employee" && franchiseIds.length !== 1) {
    return NextResponse.json(
      { message: "An employee must be assigned to exactly one store." },
      { status: 400 },
    );
  }

  const roleError = validateRoleAssignment(auth.role, role);
  if (roleError) return roleError;

  await connectToDatabase();

  const subAdminError = await validateSubAdminStoreEligibility(auth);
  if (subAdminError) return subAdminError;

  const assignmentError = validateFranchiseAdminAssignment(role, franchiseIds);
  if (assignmentError) return assignmentError;

  const franchiseScopeError = await validateFranchiseScope(auth, franchiseIds);
  if (franchiseScopeError) return franchiseScopeError;

  if (role === "employee" && position && franchiseIds[0]) {
    const positionError = await validateEmployeePosition(franchiseIds[0], position);
    if (positionError) return positionError;
  }

  // For non-employees, enforce email uniqueness.
  const resolvedEmail = normalizeEmail(email);
  const emailError = await validateUniqueEmail(resolvedEmail);
  if (emailError) return emailError;

  const hashedPassword = await buildPasswordHash(password);
  const safeName = name?.trim() ?? "";

  try {
    const user = await User.create({
      ...buildCreateUserDocument({
        name: safeName,
        resolvedEmail,
        hashedPassword,
        role,
        createdBy: auth.id,
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
      }),
      ...(role === "employee" ? { employeeCode: await nextEmployeeCode() } : {}),
    });

    auditLog("user.created", {
      actorId: auth.id,
      actorRole: auth.role,
      targetId: String(user._id),
      ip,
      metadata: { role, email: resolvedEmail },
    });

    return NextResponse.json(
      {
        message: "User created successfully.",
        user: {
          _id: String(user._id),
          employeeCode: user.employeeCode,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const mongoErr = err as {
      code?: number;
      keyPattern?: Record<string, unknown>;
      message?: string;
    };
    if (mongoErr.code === 11000 && mongoErr.keyPattern?.email) {
      return NextResponse.json(
        { message: "A user with this email already exists." },
        { status: 409 },
      );
    }
    console.error("[POST /api/users]", err);
    return NextResponse.json(
      {
        message:
          process.env.NODE_ENV === "development"
            ? mongoErr.message ?? "Failed to create user."
            : "Failed to create user. Please try again.",
      },
      { status: 500 },
    );
  }
}
