import { NextRequest, NextResponse } from "next/server";
import { readJsonObject } from "@/lib/request-json";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Franchise from "@/models/Franchise";
import { getJwtSecret } from "@/lib/server-env";
import { SESSION_COOKIE_OPTS } from "@/lib/cookie-opts";
import {
  checkLoginAccountRateLimit,
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  resetLoginAccountRateLimit,
  resetRateLimit,
} from "@/lib/rate-limit";
import { validateCsrf } from "@/lib/csrf";
import { loginBodySchema } from "@/lib/validation";
import { auditLog } from "@/lib/audit-log";

import { CLEAR_COOKIE_OPTS } from "@/lib/cookie-opts";
import {
  PASSWORD_CHANGE_COOKIE,
  SESSION_COOKIE,
  nowSeconds,
  signSessionToken,
} from "@/lib/session-token";

let dummyHashPromise: Promise<string> | null = null;

/** Lazily computed bcrypt hash used to equalise timing when the email is unknown. */
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= bcrypt.hash("polar-bear-timing-equaliser", 12).catch((error) => {
    dummyHashPromise = null;
    throw error;
  });
  return dummyHashPromise;
}

/** Non-reversible identifier so audit logs never contain the raw email address. */
function emailFingerprint(email: string): string {
  return createHash("sha256").update(email).digest("hex").slice(0, 16);
}

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
    const jsonBody = await readJsonObject(request, 10_000);
    if (jsonBody.response) return jsonBody.response;
    const rawBody = jsonBody.body;

    // Validate with zod schema
    const parsed = loginBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const { password } = parsed.data;
    const email = parsed.data.email.toLowerCase().trim();
    const accountRateCheck = checkLoginAccountRateLimit(email, ip);
    if (!accountRateCheck.allowed) {
      auditLog("auth.login.failed", { ip, metadata: { reason: "account_rate_limited" } });
      return NextResponse.json(
        { message: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((accountRateCheck.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    await connectToDatabase();

    const user = await User.findOne({
      email,
      isActive: { $ne: false },
    }).select("password name role email franchises sessionVersion mustChangePassword");

    if (!user) {
      // Spend comparable time to a real check so response timing doesn't reveal unknown emails.
      await bcrypt.compare(password, await getDummyHash());
      auditLog("auth.login.failed", {
        ip,
        metadata: { emailHash: emailFingerprint(email), reason: "user_not_found" },
      });
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

    // Successful — clear rate-limit counters for this IP / account+IP
    resetRateLimit(`login:${ip}`);
    resetLoginAccountRateLimit(email, ip);

    const mustChangePassword = user.mustChangePassword === true;
    const token = await signSessionToken(
      {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        sessionVersion: user.sessionVersion ?? 0,
        sessionStart: nowSeconds(),
        mustChangePassword,
      },
      getJwtSecret(),
    );

    auditLog("auth.login.success", { actorId: String(user._id), actorRole: user.role, ip });

    const response = NextResponse.json(
      {
        message: "Login successful.",
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword,
        },
        mustChangePassword,
      },
      { status: 200 },
    );

    if (mustChangePassword) {
      // Only a restricted password-change session is issued; no full app session.
      response.cookies.set(SESSION_COOKIE, "", CLEAR_COOKIE_OPTS);
      response.cookies.set(PASSWORD_CHANGE_COOKIE, token, SESSION_COOKIE_OPTS);
    } else {
      response.cookies.set(PASSWORD_CHANGE_COOKIE, "", CLEAR_COOKIE_OPTS);
      response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTS);
    }

    return response;
  } catch (error) {
    console.error("[LOGIN_ERROR]", error);
    return NextResponse.json(
      { message: "An internal server error occurred." },
      { status: 500 },
    );
  }
}
