import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";

function isProtectedPath(pathname: string) {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

function normalizeHost(host: string | null) {
  if (!host) return "";
  return host.split(":")[0]?.toLowerCase() ?? "";
}

function buildRedirectUrl(request: NextRequest, host: string) {
  const url = request.nextUrl.clone();
  url.host = host;
  url.protocol = "https:";
  return url;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHost = normalizeHost(request.headers.get("host"));

  const publicHost = normalizeHost(process.env.PUBLIC_SITE_HOST ?? null);
  const adminHost = normalizeHost(process.env.ADMIN_SITE_HOST ?? null);

  // 內外網分流（正式環境有設定 host 時才啟用；本機開發不影響）
  if (publicHost && adminHost) {
    const isAdminPath = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

    // 外網網域誤進內網路徑 => 轉到內網網域
    if (isAdminPath && requestHost === publicHost) {
      return NextResponse.redirect(buildRedirectUrl(request, adminHost));
    }

    // 內網網域誤進外網路徑 => 轉到外網網域
    if (!isAdminPath && requestHost === adminHost) {
      return NextResponse.redirect(buildRedirectUrl(request, publicHost));
    }
  }

  const isPublicAdminPath =
    pathname === "/admin/login" ||
    pathname === "/api/admin/login" ||
    pathname === "/api/admin/login-form" ||
    pathname === "/api/admin/logout";

  if (!isProtectedPath(pathname) || isPublicAdminPath) {
    return NextResponse.next();
  }

  const expectedToken = process.env.ADMIN_SESSION_TOKEN;
  const session = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (expectedToken && session === expectedToken) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin/login", request.url);
  if (pathname !== "/admin/login") {
    loginUrl.searchParams.set("next", pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
