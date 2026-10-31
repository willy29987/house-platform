import { ListingType } from "@prisma/client";
import { extract591ListingId, find591UrlInText } from "@/lib/listing-591-id";
import { appendLineRentalCase, type LineRentalCase } from "@/lib/line-rental-cases";
import { buildLiffRentAssistantUrl, type LineMessage } from "@/lib/line-messaging";
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

function liffUrlWithListing(listingId?: string) {
  const base = buildLiffRentAssistantUrl();
  if (!listingId) return base;
  const join = base.includes("?") ? "&" : "?";
  return `${base}${join}listingId=${encodeURIComponent(listingId)}`;
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
  const liffHome = buildLiffRentAssistantUrl();

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
      messages: [
        {
          type: "template",
          altText: `「${listing.title}」目前可以安排看屋`,
          template: {
            type: "buttons",
            text: `收到連結了。「${listing.title}」目前可以安排看屋，點下方選時間即可。`,
            actions: [
              {
                type: "uri",
                label: "選看屋時間",
                uri: liffUrlWithListing(listing.id),
              },
            ],
          },
        },
      ],
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
            text: `這間「${listing.title}」目前無法安排看屋。需要我幫你找類似條件的房子嗎？`,
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

export async function handleImageInquiry(input: {
  lineUserId: string | null;
  displayName: string;
  imageMessageId?: string;
}): Promise<InquiryAutoReply> {
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
    summaryText: "客人傳圖片詢問物件，需人工辨識；已請對方補 591 連結。",
    source591Id: "",
    source591Url: "",
    guestMessage: input.imageMessageId ? `image:${input.imageMessageId}` : "image",
  });

  return {
    caseRecord: created,
    messages: [
      {
        type: "text",
        text: "收到圖片了。為了立刻幫你查能不能看，麻煩再貼一次 591 的完整連結；同時也已轉給同事，截圖我們會一併確認。",
      },
    ],
  };
}
