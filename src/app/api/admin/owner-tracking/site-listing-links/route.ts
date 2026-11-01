import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function digitsPhone(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

function compactText(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, "").toLowerCase();
}

/** 本站已上架租賃物件對照：591／電話+地址／電話+社區 → listingId，供屋主追蹤回填 */
export async function GET() {
  const guard = await requireAdminSession();
  if (guard) return guard;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      ok: true,
      by591Id: {} as Record<string, string>,
      byPhoneAddress: {} as Record<string, string>,
      byPhoneCommunity: {} as Record<string, string>,
    });
  }

  try {
    const rows = await prisma.listing.findMany({
      where: {
        listingType: "RENT",
        isPublished: true,
      },
      select: {
        id: true,
        source591Id: true,
        city: true,
        district: true,
        address: true,
        contactPhone: true,
        community: true,
      },
      take: 5000,
    });

    const by591Id: Record<string, string> = {};
    const byPhoneAddress: Record<string, string> = {};
    const byPhoneCommunity: Record<string, string> = {};

    for (const row of rows) {
      const rid = (row.source591Id ?? "").trim();
      if (rid && !by591Id[rid]) by591Id[rid] = row.id;

      const phone = digitsPhone(row.contactPhone);
      if (phone.length >= 8) {
        const addrKey = `${phone}|${compactText(row.city)}${compactText(row.district)}${compactText(row.address)}`;
        if (!byPhoneAddress[addrKey]) byPhoneAddress[addrKey] = row.id;

        const addrOnly = compactText(row.address);
        if (addrOnly.length >= 4) {
          const addrOnlyKey = `${phone}|${addrOnly}`;
          if (!byPhoneAddress[addrOnlyKey]) byPhoneAddress[addrOnlyKey] = row.id;
        }

        const community = compactText(row.community);
        if (community) {
          const communityKey = `${phone}|${community}`;
          if (!byPhoneCommunity[communityKey]) byPhoneCommunity[communityKey] = row.id;
        }
      }
    }

    return NextResponse.json({ ok: true, by591Id, byPhoneAddress, byPhoneCommunity });
  } catch (error) {
    console.error("[owner-tracking/site-listing-links]", error);
    return NextResponse.json(
      {
        ok: false,
        message: "讀取本站上架對照失敗",
        by591Id: {},
        byPhoneAddress: {},
        byPhoneCommunity: {},
      },
      { status: 500 },
    );
  }
}
