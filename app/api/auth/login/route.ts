import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Franchise from "@/models/Franchise";
import { getJwtSecret } from "@/lib/server-env";
import { SESSION_COOKIE_OPTS } from "@/lib/cookie-opts";
import { checkRateLimit, resetRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { validateCsrf } from "@/lib/csrf";
import { loginBodySchema, parseBodyWithLimit } from "@/lib/validation";
import { auditLog } from "@/lib/audit-log";

const COOKIE_NAME = "em_session";

export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  // Rate-limit by originating IP (using safe extraction)
  const ip = getClientIp(request);

  const rateCheck = checkRateLimit(`login:${ip}`, RATE_LIMITS.login);
  if (!rateCheck.allowed) {
    auditLog("auth.login.failed", { ip, metadata: { reason: "rate_limited" } });
    return NextResponse.json(
      { message: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000),
          ),
        },
      },
    );
  }

  try {
    // Enforce body size limit
    const rawBody = await parseBodyWithLimit(request, 10_000);
    if (rawBody === null) {
      return NextResponse.json(
        { message: "Request body too large." },
        { status: 413 },
      );
    }

    // Validate with zod schema
    const parsed = loginBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;
    const accountRateKey = `login-account:${email.toLowerCase().trim()}`;
    const accountRateCheck = checkRateLimit(accountRateKey, RATE_LIMITS.login);
    if (!accountRateCheck.allowed) {
      auditLog("auth.login.failed", { ip, metadata: { reason: "account_rate_limited" } });
      return NextResponse.json(
        { message: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((accountRateCheck.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    await connectToDatabase();

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      isActive: { $ne: false },
    }).select("password name role email franchises sessionVersion");

    if (!user) {
      auditLog("auth.login.failed", { ip, metadata: { email, reason: "user_not_found" } });
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 },
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      auditLog("auth.login.failed", { ip, targetId: String(user._id), metadata: { reason: "wrong_password" } });
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 },
      );
    }

    // Only franchise_admin and employee roles require store association.
    // Super admin (admin) and sub_admin can login without stores.
    if (user.role === "franchise_admin" || user.role === "employee") {
      const assignedCount = (
        (user as { franchises?: unknown[] }).franchises ?? []
      ).length;
      const createdCount = await Franchise.countDocuments({
        createdBy: user._id,
      });

      if (assignedCount === 0 && createdCount === 0) {
        return NextResponse.json(
          { message: "No stores are associated with this user." },
          { status: 403 },
        );
      }
    }

    // Successful — clear rate-limit counter for this IP
    resetRateLimit(`login:${ip}`);
    resetRateLimit(accountRateKey);

    // Sign a JWT valid for 8 hours using jose (consistent with verify paths)
    const token = await new SignJWT({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      sessionVersion: user.sessionVersion ?? 0,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .sign(getJwtSecret());

    auditLog("auth.login.success", { actorId: String(user._id), actorRole: user.role, ip });

    const response = NextResponse.json(
      {
        message: "Login successful.",
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 200 },
    );

    response.cookies.set(COOKIE_NAME, token, SESSION_COOKIE_OPTS);

    return response;
  } catch (error) {
    console.error("[LOGIN_ERROR]", error);
    return NextResponse.json(
      { message: "An internal server error occurred." },
      { status: 500 },
    );
  }
}
