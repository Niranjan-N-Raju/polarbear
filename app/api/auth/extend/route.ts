import { NextRequest, NextResponse } from "next/server";
import { getJwtSecret } from "@/lib/server-env";
import { CLEAR_COOKIE_OPTS, SESSION_COOKIE_OPTS } from "@/lib/cookie-opts";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import { validateCsrf } from "@/lib/csrf";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit-log";
import { getSessionCookieToken } from "@/lib/auth";
import {
  PASSWORD_CHANGE_COOKIE,
  SESSION_COOKIE,
  getSessionStart,
  isSessionExpiredAbsolute,
  signSessionToken,
  verifySessionToken,
} from "@/lib/session-token";

function unauthorized(message: string) {
  const response = NextResponse.json({ message }, { status: 401 });
  response.cookies.set(SESSION_COOKIE, "", CLEAR_COOKIE_OPTS);
  response.cookies.set(PASSWORD_CHANGE_COOKIE, "", CLEAR_COOKIE_OPTS);
  return response;
}

export async function POST(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`session-extend:${ip}`, RATE_LIMITS.sessionExtend);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { message: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000)) } },
    );
  }

  const cookieToken = await getSessionCookieToken();
  if (!cookieToken) {
    return NextResponse.json({ message: "Session not found." }, { status: 401 });
  }

  try {
    // Re-verify the existing session first; only valid sessions can be extended.
    const payload = await verifySessionToken(cookieToken.token, getJwtSecret());
    // Sliding extensions are capped at 24h after the original login.
    if (isSessionExpiredAbsolute(payload)) {
      return unauthorized("Session expired. Please sign in again.");
    }
    const sessionStart = getSessionStart(payload) as number;

    // Verify the account is still active and this session has not been revoked.
    await connectToDatabase();
    const user = await User.findById(payload.id)
      .select("_id name email role isActive sessionVersion mustChangePassword")
      .lean();
    const sessionVersion = typeof user?.sessionVersion === "number" ? user.sessionVersion : 0;
    if (!user || user.isActive === false || sessionVersion !== payload.sessionVersion) {
      return unauthorized("User no longer exists.");
    }

    const mustChangePassword = cookieToken.restricted || user.mustChangePassword === true;
    const refreshedToken = await signSessionToken(
      {
        id: payload.id,
        role: user.role,
        name: user.name,
        email: user.email,
        sessionVersion,
        sessionStart,
        mustChangePassword,
      },
      getJwtSecret(),
    );

    auditLog("auth.session.extended", { actorId: payload.id, actorRole: user.role, ip });

    const response = NextResponse.json({ message: "Session extended." });
    // Sliding-session behavior: issue a fresh 8h cookie from now (bounded by the 24h cap above).
    response.cookies.set(
      cookieToken.restricted ? PASSWORD_CHANGE_COOKIE : SESSION_COOKIE,
      refreshedToken,
      SESSION_COOKIE_OPTS,
    );
    return response;
  } catch {
    return unauthorized("Invalid session.");
  }
}
