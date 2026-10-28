import { cookies } from "next/headers";
import { getJwtSecret } from "./server-env";
import { connectToDatabase } from "./mongodb";
import {
  PASSWORD_CHANGE_COOKIE,
  SESSION_COOKIE,
  verifySessionToken,
  type SessionPayload,
} from "./session-token";
import User from "@/models/User";

export interface AuthInfo {
  id: string;
  role: string;
  name?: string;
  /** True when the account must change its password before using the app. */
  mustChangePassword?: boolean;
}

/** Returns the current session token (full or password-change-only) from the cookie store. */
export async function getSessionCookieToken(): Promise<{ token: string; restricted: boolean } | null> {
  const cookieStore = await cookies();
  const full = cookieStore.get(SESSION_COOKIE)?.value;
  if (full) return { token: full, restricted: false };
  const restricted = cookieStore.get(PASSWORD_CHANGE_COOKIE)?.value;
  return restricted ? { token: restricted, restricted: true } : null;
}

/** Verifies the session cookie token; returns its payload or null. */
export async function getVerifiedSessionPayload(): Promise<
  { payload: SessionPayload; restricted: boolean } | null
> {
  const cookieToken = await getSessionCookieToken();
  if (!cookieToken) return null;
  try {
    const payload = await verifySessionToken(cookieToken.token, getJwtSecret());
    return { payload, restricted: cookieToken.restricted };
  } catch {
    return null;
  }
}

/**
 * Reads and verifies the session cookie, then checks the user is still active and
 * the session has not been revoked (sessionVersion). Returns null when invalid.
 */
export async function getAuthInfo(): Promise<AuthInfo | null> {
  const verified = await getVerifiedSessionPayload();
  if (!verified) return null;
  const { payload, restricted } = verified;

  try {
    await connectToDatabase();
    const user = await User.findById(payload.id)
      .select("name role isActive sessionVersion mustChangePassword")
      .lean();
    if (!user || user.isActive === false) return null;
    const sessionVersion = typeof user.sessionVersion === "number" ? user.sessionVersion : 0;
    if (sessionVersion !== payload.sessionVersion || !user.role) return null;

    return {
      id: payload.id,
      role: user.role,
      name: user.name,
      mustChangePassword:
        restricted || payload.mustChangePassword === true || user.mustChangePassword === true,
    };
  } catch {
    return null;
  }
}
