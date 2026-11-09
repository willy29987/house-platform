/** 圖片比對不到時，請 AI 讀截圖上的 591 編號／標題／租金／地區。只在有 ANTHROPIC_API_KEY 時啟用。 */

import type { ExternalListingInfo } from "@/lib/line-listing-identify";

const DEFAULT_VISION_MODEL = "claude-haiku-4-5";
const VISION_TIMEOUT_MS = 9000;
/** 縮圖後送出，控制 token 成本 */
const MAX_EDGE_PX = 1100;

const PROMPT = [
  "這是客人傳來的租屋物件截圖或照片（多半是 591、樂屋網、FB 等）。",
  "只回一行 JSON，不要其他字：",
  '{"isListing":true,"source591Id":"","title":"","price":0,"city":"","district":"","address":"","rooms":0,"kind":"","areaPing":0}',
  "kind 只能是 整層住家／獨立套房／分租套房／雅房／其他 或空字串。",
  "city 用「新北市」「台北市」這種全名；district 例如「板橋區」。讀不到的欄位留空字串或 0。",
  "若圖片不是房屋物件，isListing 填 false。",
].join("\n");

export function listingVisionEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim()) && process.env.LINE_IMAGE_VISION !== "off";
}

async function shrinkForVision(buffer: Buffer): Promise<string | null> {
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(buffer)
      .rotate()
      .resize(MAX_EDGE_PX, MAX_EDGE_PX, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return out.toString("base64");
  } catch {
    return null;
  }
}

function kindToCondition(kind: string) {
  if (kind.includes("獨立套房")) return "STUDIO";
  if (kind.includes("分租套房") || kind.includes("雅房")) return "SUITE";
  if (kind.includes("整層")) return "WHOLE";
  return "";
}

function normalizeCity(city: string) {
  return city.trim().replace(/^臺/, "台");
}

export async function readListingFromImage(
  buffer: Buffer,
): Promise<Partial<ExternalListingInfo> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey || !listingVisionEnabled()) return null;
  const data = await shrinkForVision(buffer);
  if (!data) return null;

  try {
    const response = await fetch(
      `${(process.env.AI_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.LINE_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL,
          max_tokens: 300,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: "image/jpeg", data } },
                { type: "text", text: PROMPT },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      console.warn("[line-listing-vision] api", response.status, (await response.text()).slice(0, 200));
      return null;
    }
    const json = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = json.content?.find((part) => part.type === "text")?.text ?? "";
    const raw = text.match(/\{[\s\S]*\}/)?.[0];
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.isListing === false) return null;
    const str = (key: string) => (typeof parsed[key] === "string" ? (parsed[key] as string).trim() : "");
    const num = (key: string) => {
      const value = Number(String(parsed[key] ?? "").replace(/[^\d.]/g, ""));
      return Number.isFinite(value) ? value : 0;
    };
    const source591Id = str("source591Id").replace(/\D/g, "");
    return {
      source591Id: /^\d{6,}$/.test(source591Id) ? source591Id : "",
      title: str("title"),
      price: num("price"),
      city: normalizeCity(str("city")),
      district: str("district"),
      address: str("address"),
      rooms: Math.round(num("rooms")),
      houseCondition: kindToCondition(str("kind")),
      propertyType: "",
      areaPing: num("areaPing") || null,
    };
  } catch (error) {
    console.warn("[line-listing-vision] failed", error);
    return null;
  }
}
