import { LineLiffRentAssistant } from "@/components/line-liff-rent-assistant";
import { LINE_LIFF_RENT_ASSISTANT_ID, resolveLiffBootstrapHint } from "@/lib/line-liff-id";

export const dynamic = "force-dynamic";

export default async function LiffRentAssistantPage({
  searchParams,
}: {
  searchParams: Promise<{
    liffId?: string;
    uid?: string;
    listingId?: string | string[];
    similar?: string | string[];
    "liff.state"?: string;
  }>;
}) {
  const params = await searchParams;
  const liffId = params.liffId?.trim() || LINE_LIFF_RENT_ASSISTANT_ID;
  const hint = resolveLiffBootstrapHint(params);
  const listingBaseUrl =
    process.env.NEXT_PUBLIC_LISTING_BASE_URL?.replace(/\/$/, "") ||
    "https://house-platform.vercel.app";

  const bootstrapQuery = new URLSearchParams();
  if (params.uid) bootstrapQuery.set("uid", params.uid);
  if (params["liff.state"]) bootstrapQuery.set("liff.state", params["liff.state"]);
  if (params.similar) {
    const similar = Array.isArray(params.similar) ? params.similar[0] : params.similar;
    if (similar) bootstrapQuery.set("similar", similar);
  }
  const listingIds = Array.isArray(params.listingId)
    ? params.listingId
    : params.listingId
      ? [params.listingId]
      : [];
  for (const id of listingIds) {
    for (const part of id.split(",")) {
      const trimmed = part.trim();
      if (trimmed) bootstrapQuery.append("listingId", trimmed);
    }
  }

  return (
    <>
      {/* 與殼同時開始拉資料，縮短白屏後等待 */}
      <link
        rel="preload"
        href={`/api/line/liff-bootstrap?${bootstrapQuery.toString()}`}
        as="fetch"
        crossOrigin="anonymous"
      />
      <LineLiffRentAssistant liffId={liffId} listingBaseUrl={listingBaseUrl} hint={hint} />
    </>
  );
}
