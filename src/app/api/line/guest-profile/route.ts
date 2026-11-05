import { NextResponse } from "next/server";
import { getGuestProfileByUserId, isCompleteGuestProfile } from "@/lib/line-guest-profile";

export const dynamic = "force-dynamic";

/** LIFF 用 LINE userId 取回已存個資，避免再次填寫 */
export async function GET(request: Request) {
  const lineUserId = new URL(request.url).searchParams.get("lineUserId")?.trim() ?? "";
  if (!lineUserId) {
    return NextResponse.json({ error: "缺少 lineUserId" }, { status: 400 });
  }

  const profile = await getGuestProfileByUserId(lineUserId);
  if (!profile) {
    return NextResponse.json({ profile: null, complete: false });
  }

  return NextResponse.json({
    profile,
    complete: isCompleteGuestProfile(profile),
  });
}
