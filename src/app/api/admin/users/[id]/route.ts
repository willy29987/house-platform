import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";

const updateSchema = z.object({
  password: z.string().min(6, "密碼至少 6 個字").optional(),
  role: z.enum(["SUPER_ADMIN", "OPERATOR"]).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const authError = await requireSuperAdmin();
  if (authError) return authError;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, message: "未連接資料庫。" }, { status: 400 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "欄位格式錯誤";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const exists = await prisma.adminUser.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ ok: false, message: "找不到此帳號。" }, { status: 404 });
  }

  const updateData: { password?: string; role?: "SUPER_ADMIN" | "OPERATOR" } = {};
  if (parsed.data.password) updateData.password = parsed.data.password;
  if (parsed.data.role) updateData.role = parsed.data.role;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ ok: false, message: "沒有提供要更新的欄位" }, { status: 400 });
  }

  await prisma.adminUser.update({ where: { id }, data: updateData });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const authError = await requireSuperAdmin();
  if (authError) return authError;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, message: "未連接資料庫。" }, { status: 400 });
  }

  const { id } = await params;
  const exists = await prisma.adminUser.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ ok: false, message: "找不到此帳號。" }, { status: 404 });
  }

  await prisma.adminUser.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
