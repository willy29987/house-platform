import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { getLineChannelAccessToken } from "@/lib/line-messaging";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const { messageId: rawId } = await context.params;
  const messageId = rawId?.trim() ?? "";
  // LINE message id 為數字字串；拒絕奇怪路徑
  if (!/^\d{1,64}$/.test(messageId)) {
    return NextResponse.json({ error: "invalid message id" }, { status: 400 });
  }

  const token = await getLineChannelAccessToken();
  if (!token) {
    return NextResponse.json({ error: "missing line token" }, { status: 503 });
  }

  const upstream = await fetch(
    `https://api-data.line.me/v2/bot/message/${messageId}/content`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "content unavailable", status: upstream.status, detail: detail.slice(0, 200) },
      { status: upstream.status === 404 ? 404 : 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const contentLength = upstream.headers.get("content-length");
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600",
  });
  if (contentLength) headers.set("Content-Length", contentLength);

  return new Response(upstream.body, { status: 200, headers });
}
