import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { cookies } from "next/headers";

const FRANCHISE_COOKIE = "em_franchise";
const FRANCHISE_NAME_COOKIE = "em_franchise_name";

/** GET /api/stores/active — returns the currently active store from session cookies */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const cookieStore = await cookies();
  const id = cookieStore.get(FRANCHISE_COOKIE)?.value ?? null;
  const name = cookieStore.get(FRANCHISE_NAME_COOKIE)?.value ?? null;

  return NextResponse.json({ id, name });
}
