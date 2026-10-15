import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getJwtSecret } from "./server-env";
import { connectToDatabase } from "./mongodb";
import User from "@/models/User";

export interface AuthInfo {
  id: string;
  role: string;
  name?: string;
}

/**
 * Reads and verifies the em_session cookie.
 * Returns { id, role } on success, or null if the token is missing/invalid.
 */
export async function getAuthInfo(): Promise<AuthInfo | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("em_session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const tokenSessionVersion =
      typeof payload.sessionVersion === "number" && Number.isInteger(payload.sessionVersion)
        ? payload.sessionVersion
        : 0;

    // Support legacy token shapes in addition to the current `id` claim.
    let id =
      (payload.id as string | undefined) ??
      (payload.userId as string | undefined) ??
      (payload._id as string | undefined) ??
      payload.sub;

    // Last-resort fallback for old sessions: resolve user id by email from JWT.
    if (!id) {
      const email = (payload.email as string | undefined)?.toLowerCase().trim();
      if (email) {
        await connectToDatabase();
        const user = await User.findOne({ email }).select("_id").lean();
        if (user?._id) {
          id = String(user._id);
        }
      }
    }

    if (!id) return null;

    await connectToDatabase();
    const user = await User.findById(id).select("name role isActive sessionVersion").lean();
    if (!user || user.isActive === false) return null;
    const sessionVersion = typeof user.sessionVersion === "number" ? user.sessionVersion : 0;
    if (sessionVersion !== tokenSessionVersion || !user.role) return null;

    return { id, role: user.role, name: user.name };
  } catch {
    return null;
  }
}
