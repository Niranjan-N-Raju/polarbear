import { NextRequest, NextResponse } from "next/server";
import { CLEAR_COOKIE_OPTS } from "@/lib/cookie-opts";
import { getJwtSecret } from "@/lib/server-env";
import {
  PASSWORD_CHANGE_COOKIE,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/session-token";

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
  "/pnl",
  "/withdrawals",
];
const PROTECTED_ROUTES = [
  "/dashboard",
  "/profile",
  "/docs",
  ...GLOBAL_ADMIN_ROUTES,
  ...FRANCHISE_ADMIN_ROUTES,
];
const LOGIN_PATH = "/login";
const PROFILE_PATH = "/profile";

function redirectToLogin(request: NextRequest) {
  // Preserve the attempted path so login can return users to where they were.
  const loginUrl = new URL(LOGIN_PATH, request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const fullToken = request.cookies.get(SESSION_COOKIE)?.value;
  const restrictedToken = request.cookies.get(PASSWORD_CHANGE_COOKIE)?.value;
  const token = fullToken ?? restrictedToken;

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

  // Fail fast if JWT_SECRET is missing or too weak.
  let secret: Uint8Array;
  try {
    secret = getJwtSecret();
  } catch (error) {
    console.error("[PROXY] Invalid JWT_SECRET — blocking all protected routes.", error);
    return redirectToLogin(request);
  }

  try {
    // Parse and verify JWT in the proxy layer to keep protected routes fast.
    const payload = await verifySessionToken(token, secret);
    const role = payload.role as string;

    // Accounts with an admin-issued password may only reach the profile page until they change it.
    const mustChangePassword = !fullToken || payload.mustChangePassword === true;
    if (mustChangePassword) {
      if (pathname === PROFILE_PATH || pathname.startsWith(PROFILE_PATH + "/")) {
        return NextResponse.next();
      }
      const profileUrl = new URL(PROFILE_PATH, request.url);
      profileUrl.searchParams.set("passwordChangeRequired", "1");
      return NextResponse.redirect(profileUrl);
    }

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
    response.cookies.set(SESSION_COOKIE, "", CLEAR_COOKIE_OPTS);
    response.cookies.set(PASSWORD_CHANGE_COOKIE, "", CLEAR_COOKIE_OPTS);
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
    "/pnl/:path*",
    "/withdrawals/:path*",
    "/stores/:path*",
    "/users/:path*",
    "/docs/:path*",
    "/docs",
  ],
};
