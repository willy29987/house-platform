import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import {
  removeAdminPushSubscription,
  upsertAdminPushSubscription,
} from "@/lib/admin-web-push";

export const dynamic = "force-dynamic";

type Body = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const endpoint = body.endpoint?.trim() ?? "";
  const p256dh = body.keys?.p256dh?.trim() ?? "";
  const auth = body.keys?.auth?.trim() ?? "";
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "缺少 subscription" }, { status: 400 });
  }

  await upsertAdminPushSubscription({
    endpoint,
    keys: { p256dh, auth },
    userAgent: request.headers.get("user-agent") || undefined,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let body: { endpoint?: string };
  try {
    body = (await request.json()) as { endpoint?: string };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const endpoint = body.endpoint?.trim() ?? "";
  if (!endpoint) {
    return NextResponse.json({ error: "缺少 endpoint" }, { status: 400 });
  }

  await removeAdminPushSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
