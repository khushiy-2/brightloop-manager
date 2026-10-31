import { Role } from "@prisma/client";
import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "session";
const PUBLIC_AUTH_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

async function getRole(token: string | undefined): Promise<Role | null> {
  const secret = process.env.JWT_SECRET;
  if (!token || !secret || new TextEncoder().encode(secret).byteLength < 32) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    if (payload.role === Role.ADMIN || payload.role === Role.STAFF || payload.role === Role.CUSTOMER) {
      return payload.role;
    }
  } catch {
    return null;
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthApi = pathname.startsWith("/api/auth/");
  if (isAuthApi || PUBLIC_AUTH_PATHS.has(pathname)) return NextResponse.next();

  const role = await getRole(request.cookies.get(SESSION_COOKIE)?.value);
  if (!role) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  const isPortalPath = pathname === "/portal" || pathname.startsWith("/portal/");
  if (role === Role.CUSTOMER && !isPortalPath) {
    const portalUrl = request.nextUrl.clone();
    portalUrl.pathname = "/portal";
    portalUrl.search = "";
    return NextResponse.redirect(portalUrl);
  }
  if (role !== Role.CUSTOMER && isPortalPath) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};