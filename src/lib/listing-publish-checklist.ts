/**
 * 外掛刊登前檢查：資料夠不夠拿到對方平台貼／自動填。
 */

export type PublishChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
};

export type PublishChecklistInput = {
  title?: string;
  city?: string;
  district?: string;
  address?: string;
  price?: number | string | null;
  areaPing?: number | string | null;
  rooms?: number | string | null;
  bathrooms?: number | string | null;
  contactName?: string;
  contactPhone?: string;
  coverImage?: string | null;
  images?: string[];
  source591Url?: string | null;
  sourceFacebookUrl?: string | null;
  sourceLejuUrl?: string | null;
  sourceOtherPortalUrl?: string | null;
  listingType?: "RENT" | "SALE" | string;
};

function hasText(v: unknown) {
  return typeof v === "string" ? v.trim().length > 0 : v != null && String(v).trim().length > 0;
}

function numOk(v: unknown) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0;
}

export function buildPublishChecklist(input: PublishChecklistInput): PublishChecklistItem[] {
  const images = (input.images ?? []).filter((u) => hasText(u));
  const photoCount = images.length + (hasText(input.coverImage) && !images.includes(String(input.coverImage)) ? 1 : 0);

  return [
    {
      id: "address",
      label: "地址完整",
      ok: hasText(input.city) && hasText(input.district) && hasText(input.address) && String(input.address).trim().length >= 3,
      detail: [input.city, input.district, input.address].filter(hasText).join(""),
    },
    {
      id: "price",
      label: input.listingType === "SALE" ? "售價已填" : "租金已填",
      ok: numOk(input.price),
    },
    {
      id: "area",
      label: "坪數已填",
      ok: numOk(input.areaPing),
    },
    {
      id: "layout",
      label: "格局（房／衛）",
      ok: hasText(String(input.rooms ?? "")) && hasText(String(input.bathrooms ?? "")),
      detail:
        hasText(String(input.rooms ?? "")) || hasText(String(input.bathrooms ?? ""))
          ? `${input.rooms ?? "—"}房 ${input.bathrooms ?? "—"}衛`
          : undefined,
    },
    {
      id: "photos",
      label: "至少 3 張照片",
      ok: photoCount >= 3,
      detail: `目前 ${photoCount} 張`,
    },
    {
      id: "contact",
      label: "聯絡人與電話",
      ok: hasText(input.contactName) && String(input.contactPhone ?? "").replace(/\D/g, "").length >= 8,
    },
    {
      id: "backfill591",
      label: "已回填 591 網址（選填）",
      ok: hasText(input.source591Url),
      detail: hasText(input.source591Url) ? "已填" : "刊登後記得貼回",
    },
    {
      id: "backfillFb",
      label: "已回填 FB／社團網址（選填）",
      ok: hasText(input.sourceFacebookUrl),
      detail: hasText(input.sourceFacebookUrl) ? "已填" : "有發再貼回",
    },
    {
      id: "backfillLeju",
      label: "已回填樂屋網址（選填）",
      ok: hasText(input.sourceLejuUrl),
    },
  ];
}

/** 給外掛／手動貼上用的純文字摘要 */
export function formatPublishExportPlainText(input: PublishChecklistInput & { features?: string[]; specialMatters?: string }) {
  const lines = [
    input.title?.trim() || "(無標題)",
    `${input.city ?? ""}${input.district ?? ""}${input.address ?? ""}`,
    `類型：${input.listingType === "SALE" ? "買賣" : "租賃"}`,
    `價格：${input.price ?? ""}`,
    `坪數：${input.areaPing ?? ""}`,
    `格局：${input.rooms ?? "—"}房 ${input.bathrooms ?? "—"}衛`,
    `聯絡：${input.contactName ?? ""} ${input.contactPhone ?? ""}`,
  ];
  const feats = (input.features ?? []).map((f) => f.trim()).filter(Boolean);
  if (feats.length) lines.push(`特色：${feats.join("／")}`);
  if (input.specialMatters?.trim()) lines.push(`特殊事項：${input.specialMatters.trim()}`);
  const imgs = (input.images ?? []).filter(Boolean);
  if (imgs.length) {
    lines.push("照片：");
    for (const u of imgs.slice(0, 20)) lines.push(u);
  }
  if (input.source591Url?.trim()) lines.push(`591：${input.source591Url.trim()}`);
  if (input.sourceFacebookUrl?.trim()) lines.push(`FB：${input.sourceFacebookUrl.trim()}`);
  if (input.sourceLejuUrl?.trim()) lines.push(`樂屋：${input.sourceLejuUrl.trim()}`);
  if (input.sourceOtherPortalUrl?.trim()) lines.push(`其他：${input.sourceOtherPortalUrl.trim()}`);
  return lines.join("\n");
}
