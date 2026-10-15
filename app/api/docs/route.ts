import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/auth";
import spec from "@/lib/openapi-spec";

/** GET /api/docs — serves the OpenAPI 3.0 JSON spec to authenticated admins. */
export async function GET() {
  const auth = await getAuthInfo();
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (! ["admin", "sub_admin", "franchise_admin"].includes(auth.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
