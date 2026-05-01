import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";

type ApiAdminUser = {
  id: string;
  username: string;
  displayName: string | null;
  role: "SUPER_ADMIN" | "OPERATOR";
  createdAt: Date;
};

const createUserSchema = z.object({
  username: z.string().min(2, "帳號至少 2 個字"),
  displayName: z.string().trim().min(1, "請填寫業務姓名").optional(),
  password: z.string().min(6, "密碼至少 6 個字"),
  role: z.enum(["SUPER_ADMIN", "OPERATOR"]).optional(),
});

export async function GET() {
  const authError = await requireSuperAdmin();
  if (authError) return authError;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, message: "未連接資料庫。" }, { status: 400 });
  }

  const adminUser = prisma.adminUser as any;
  let users: ApiAdminUser[];
  try {
    users = await adminUser.findMany({
      select: { id: true, username: true, displayName: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    const fallback = await adminUser.findMany({
      select: { id: true, username: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    users = fallback.map((u: { id: string; username: string; role: "SUPER_ADMIN" | "OPERATOR"; createdAt: Date }) => ({
      ...u,
      displayName: null,
    }));
  }

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

  const adminUser = prisma.adminUser as any;
  const exists = await adminUser.findUnique({
    where: { username: parsed.data.username },
  });
  if (exists) {
    return NextResponse.json({ ok: false, message: "此帳號名稱已被使用。" }, { status: 409 });
  }

  let user: ApiAdminUser;
  try {
    user = await adminUser.create({
      data: {
        username: parsed.data.username,
        displayName: parsed.data.displayName?.trim() || null,
        password: parsed.data.password,
        role: parsed.data.role ?? "OPERATOR",
      },
      select: { id: true, username: true, displayName: true, role: true, createdAt: true },
    });
  } catch {
    const created = await adminUser.create({
      data: {
        username: parsed.data.username,
        password: parsed.data.password,
        role: parsed.data.role ?? "OPERATOR",
      },
      select: { id: true, username: true, role: true, createdAt: true },
    });
    user = { ...created, displayName: null };
  }

  return NextResponse.json({ ok: true, user });
}
