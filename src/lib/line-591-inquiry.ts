import { ListingType } from "@prisma/client";
import { extract591ListingId, find591UrlInText } from "@/lib/listing-591-id";
import { appendLineRentalCase, type LineRentalCase } from "@/lib/line-rental-cases";
import {
  buildLiffRentAssistantUrl,
  truncateLineTemplateText,
  type LineMessage,
} from "@/lib/line-messaging";
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

export async function handle591LinkInquiry(input: {
  text: string;
  lineUserId: string | null;
  displayName: string;
}): Promise<InquiryAutoReply | null> {
  const url = find591UrlInText(input.text);
  const idFromText = extract591ListingId(input.text);
  const source591Id = (url && extract591ListingId(url)) || idFromText;
  if (!source591Id && !url) return null;

  const listing = source591Id ? await findListingBy591Id(source591Id) : null;
  const liffHome = liffUrlForGuest({ lineUserId: input.lineUserId });

  if (listing && listing.isPublished && listing.listingType === ListingType.RENT) {
    const summary = `客人貼 591 詢問「${listing.title}」是否可看（591 #${source591Id}）。`;
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

  const summary = `客人貼了 591 連結，但內網對不到編號 ${source591Id ?? "（無法抽出）"}，需人工確認。`;
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
        type: "text",
        text: "收到你的 591 連結了，我這邊先轉給同事確認這間能不能看，稍後回你。若方便也可以再說一下希望看屋的時段。",
      },
    ],
  };
}

function listingToPicked(listing: RentalMatchListing) {
  return [{ id: listing.id, title: listing.title, price: listing.price }];
}

const IMAGE_MATCH_REPLY_MS = 5500;

async function matchListingFromImageMessage(imageMessageId: string) {
  const {
    fetchLineMessageImageBuffer,
    matchPublishedRentalByImage,
  } = await import("@/lib/line-listing-image-match");
  const buffer = await fetchLineMessageImageBuffer(imageMessageId);
  if (!buffer) return null;
  return matchPublishedRentalByImage(buffer);
}

async function saveWatchFromListing(
  lineUserId: string | null,
  displayName: string,
  listing: RentalMatchListing,
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
  let matched: Awaited<ReturnType<typeof matchListingFromImageMessage>> = null;
  if (input.imageMessageId) {
    try {
      matched = await Promise.race([
        matchListingFromImageMessage(input.imageMessageId),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), IMAGE_MATCH_REPLY_MS);
        }),
      ]);
    } catch (error) {
      console.warn("[line-591-inquiry] image match failed", error);
    }
  }

  if (matched?.listing) {
    const listing = matched.listing;
    const summary = `客人傳的照片對上「${listing.title}」，已開推薦表單（距離 ${matched.distance}）。`;
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
