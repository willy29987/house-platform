import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-auth";
import {
  getGuestProfileByUserId,
  isCompleteGuestProfile,
  upsertGuestProfileByStaff,
} from "@/lib/line-guest-profile";
import {
  getGuestWatchByUserId,
  upsertGuestWatchCriteria,
} from "@/lib/line-guest-watch";
import {
  emptyCriteria,
  type RentalExtra,
  type RentalMatchCriteria,
} from "@/lib/line-rental-assistant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

function asStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
}

function parseCriteria(raw: unknown): RentalMatchCriteria {
  const base = emptyCriteria();
  if (!raw || typeof raw !== "object") return base;
  const incoming = raw as Partial<RentalMatchCriteria>;
  const extras = asStringArray(incoming.extras).filter(
    (item): item is RentalExtra =>
      item === "subsidy" || item === "tax" || item === "household",
  );
  return {
    cities: asStringArray(incoming.cities),
    districts: asStringArray(incoming.districts),
    buildingForm:
      incoming.buildingForm === "apartment" || incoming.buildingForm === "elevator"
        ? incoming.buildingForm
        : "",
    rooms: asStringArray(incoming.rooms),
    bathrooms: asStringArray(incoming.bathrooms),
    parking: asStringArray(incoming.parking),
    priceKeys: asStringArray(incoming.priceKeys),
    extras,
  };
}

function parseNullableNumber(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** 客服讀取單一客人的找房條件＋個資 */
export async function GET(request: Request) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const lineUserId = new URL(request.url).searchParams.get("lineUserId")?.trim() ?? "";
  if (!lineUserId) {
    return NextResponse.json({ error: "缺少 lineUserId" }, { status: 400 });
  }

  const [watch, profile] = await Promise.all([
    getGuestWatchByUserId(lineUserId),
    getGuestProfileByUserId(lineUserId),
  ]);

  return NextResponse.json(
    {
      watch,
      profile,
      profileComplete: profile ? isCompleteGuestProfile(profile) : false,
    },
    { headers: NO_STORE },
  );
}

type Body = {
  lineUserId?: string;
  displayName?: string;
  criteria?: Partial<RentalMatchCriteria>;
  priceMin?: number | null;
  priceMax?: number | null;
  petNote?: string;
  active?: boolean;
  profile?: {
    phone?: string;
    occupation?: string;
    nationality?: string;
    peopleCount?: number;
    petNote?: string;
    moveInDate?: string;
  };
};

/** 客服代填／調整找房條件與個資（未填表客人也可） */
export async function POST(request: Request) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const lineUserId = typeof body.lineUserId === "string" ? body.lineUserId.trim() : "";
  if (!lineUserId) {
    return NextResponse.json({ error: "缺少 lineUserId" }, { status: 400 });
  }

  const displayName =
    typeof body.displayName === "string" && body.displayName.trim()
      ? body.displayName.trim()
      : undefined;

  const criteria = parseCriteria(body.criteria);
  const priceMin = parseNullableNumber(body.priceMin);
  const priceMax = parseNullableNumber(body.priceMax);
  const watchPetNote =
    typeof body.petNote === "string"
      ? body.petNote
      : typeof body.profile?.petNote === "string"
        ? body.profile.petNote
        : "";

  try {
    const watch = await upsertGuestWatchCriteria({
      lineUserId,
      displayName,
      criteria,
      priceMin: priceMin === undefined ? null : priceMin,
      priceMax: priceMax === undefined ? null : priceMax,
      petNote: watchPetNote,
      active: body.active !== false,
    });

    let profile = null;
    if (body.profile && typeof body.profile === "object") {
      profile = await upsertGuestProfileByStaff({
        lineUserId,
        displayName,
        phone: body.profile.phone,
        occupation: body.profile.occupation,
        nationality: body.profile.nationality,
        peopleCount: body.profile.peopleCount,
        petNote: body.profile.petNote ?? watchPetNote,
        moveInDate: body.profile.moveInDate,
      });
      if (body.profile.phone?.trim() && !profile) {
        return NextResponse.json(
          { error: "電話格式不正確（請用 09 開頭手機或市話）" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({
      ok: true,
      watch,
      profile,
      profileComplete: profile ? isCompleteGuestProfile(profile) : false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "儲存失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
