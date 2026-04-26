import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";

const createUserSchema = z.object({
  username: z.string().min(2, "帳號至少 2 個字"),
  password: z.string().min(6, "密碼至少 6 個字"),
  role: z.enum(["SUPER_ADMIN", "OPERATOR"]).optional(),
});

export async function GET() {
  const authError = await requireSuperAdmin();
  if (authError) return authError;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, message: "未連接資料庫。" }, { status: 400 });
  }

  const users = await prisma.adminUser.findMany({
    select: { id: true, username: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ ok: true, users });
}

export async function POST(request: Request) {
  const authError = await requireSuperAdmin();
  if (authError) return authError;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, message: "未連接資料庫。" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "欄位格式錯誤";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const exists = await prisma.adminUser.findUnique({
    where: { username: parsed.data.username },
  });
  if (exists) {
    return NextResponse.json({ ok: false, message: "此帳號名稱已被使用。" }, { status: 409 });
  }

  const user = await prisma.adminUser.create({
    data: {
      username: parsed.data.username,
      password: parsed.data.password,
      role: parsed.data.role ?? "OPERATOR",
    },
    select: { id: true, username: true, role: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, user });
}
