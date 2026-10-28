import { NextRequest, NextResponse } from "next/server";
import { readJsonObject } from "@/lib/request-json";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import { getAuthInfo, getVerifiedSessionPayload } from "@/lib/auth";
import { getJwtSecret } from "@/lib/server-env";
import { CLEAR_COOKIE_OPTS, SESSION_COOKIE_OPTS } from "@/lib/cookie-opts";
import {
  PASSWORD_CHANGE_COOKIE,
  SESSION_COOKIE,
  getSessionStart,
  nowSeconds,
  signSessionToken,
} from "@/lib/session-token";
import { validateCsrf } from "@/lib/csrf";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { updateProfileBodySchema } from "@/lib/validation";
import { auditLog } from "@/lib/audit-log";

/**
 * GET /api/me — return basic profile of the logged-in user from JWT.
 * Intentionally reachable while a password change is pending.
 */
export async function GET() {
  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  const user = await User.findById(auth.id).select("name email role").lean();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: auth.mustChangePassword === true,
  });
}

/** PATCH /api/me — update logged-in user's name and/or password */
export async function PATCH(request: NextRequest) {
  // CSRF protection
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  // Rate limiting for password changes
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(
    `password-change:${auth.id}`,
    RATE_LIMITS.passwordChange,
  );
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { message: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000)) } },
    );
  }

  // Body size limit
  const jsonBody = await readJsonObject(request, 10_000);
  if (jsonBody.response) return jsonBody.response;
  const rawBody = jsonBody.body;

  // Schema validation
  const parsed = updateProfileBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { name, currentPassword, newPassword } = parsed.data;

  await connectToDatabase();
  const user = await User.findById(auth.id).select("+password");
  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  // Update name
  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) {
      return NextResponse.json(
        { message: "Name cannot be empty" },
        { status: 400 },
      );
    }
    user.name = trimmed;
  }

  // Update password
  if (newPassword !== undefined) {
    // Require current password when rotating credentials.
    if (!currentPassword) {
      return NextResponse.json(
        { message: "Current password is required to set a new password" },
        { status: 400 },
      );
    }
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json(
        { message: "Current password is incorrect" },
        { status: 400 },
      );
    }
    if (newPassword.length < 12) {
      return NextResponse.json(
        { message: "New password must be at least 12 characters" },
        { status: 400 },
      );
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      return NextResponse.json(
        { message: "New password must be different from the current password" },
        { status: 400 },
      );
    }
    user.password = await bcrypt.hash(newPassword, 12);
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    user.mustChangePassword = false;
  } else if (auth.mustChangePassword) {
    return NextResponse.json(
      { message: "You must set a new password before continuing.", code: "PASSWORD_CHANGE_REQUIRED" },
      { status: 403 },
    );
  }

  await user.save();

  auditLog("user.password.changed", {
    actorId: String(user._id),
    actorRole: auth.role,
    ip,
  });

  // Re-issue JWT so profile changes (e.g. name) are reflected immediately.
  // The original login time is preserved so the 24h absolute session cap still applies.
  const current = await getVerifiedSessionPayload();
  const sessionStart = (current && getSessionStart(current.payload)) ?? nowSeconds();
  const stillRestricted = user.mustChangePassword === true;
  const newToken = await signSessionToken(
    {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      sessionVersion: user.sessionVersion ?? 0,
      sessionStart,
      mustChangePassword: stillRestricted,
    },
    getJwtSecret(),
  );

  const response = NextResponse.json({ message: "Profile updated", mustChangePassword: stillRestricted });
  if (stillRestricted) {
    response.cookies.set(PASSWORD_CHANGE_COOKIE, newToken, SESSION_COOKIE_OPTS);
  } else {
    response.cookies.set(PASSWORD_CHANGE_COOKIE, "", CLEAR_COOKIE_OPTS);
    response.cookies.set(SESSION_COOKIE, newToken, SESSION_COOKIE_OPTS);
  }
  return response;
}
