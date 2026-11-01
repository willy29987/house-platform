import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/** 本站已上架（有 source591Id）的租賃物件：591 編號 → listingId，供屋主追蹤回填 */
export async function GET() {
  const guard = await requireAdminSession();
  if (guard) return guard;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true, by591Id: {} as Record<string, string> });
  }

  try {
    const rows = await prisma.listing.findMany({
      where: {
        listingType: "RENT",
        isPublished: true,
        source591Id: { not: null },
      },
      select: { id: true, source591Id: true },
      take: 5000,
    });

    const by591Id: Record<string, string> = {};
    for (const row of rows) {
      const rid = (row.source591Id ?? "").trim();
      if (!rid || by591Id[rid]) continue;
      by591Id[rid] = row.id;
    }

    return NextResponse.json({ ok: true, by591Id });
  } catch (error) {
    console.error("[owner-tracking/site-listing-links]", error);
    return NextResponse.json(
      { ok: false, message: "讀取本站上架對照失敗", by591Id: {} },
      { status: 500 },
    );
  }
}
