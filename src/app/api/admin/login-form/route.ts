import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_USERNAME_COOKIE,
  getAdminSessionToken,
  hasAdminCredentials,
  isValidEnvAdminLogin,
} from "@/lib/admin-auth";

function safeNextPath(raw: string | null) {
  const path = (raw ?? "/admin").trim() || "/admin";
  if (!path.startsWith("/") || path.startsWith("//")) return "/admin";
  return path;
}

function urlWithRequestHost(path: string, request: Request) {
  const url = new URL(path, request.url);
  const host = request.headers.get("host");
  if (host) url.host = host;
  return url;
}

async function validateLogin(username: string, password: string) {
  if (hasAdminCredentials() && isValidEnvAdminLogin(username, password)) {
    return true;
  }

  if (!process.env.DATABASE_URL) return false;

  try {
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.adminUser.findUnique({ where: { username } });
    return Boolean(user && user.password === password);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeNextPath(String(form.get("next") ?? "/admin"));

  const loginUrl = urlWithRequestHost("/admin/login", request);
  loginUrl.searchParams.set("next", next);

  if (!username || !password) {
    loginUrl.searchParams.set("error", "請輸入帳號密碼。");
    return NextResponse.redirect(loginUrl);
  }

  const valid = await validateLogin(username, password);
  if (!valid) {
    loginUrl.searchParams.set("error", "帳號或密碼錯誤。");
    return NextResponse.redirect(loginUrl);
  }

  const token = getAdminSessionToken();
  if (!token) {
    loginUrl.searchParams.set("error", "尚未設定 ADMIN_SESSION_TOKEN 環境變數。");
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.redirect(urlWithRequestHost(next, request));
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 12,
  };
  response.cookies.set(ADMIN_SESSION_COOKIE, token, cookieOpts);
  response.cookies.set(ADMIN_USERNAME_COOKIE, username, cookieOpts);
  return response;
}
