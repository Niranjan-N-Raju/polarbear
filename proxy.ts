import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { CLEAR_COOKIE_OPTS } from "@/lib/cookie-opts";

// Routes accessible only to admin / sub_admin
const GLOBAL_ADMIN_ROUTES = ["/stores", "/users"];
// Routes accessible only to franchise_admin
const FRANCHISE_ADMIN_ROUTES = [
  "/employees",
  "/attendance",
  "/store-config",
  "/inventory",
  "/salary",
  "/sales",
];
const PROTECTED_ROUTES = [
  "/dashboard",
  "/profile",
  "/docs",
  ...GLOBAL_ADMIN_ROUTES,
  ...FRANCHISE_ADMIN_ROUTES,
];
const LOGIN_PATH = "/login";
const COOKIE_NAME = "em_session";

function redirectToLogin(request: NextRequest) {
  // Preserve the attempted path so login can return users to where they were.
  const loginUrl = new URL(LOGIN_PATH, request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (pathname === LOGIN_PATH) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!token) {
    return redirectToLogin(request);
  }

  // Fail fast if JWT_SECRET is not configured
  const jwtSecretRaw = process.env.JWT_SECRET;
  if (!jwtSecretRaw) {
    console.error(
      "[PROXY] JWT_SECRET is not set — blocking all protected routes.",
    );
    return redirectToLogin(request);
  }

  try {
    // Parse and verify JWT in the edge layer to keep protected routes fast.
    const secret = new TextEncoder().encode(jwtSecretRaw);
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role as string;

    const isGlobalAdminRoute = GLOBAL_ADMIN_ROUTES.some(
      (r) => pathname === r || pathname.startsWith(r + "/"),
    );
    const isFranchiseAdminRoute = FRANCHISE_ADMIN_ROUTES.some(
      (r) => pathname === r || pathname.startsWith(r + "/"),
    );

    if (isGlobalAdminRoute && role !== "admin" && role !== "sub_admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (isFranchiseAdminRoute && role !== "franchise_admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  } catch {
    // Invalid/expired session: clear cookie and force re-authentication.
    const response = redirectToLogin(request);
    response.cookies.set(COOKIE_NAME, "", CLEAR_COOKIE_OPTS);
    return response;
  }
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/profile/:path*",
    "/employees/:path*",
    "/attendance/:path*",
    "/store-config/:path*",
    "/inventory/:path*",
    "/salary/:path*",
    "/sales/:path*",
    "/stores/:path*",
    "/users/:path*",
    "/docs/:path*",
    "/docs",
  ],
};
