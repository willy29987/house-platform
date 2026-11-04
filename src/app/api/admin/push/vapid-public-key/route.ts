import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getAdminWebPushPublicKey } from "@/lib/admin-web-push";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  try {
    const publicKey = await getAdminWebPushPublicKey();
    return NextResponse.json(
      { publicKey },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[admin/push/vapid-public-key]", error);
    return NextResponse.json({ error: "vapid unavailable" }, { status: 500 });
  }
}
