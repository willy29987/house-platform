import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_USERNAME_COOKIE = "admin_username";

export type AdminRole = "SUPER_ADMIN" | "OPERATOR";

export type CurrentAdmin = {
  username: string;
  role: AdminRole;
  source: "env" | "db";
  id?: string;
};

export function getAdminSessionToken() {
  return process.env.ADMIN_SESSION_TOKEN;
}

export function hasAdminCredentials() {
  return Boolean(
    process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_TOKEN,
  );
}

export function isValidEnvAdminLogin(username: string, password: string) {
  if (!hasAdminCredentials()) {
    return false;
  }
  return username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD;
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const expected = getAdminSessionToken();
  return Boolean(token && expected && token === expected);
}

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const authed = await isAdminAuthenticated();
  if (!authed) return null;

  const cookieStore = await cookies();
  const username = cookieStore.get(ADMIN_USERNAME_COOKIE)?.value;
  if (!username) return null;

  if (process.env.ADMIN_USERNAME && username === process.env.ADMIN_USERNAME) {
    return { username, role: "SUPER_ADMIN", source: "env" };
  }

  if (!process.env.DATABASE_URL) return null;

  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.adminUser.findUnique({
    where: { username },
    select: { id: true, username: true, role: true },
  });
  if (!user) return null;
  return { id: user.id, username: user.username, role: user.role as AdminRole, source: "db" };
}

export async function requireAdminSession() {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    return NextResponse.json({ ok: false, message: "未授權" }, { status: 401 });
  }
  return null;
}

export async function requireSuperAdmin() {
  const current = await getCurrentAdmin();
  if (!current) {
    return NextResponse.json({ ok: false, message: "未授權" }, { status: 401 });
  }
  if (current.role !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false, message: "需要最高管理員權限" }, { status: 403 });
  }
  return null;
}
