import { NextResponse } from "next/server";
import { parseAdminCloudDataKey } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import { requireAdminSession } from "@/lib/admin-auth";

type RouteContext = { params: Promise<{ key: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAdminSession();
  if (guard) return guard;

  const { key: rawKey } = await context.params;
  const key = parseAdminCloudDataKey(rawKey);
  if (!key) {
    return NextResponse.json({ ok: false, message: "未知的資料類型" }, { status: 400 });
  }

  const payload = await readAdminCloudPayload(key);
  return NextResponse.json({ ok: true, payload });
}

export async function PUT(request: Request, context: RouteContext) {
  const guard = await requireAdminSession();
  if (guard) return guard;

  const { key: rawKey } = await context.params;
  const key = parseAdminCloudDataKey(rawKey);
  if (!key) {
    return NextResponse.json({ ok: false, message: "未知的資料類型" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "JSON 格式錯誤" }, { status: 400 });
  }

  const payload =
    body !== null && typeof body === "object" && "payload" in body
      ? (body as { payload: unknown }).payload
      : body;

  await writeAdminCloudPayload(key, payload);
  return NextResponse.json({ ok: true });
}
