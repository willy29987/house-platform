import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, ADMIN_USERNAME_COOKIE } from "@/lib/admin-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const expired = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  response.cookies.set(ADMIN_SESSION_COOKIE, "", expired);
  response.cookies.set(ADMIN_USERNAME_COOKIE, "", expired);
  return response;
}
