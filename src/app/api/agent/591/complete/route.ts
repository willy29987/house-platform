import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSync591AgentToken, completeSync591Job, touchSync591AgentHeartbeat } from "@/lib/591-sync-jobs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  jobId: z.string().min(1),
  status: z.enum(["done", "failed", "needs_login"]),
  error: z.string().optional().nullable(),
  logLine: z.string().optional(),
  result591Id: z.string().optional().nullable(),
  result591Url: z.string().optional().nullable(),
  result591Status: z
    .enum(["unknown", "published", "unpublished", "not_found", "needs_login", "sync_error"])
    .optional()
    .nullable(),
  resultExpiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  label: z.string().optional(),
});

export async function POST(request: Request) {
  if (!(await assertSync591AgentToken(request.headers.get("authorization")))) {
    return NextResponse.json({ ok: false, message: "未授權" }, { status: 401 });
  }
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, message: "參數無效" }, { status: 400 });
  }
  await touchSync591AgentHeartbeat(body.label);
  const job = await completeSync591Job(body);
  if (!job) return NextResponse.json({ ok: false, message: "找不到任務" }, { status: 404 });
  return NextResponse.json({ ok: true, job });
}
