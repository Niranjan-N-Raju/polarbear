import { NextRequest, NextResponse } from "next/server";
import { CLEAR_COOKIE_OPTS } from "@/lib/cookie-opts";
import { validateCsrf } from "@/lib/csrf";

export async function POST(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const response = NextResponse.json({ message: "Logged out." });
  response.cookies.set("em_session", "", CLEAR_COOKIE_OPTS);
  response.cookies.set("em_franchise", "", CLEAR_COOKIE_OPTS);
  response.cookies.set("em_franchise_name", "", CLEAR_COOKIE_OPTS);
  return response;
}
