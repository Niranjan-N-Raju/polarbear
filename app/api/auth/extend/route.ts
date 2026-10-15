import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/server-env";
import { SESSION_COOKIE_OPTS } from "@/lib/cookie-opts";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import { validateCsrf } from "@/lib/csrf";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit-log";

const COOKIE_NAME = "em_session";

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

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json(
      { message: "Session not found." },
      { status: 401 },
    );
  }

  try {
    // Re-verify the existing session first; only valid sessions can be extended.
    const { payload } = await jwtVerify(token, getJwtSecret());
    const id = payload.id as string | undefined;
    const tokenSessionVersion =
      typeof payload.sessionVersion === "number" && Number.isInteger(payload.sessionVersion)
        ? payload.sessionVersion
        : 0;

    if (!id) {
      return NextResponse.json(
        { message: "Invalid session." },
        { status: 401 },
      );
    }

    // Verify the account is still active and this session has not been revoked.
    await connectToDatabase();
    const user = await User.findById(id)
      .select("_id name email role isActive sessionVersion")
      .lean();
    const sessionVersion = typeof user?.sessionVersion === "number" ? user.sessionVersion : 0;
    if (!user || user.isActive === false || sessionVersion !== tokenSessionVersion) {
      const response = NextResponse.json(
        { message: "User no longer exists." },
        { status: 401 },
      );
      response.cookies.set(COOKIE_NAME, "", { ...SESSION_COOKIE_OPTS, maxAge: 0 });
      return response;
    }

    const refreshedToken = await new SignJWT({
      id,
      role: user.role,
      name: user.name,
      email: user.email,
      sessionVersion,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .sign(getJwtSecret());

    auditLog("auth.session.extended", { actorId: id, actorRole: user.role, ip });

    const response = NextResponse.json({ message: "Session extended." });
    // Sliding-session behavior: issue a fresh 8h cookie from now.
    response.cookies.set(COOKIE_NAME, refreshedToken, SESSION_COOKIE_OPTS);
    return response;
  } catch {
    const response = NextResponse.json(
      { message: "Invalid session." },
      { status: 401 },
    );
    response.cookies.set(COOKIE_NAME, "", {
      ...SESSION_COOKIE_OPTS,
      maxAge: 0,
    });
    return response;
  }
}
