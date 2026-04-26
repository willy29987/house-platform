import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_USERNAME_COOKIE,
  getAdminSessionToken,
  hasAdminCredentials,
  isValidEnvAdminLogin,
} from "@/lib/admin-auth";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "請輸入帳號密碼。" }, { status: 400 });
  }

  const { username, password } = parsed.data;
  let valid = false;

  if (process.env.DATABASE_URL) {
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.adminUser.findUnique({ where: { username } });
    if (user && user.password === password) {
      valid = true;
    }
  }

  if (!valid && hasAdminCredentials()) {
    valid = isValidEnvAdminLogin(username, password);
  }

  if (!valid) {
    return NextResponse.json({ ok: false, message: "帳號或密碼錯誤。" }, { status: 401 });
  }

  const token = getAdminSessionToken();
  if (!token) {
    return NextResponse.json(
      { ok: false, message: "尚未設定 ADMIN_SESSION_TOKEN 環境變數。" },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ ok: true });
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
