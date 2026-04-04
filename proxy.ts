import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "default-secret");

// Public routes that don't require authentication
const PUBLIC_PAGE_ROUTES = ["/login", "/register"];
const PUBLIC_API_ROUTES = ["/api/auth/login", "/api/auth/register"];

async function verifyAuthToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a public route
  const isPublicPage = PUBLIC_PAGE_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));
  const isPublicApi = PUBLIC_API_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));

  // Public routes are always accessible
  if (isPublicPage || isPublicApi) {
    return NextResponse.next();
  }

  // For all other routes, require authentication
  const token = request.cookies.get("auth_token")?.value;

  if (!token || !(await verifyAuthToken(token))) {
    // API routes return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    // Page routes redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
