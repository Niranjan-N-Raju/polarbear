import { NextRequest, NextResponse } from "next/server";
import { CLEAR_COOKIE_OPTS } from "@/lib/cookie-opts";
import { validateCsrf } from "@/lib/csrf";
import { getVerifiedSessionPayload } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { PASSWORD_CHANGE_COOKIE, SESSION_COOKIE } from "@/lib/session-token";
import User from "@/models/User";

export async function POST(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  // Revoke server-side so copies of this cookie stop working; cookies are cleared regardless.
  try {
    const verified = await getVerifiedSessionPayload();
    if (verified) {
      await connectToDatabase();
      await User.updateOne(
        { _id: verified.payload.id, sessionVersion: verified.payload.sessionVersion },
        { $inc: { sessionVersion: 1 } },
      );
    }
  } catch (error) {
    console.error("[LOGOUT_REVOKE_ERROR]", error);
  }

  const response = NextResponse.json({ message: "Logged out." });
  response.cookies.set(SESSION_COOKIE, "", CLEAR_COOKIE_OPTS);
  response.cookies.set(PASSWORD_CHANGE_COOKIE, "", CLEAR_COOKIE_OPTS);
  response.cookies.set("em_franchise", "", CLEAR_COOKIE_OPTS);
  response.cookies.set("em_franchise_name", "", CLEAR_COOKIE_OPTS);
  return response;
}
