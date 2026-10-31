import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { appendLineRentalCase, readLineRentalCases } from "@/lib/line-rental-cases";
import { pushLineTextMessage } from "@/lib/line-messaging";
import { getViewingAgentUserIds, notifyAgentsOfNewViewing } from "@/lib/line-viewing-agent";

export const dynamic = "force-dynamic";

type PostBody = {
  lineUserId?: string | null;
  displayName?: string;
  phone?: string;
  occupation?: string;
  nationality?: string;
  peopleCount?: number;
  petNote?: string;
  moveInDate?: string;
  criteriaText?: string;
  picked?: { id: string; title: string; price: number }[];
  requestedWhen?: string;
  summaryText?: string;
};

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  const cases = await readLineRentalCases();
  return NextResponse.json({ cases });
}

export async function POST(request: Request) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const requestedWhen = typeof body.requestedWhen === "string" ? body.requestedWhen.trim() : "";
  const picked = Array.isArray(body.picked) ? body.picked : [];
  if (!phone || !requestedWhen || !picked.length) {
    return NextResponse.json({ error: "缺少電話、看屋時間或想看物件" }, { status: 400 });
  }

  const hasAgents = getViewingAgentUserIds().length > 0;
  const status = hasAgents ? "awaiting_agent" : "pending_confirm";
  const summaryText = hasAgents
    ? `已記下想看時間（${requestedWhen}），已送業務確認。`
    : (typeof body.summaryText === "string" && body.summaryText.trim()) ||
      `已記下想看時間（${requestedWhen}），待同事確認。`;

  try {
    const created = await appendLineRentalCase({
      kind: "viewing",
      status,
      lineUserId: typeof body.lineUserId === "string" ? body.lineUserId.trim() || null : null,
      displayName: (typeof body.displayName === "string" && body.displayName.trim()) || "LINE 客人",
      phone,
      occupation: typeof body.occupation === "string" ? body.occupation.trim() : "",
      nationality: typeof body.nationality === "string" ? body.nationality.trim() : "",
      peopleCount: Number.isFinite(body.peopleCount) ? Number(body.peopleCount) : 1,
      petNote: typeof body.petNote === "string" ? body.petNote.trim() : "",
      moveInDate: typeof body.moveInDate === "string" ? body.moveInDate.trim() : "",
      criteriaText: typeof body.criteriaText === "string" ? body.criteriaText.trim() : "",
      picked: picked.map((item) => ({
        id: String(item.id),
        title: String(item.title),
        price: Number(item.price) || 0,
      })),
      requestedWhen,
      summaryText,
    });

    if (created.lineUserId) {
      await pushLineTextMessage(
        created.lineUserId,
        `${created.summaryText}\n\n條件：${created.criteriaText}\n電話：${created.phone}`,
      );
    }

    const notify = await notifyAgentsOfNewViewing(created);

    return NextResponse.json({
      id: created.id,
      case: created,
      agentsNotified: notify.notified,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "寫入失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
