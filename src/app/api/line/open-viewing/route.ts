import { NextResponse } from "next/server";
import { findLatestOpenViewing } from "@/lib/line-rental-cases";

export const dynamic = "force-dynamic";

/** LIFF 用：這位客人是否已有進行中約看，以便同一時段併入而不是另開一筆 */
export async function GET(request: Request) {
  const lineUserId = new URL(request.url).searchParams.get("lineUserId")?.trim() ?? "";
  if (!lineUserId) {
    return NextResponse.json({ error: "缺少 lineUserId" }, { status: 400 });
  }

  const viewing = await findLatestOpenViewing(lineUserId);
  if (!viewing) {
    return NextResponse.json({ viewing: null });
  }

  return NextResponse.json({
    viewing: {
      id: viewing.id,
      requestedWhen: viewing.requestedWhen,
      titles: viewing.picked.map((item) => item.title).filter(Boolean),
      picked: viewing.picked.map((item) => ({
        id: item.id,
        title: item.title,
        price: item.price,
      })),
    },
  });
}
