import { ListingType } from "@prisma/client";
import { extract591ListingId, find591UrlInText } from "@/lib/listing-591-id";
import { appendLineRentalCase, type LineRentalCase } from "@/lib/line-rental-cases";
import {
  buildLiffRentAssistantUrl,
  truncateLineTemplateText,
  type LineMessage,
} from "@/lib/line-messaging";
import {
  describeExternalListing,
  fetch591ListingInfo,
  findOwnListingByFeatures,
  type ExternalListingInfo,
} from "@/lib/line-listing-identify";
import type { RentalMatchListing } from "@/lib/line-rental-assistant";
import { prisma } from "@/lib/prisma";

export type Matched591Listing = {
  id: string;
  title: string;
  price: number;
  city: string;
  district: string;
  isPublished: boolean;
  listingType: ListingType;
};

export async function findListingBy591Id(source591Id: string): Promise<Matched591Listing | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const row = await prisma.listing.findFirst({
      where: { source591Id },
      select: {
        id: true,
        title: true,
        price: true,
        city: true,
        district: true,
        isPublished: true,
        listingType: true,
      },
    });
    return row;
  } catch (error) {
    console.error("[line-591-inquiry] findListingBy591Id", error);
    return null;
  }
}

export type InquiryAutoReply = {
  messages: LineMessage[];
  caseRecord: LineRentalCase | null;
};

function liffUrlForGuest(input: {
  lineUserId?: string | null;
  listingId?: string;
  similar?: boolean;
}) {
  const query: Record<string, string> = {};
  if (input.lineUserId?.startsWith("U")) query.uid = input.lineUserId;
  if (input.listingId) query.listingId = input.listingId;
  if (input.similar) query.similar = "1";
  return buildLiffRentAssistantUrl(Object.keys(query).length ? query : undefined);
}

function matchedListingActions(input: {
  lineUserId?: string | null;
  listingId: string;
  title: string;
  altPrefix?: string;
}): LineMessage[] {
  return [
    {
      type: "template",
      altText: `${input.altPrefix ?? ""}${input.title}`.slice(0, 400) || "找到對應物件",
      template: {
        type: "buttons",
        text: truncateLineTemplateText(
          `「${input.title}」可安排看屋。可選時間，或看同區類似物件。`,
          60,
        ),
        actions: [
          {
            type: "uri",
            label: "選看屋時間",
            uri: liffUrlForGuest({
              lineUserId: input.lineUserId,
              listingId: input.listingId,
            }),
          },
          {
            type: "uri",
            label: "看類似物件",
            uri: liffUrlForGuest({
              lineUserId: input.lineUserId,
              listingId: input.listingId,
              similar: true,
            }),
          },
        ],
      },
    },
  ];
}

type WatchSeed = Pick<
  RentalMatchListing,
  "city" | "district" | "price" | "rooms" | "houseCondition" | "propertyType"
>;

async function loadAllPublishedRentals() {
  const { loadRentalMatchListings } = await import("@/lib/line-rental-assistant");
  return loadRentalMatchListings(null);
}

/** 非官網物件：依它的條件存找房需求，回「看類似物件」按鈕。 */
async function externalListingInquiry(input: {
  kind: "591_link" | "image_inquiry";
  lineUserId: string | null;
  displayName: string;
  info: Partial<ExternalListingInfo>;
  sourceUrl: string;
  guestMessage: string;
}): Promise<InquiryAutoReply> {
  const { info } = input;
  const seed: WatchSeed = {
    city: info.city ?? "",
    district: info.district ?? "",
    price: info.price ?? 0,
    rooms: info.rooms ?? 0,
    houseCondition: info.houseCondition ?? null,
    propertyType: info.propertyType ?? "",
  };
  try {
    await saveWatchFromListing(input.lineUserId, input.displayName, seed);
  } catch (error) {
    console.warn("[line-591-inquiry] save watch from external failed", error);
  }
  const described = describeExternalListing(info);
  const label = info.title ? `「${info.title}」` : "這間";
  const idNote = info.source591Id ? `591 #${info.source591Id}` : "截圖";
  const created = await appendLineRentalCase({
    kind: input.kind,
    status: "awaiting_staff",
    lineUserId: input.lineUserId,
    displayName: input.displayName,
    phone: "",
    occupation: "",
    nationality: "",
    peopleCount: 1,
    petNote: "",
    moveInDate: "",
    criteriaText: described || label,
    picked: [],
    requestedWhen: "",
    summaryText: `客人詢問 ${idNote}${label}（${described || "條件不明"}），不是官網物件，已推類似物件。`,
    source591Id: info.source591Id ?? "",
    source591Url: input.sourceUrl,
    guestMessage: input.guestMessage,
  });

  return {
    caseRecord: created,
    messages: [
      {
        type: "template",
        altText: "幫你找類似的房子",
        template: {
          type: "buttons",
          text: truncateLineTemplateText(
            described
              ? `這間不是我們的物件，已依「${described}」挑類似的房子，點下方看看。`
              : "這間不是我們的物件，點下方看類似的房子。",
            60,
          ),
          actions: [
            {
              type: "uri",
              label: "看類似物件",
              uri: liffUrlForGuest({ lineUserId: input.lineUserId, similar: true }),
            },
          ],
        },
      },
    ],
  };
}

export async function handle591LinkInquiry(input: {
  text: string;
  lineUserId: string | null;
  displayName: string;
}): Promise<InquiryAutoReply | null> {
  const url = find591UrlInText(input.text);
  const idFromText = extract591ListingId(input.text);
  const source591Id = (url && extract591ListingId(url)) || idFromText;
  if (!source591Id && !url) return null;

  let listing = source591Id ? await findListingBy591Id(source591Id) : null;
  let sameHouseNote = "";
  let external: ExternalListingInfo | null = null;
  if (!listing && source591Id) {
    external = await fetch591ListingInfo(source591Id, url);
    if (external) {
      const own = findOwnListingByFeatures(external, await loadAllPublishedRentals());
      if (own) {
        listing = {
          id: own.id,
          title: own.title,
          price: own.price,
          city: own.city,
          district: own.district,
          isPublished: true,
          listingType: ListingType.RENT,
        };
        sameHouseNote = `（591 頁「${external.title}」比對為同一間）`;
      }
    }
  }
  const liffHome = liffUrlForGuest({ lineUserId: input.lineUserId });

  if (listing && listing.isPublished && listing.listingType === ListingType.RENT) {
    const summary = `客人貼 591 詢問「${listing.title}」是否可看（591 #${source591Id}）${sameHouseNote}。`;
    const created = await appendLineRentalCase({
      kind: "591_link",
      status: "pending_confirm",
      lineUserId: input.lineUserId,
      displayName: input.displayName,
      phone: "",
      occupation: "",
      nationality: "",
      peopleCount: 1,
      petNote: "",
      moveInDate: "",
      criteriaText: `${listing.city}${listing.district} · ${listing.title}`,
      picked: [{ id: listing.id, title: listing.title, price: listing.price }],
      requestedWhen: "",
      summaryText: summary,
      source591Id: source591Id ?? "",
      source591Url: url ?? "",
      guestMessage: input.text.slice(0, 500),
    });

    return {
      caseRecord: created,
      messages: matchedListingActions({
        lineUserId: input.lineUserId,
        listingId: listing.id,
        title: listing.title,
        altPrefix: "可安排看屋：",
      }),
    };
  }

  if (listing && (!listing.isPublished || listing.listingType !== ListingType.RENT)) {
    const summary = `客人詢問 591 #${source591Id}「${listing.title}」，但物件目前未上架／非租賃。`;
    const created = await appendLineRentalCase({
      kind: "591_link",
      status: "awaiting_staff",
      lineUserId: input.lineUserId,
      displayName: input.displayName,
      phone: "",
      occupation: "",
      nationality: "",
      peopleCount: 1,
      petNote: "",
      moveInDate: "",
      criteriaText: listing.title,
      picked: [{ id: listing.id, title: listing.title, price: listing.price }],
      requestedWhen: "",
      summaryText: summary,
      source591Id: source591Id ?? "",
      source591Url: url ?? "",
      guestMessage: input.text.slice(0, 500),
    });

    return {
      caseRecord: created,
      messages: [
        {
          type: "template",
          altText: "這間目前無法安排看屋",
          template: {
            type: "buttons",
            text: truncateLineTemplateText(
              `「${listing.title}」目前無法安排看屋。要找類似條件嗎？`,
              60,
            ),
            actions: [{ type: "uri", label: "開始找房", uri: liffHome }],
          },
        },
      ],
    };
  }

  if (external && (external.district || external.city)) {
    return externalListingInquiry({
      kind: "591_link",
      lineUserId: input.lineUserId,
      displayName: input.displayName,
      info: external,
      sourceUrl: url ?? "",
      guestMessage: input.text.slice(0, 500),
    });
  }

  const summary = `客人貼了 591 連結 ${source591Id ? `#${source591Id}` : "（無法抽編號）"}，官網沒有、591 頁也讀不到（可能已下架），需人工確認。`;
  const created = await appendLineRentalCase({
    kind: "591_link",
    status: "awaiting_staff",
    lineUserId: input.lineUserId,
    displayName: input.displayName,
    phone: "",
    occupation: "",
    nationality: "",
    peopleCount: 1,
    petNote: "",
    moveInDate: "",
    criteriaText: source591Id ? `591 #${source591Id}` : "591 連結（無法抽編號）",
    picked: [],
    requestedWhen: "",
    summaryText: summary,
    source591Id: source591Id ?? "",
    source591Url: url ?? "",
    guestMessage: input.text.slice(0, 500),
  });

  return {
    caseRecord: created,
    messages: [
      {
        type: "template",
        altText: "收到你的 591 連結",
        template: {
          type: "buttons",
          text: "收到連結了，同事會再確認這間。也可以先點下方選條件，看看其他房子。",
          actions: [{ type: "uri", label: "開始找房", uri: liffHome }],
        },
      },
    ],
  };
}

function listingToPicked(listing: RentalMatchListing) {
  return [{ id: listing.id, title: listing.title, price: listing.price }];
}

/** 照片比對＋讀截圖＋查 591 都要在 LINE 回覆前完成 */
const IMAGE_MATCH_REPLY_MS = 20_000;

type ImageIdentifyResult =
  | { kind: "own"; listing: RentalMatchListing; how: string }
  | { kind: "external"; info: Partial<ExternalListingInfo> };

async function identifyImageMessage(imageMessageId: string): Promise<ImageIdentifyResult | null> {
  const {
    fetchLineMessageImageBuffer,
    matchPublishedRentalByImage,
  } = await import("@/lib/line-listing-image-match");
  const buffer = await fetchLineMessageImageBuffer(imageMessageId);
  if (!buffer) return null;

  const byPhoto = await matchPublishedRentalByImage(buffer).catch((error) => {
    console.warn("[line-591-inquiry] photo match failed", error);
    return null;
  });
  if (byPhoto) {
    return { kind: "own", listing: byPhoto.listing, how: `照片比對（距離 ${byPhoto.distance}）` };
  }

  const { readListingFromImage } = await import("@/lib/line-listing-vision");
  let info = await readListingFromImage(buffer);
  if (!info) return null;

  if (info.source591Id) {
    const byId = await findListingBy591Id(info.source591Id);
    if (byId?.isPublished && byId.listingType === ListingType.RENT) {
      const { loadPublishedRentalMatchListing } = await import("@/lib/line-rental-assistant");
      const loaded = await loadPublishedRentalMatchListing(byId.id);
      if (loaded) return { kind: "own", listing: loaded, how: `截圖 591 #${info.source591Id}` };
    }
    if (!info.district || !info.price) {
      const fetched = await fetch591ListingInfo(info.source591Id, null, 5000);
      if (fetched) info = { ...info, ...fetched };
    }
  }

  const own = findOwnListingByFeatures(info, await loadAllPublishedRentals());
  if (own) return { kind: "own", listing: own, how: `截圖文字「${info.title ?? ""}」` };
  if (info.district || info.city) return { kind: "external", info };
  return null;
}

async function saveWatchFromListing(
  lineUserId: string | null,
  displayName: string,
  listing: WatchSeed,
) {
  if (!lineUserId?.startsWith("U")) return;
  const { widenCriteriaFromListing } = await import("@/lib/line-rental-assistant");
  const { upsertGuestWatchCriteria } = await import("@/lib/line-guest-watch");
  const widened = widenCriteriaFromListing(listing);
  await upsertGuestWatchCriteria({
    lineUserId,
    displayName,
    criteria: widened.criteria,
    priceMin: widened.priceMin,
    priceMax: widened.priceMax,
    active: true,
  });
}

/** 圖片／截圖：對中就給一顆 LIFF 按鈕看該間＋類似物件，並寫入找房條件。 */
export async function handleImageInquiry(input: {
  lineUserId: string | null;
  displayName: string;
  imageMessageId?: string;
}): Promise<InquiryAutoReply> {
  let matched: ImageIdentifyResult | null = null;
  if (input.imageMessageId) {
    try {
      matched = await Promise.race([
        identifyImageMessage(input.imageMessageId),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), IMAGE_MATCH_REPLY_MS);
        }),
      ]);
    } catch (error) {
      console.warn("[line-591-inquiry] image match failed", error);
    }
  }
  const guestMessage = input.imageMessageId ? `image:${input.imageMessageId}` : "image";

  if (matched?.kind === "external") {
    return externalListingInquiry({
      kind: "image_inquiry",
      lineUserId: input.lineUserId,
      displayName: input.displayName,
      info: matched.info,
      sourceUrl: "",
      guestMessage,
    });
  }

  if (matched?.kind === "own") {
    const listing = matched.listing;
    const summary = `客人傳的圖片對上「${listing.title}」，已開推薦表單（${matched.how}）。`;
    try {
      await saveWatchFromListing(input.lineUserId, input.displayName, listing);
    } catch (error) {
      console.warn("[line-591-inquiry] save watch from image failed", error);
    }
    const created = await appendLineRentalCase({
      kind: "image_inquiry",
      status: "pending_confirm",
      lineUserId: input.lineUserId,
      displayName: input.displayName,
      phone: "",
      occupation: "",
      nationality: "",
      peopleCount: 1,
      petNote: "",
      moveInDate: "",
      criteriaText: `${listing.city}${listing.district} · ${listing.title}`,
      picked: listingToPicked(listing),
      requestedWhen: "",
      summaryText: summary,
      source591Id: "",
      source591Url: "",
      guestMessage: input.imageMessageId ? `image:${input.imageMessageId}` : "image",
    });

    return {
      caseRecord: created,
      messages: [
        {
          type: "template",
          altText: `找到「${listing.title}」與類似物件`,
          template: {
            type: "buttons",
            text: truncateLineTemplateText(
              `對到「${listing.title}」。點下方看這間與類似物件，選完再填資料約時間。`,
              60,
            ),
            actions: [
              {
                type: "uri",
                label: "看推薦物件",
                uri: liffUrlForGuest({
                  lineUserId: input.lineUserId,
                  listingId: listing.id,
                  similar: true,
                }),
              },
            ],
          },
        },
      ],
    };
  }

  const created = await appendLineRentalCase({
    kind: "image_inquiry",
    status: "awaiting_staff",
    lineUserId: input.lineUserId,
    displayName: input.displayName,
    phone: "",
    occupation: "",
    nationality: "",
    peopleCount: 1,
    petNote: "",
    moveInDate: "",
    criteriaText: "客人傳了物件截圖／照片",
    picked: [],
    requestedWhen: "",
    summaryText: "客人傳了圖片，系統未自動對上物件。",
    source591Id: "",
    source591Url: "",
    guestMessage: input.imageMessageId ? `image:${input.imageMessageId}` : "image",
  });

  return {
    caseRecord: created,
    messages: [
      {
        type: "template",
        altText: "開始找房",
        template: {
          type: "buttons",
          text: "還沒對到官網物件。點下方開始找房，選條件與想看的房子。",
          actions: [
            {
              type: "uri",
              label: "開始找房",
              uri: liffUrlForGuest({ lineUserId: input.lineUserId }),
            },
          ],
        },
      },
    ],
  };
}
