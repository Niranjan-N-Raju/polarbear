import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import { getAuthInfo } from "@/lib/auth";
import { getJwtSecret } from "@/lib/server-env";
import { SESSION_COOKIE_OPTS } from "@/lib/cookie-opts";
import { validateCsrf } from "@/lib/csrf";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { updateProfileBodySchema, parseBodyWithLimit } from "@/lib/validation";
import { auditLog } from "@/lib/audit-log";

/** GET /api/me — return basic profile of the logged-in user from JWT */
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
  const rawBody = await parseBodyWithLimit(request, 10_000);
  if (rawBody === null) {
    return NextResponse.json(
      { message: "Request body too large." },
      { status: 413 },
    );
  }

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
    user.password = await bcrypt.hash(newPassword, 12);
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  }

  await user.save();

  auditLog("user.password.changed", {
    actorId: String(user._id),
    actorRole: auth.role,
    ip,
  });

  // Re-issue JWT so profile changes (e.g. name) are reflected immediately.
  const newToken = await new SignJWT({
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    sessionVersion: user.sessionVersion ?? 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h")
    .sign(getJwtSecret());

  const response = NextResponse.json({ message: "Profile updated" });
  response.cookies.set("em_session", newToken, SESSION_COOKIE_OPTS);
  return response;
}
