"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { AdminListingRecord } from "@/lib/listings";
import { ToggleListingButton } from "@/components/toggle-listing-button";
import { DownloadExcelButton } from "@/components/download-excel-button";

type Props = {
  records: AdminListingRecord[];
};

const propertyTypeLabel: Record<string, string> = {
  APARTMENT: "大樓",
  HOUSE: "透天",
  STUDIO: "套房",
  OFFICE: "辦公",
  SHOP: "店面",
};

const parkingTypeLabel: Record<string, string> = {
  FLAT_RAMP: "坡道平面",
  MECHANICAL_LIFT: "機械升降",
  MECHANICAL_FLAT: "機械平面",
  RAMP_MECHANICAL: "坡道機械",
  FRONT_DOOR: "門口可停車",
  OTHER: "其他",
};

function formatRentPrice(price: number) {
  return `NT$ ${price.toLocaleString("zh-TW")} / 月`;
}

function formatSalePrice(price: number) {
  if (price >= 100_000_000) {
    const y = price / 100_000_000;
    return `${y.toFixed(y % 1 === 0 ? 0 : 2)} 億`;
  }
  return `${(price / 10_000).toLocaleString("zh-TW", { maximumFractionDigits: 2 })} 萬`;
}

function triLabel(v: boolean | null) {
  if (v === true) return "是";
  if (v === false) return "否";
  return "—";
}

function layoutText(r: AdminListingRecord) {
  const parts = [
    `${r.rooms}房`,
    r.livingRooms != null ? `${r.livingRooms}廳` : null,
    `${r.bathrooms}衛`,
    r.balconies != null ? `${r.balconies}陽台` : null,
  ].filter(Boolean);
  return parts.join("");
}

function fullAddress(r: AdminListingRecord) {
  const loc = `${r.city}${r.district}${r.address}`;
  return r.community ? `${r.community}・${loc}` : loc;
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d));
}

export function AdminListingRecords({ records }: Props) {
  const [tab, setTab] = useState<"RENT" | "SALE">("RENT");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PUBLISHED" | "UNPUBLISHED">("ALL");
  const [keyword, setKeyword] = useState("");
  const [preview, setPreview] = useState<AdminListingRecord | null>(null);

  const rentCount = records.filter((r) => r.listingType === "RENT").length;
  const saleCount = records.filter((r) => r.listingType === "SALE").length;

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return records.filter((r) => {
      if (r.listingType !== tab) return false;
      if (statusFilter === "PUBLISHED" && !r.isPublished) return false;
      if (statusFilter === "UNPUBLISHED" && r.isPublished) return false;
      if (k) {
        const hay =
          `${r.title}${r.city}${r.district}${r.address}${r.community ?? ""}${r.contactName}${r.contactPhone}`.toLowerCase();
        if (!hay.includes(k)) return false;
      }
      return true;
    });
  }, [records, tab, statusFilter, keyword]);

  return (
    <div>
      {/* 租賃 / 買賣 分頁 */}
      <div className="mb-4 flex items-center gap-2 border-b border-zinc-200">
        {(
          [
            { key: "RENT", label: "租賃", count: rentCount, color: "text-blue-700 border-blue-600" },
            { key: "SALE", label: "買賣", count: saleCount, color: "text-emerald-700 border-emerald-600" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-5 py-2.5 text-sm font-semibold transition ${
              tab === t.key ? t.color : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {t.label}
            <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* 控制列 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-zinc-100 p-1 text-sm">
          {(["ALL", "PUBLISHED", "UNPUBLISHED"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1 font-medium transition ${
                statusFilter === s
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-800"
              }`}
            >
              {s === "ALL" ? "全部狀態" : s === "PUBLISHED" ? "上架中" : "已下架"}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="搜尋 社區 / 地址 / 屋主..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="min-w-[240px] flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
        />

        <span className="text-sm text-zinc-500">共 {filtered.length} 筆</span>

        <div className="ml-auto">
          <DownloadExcelButton />
        </div>
      </div>

      {/* 主表格 */}
      <div className="overflow-x-auto rounded-xl ring-1 ring-zinc-200">
        <table className="w-full min-w-[1500px] text-left text-xs">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <Th>物件類型</Th>
              <Th>標題</Th>
              <Th>社區 / 地址</Th>
              <Th>{tab === "RENT" ? "月租" : "總價（萬）"}</Th>
              <Th>坪數</Th>
              <Th>格局</Th>
              <Th>樓層</Th>
              <Th>屋齡</Th>
              <Th>管理費</Th>
              <Th>車位</Th>
              <Th>裝潢 / 朝向</Th>
              <Th>電梯</Th>
              <Th>屋主</Th>
              <Th>身分證</Th>
              <Th>圖片 / 影片</Th>
              <Th>狀態</Th>
              <Th>建立</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50/50">
                <Td>{propertyTypeLabel[r.propertyType] ?? r.propertyType}</Td>
                <Td className="max-w-[220px]">
                  <Link
                    href={`/listings/${r.id}`}
                    className="font-semibold text-zinc-900 hover:text-[#2563eb] hover:underline"
                    target="_blank"
                  >
                    {r.title}
                  </Link>
                </Td>
                <Td className="max-w-[300px]">
                  {r.community ? (
                    <div className="font-medium text-zinc-900">{r.community}</div>
                  ) : null}
                  <div className="text-zinc-600">
                    {r.city}
                    {r.district}
                    {r.address}
                  </div>
                </Td>
                <Td className="whitespace-nowrap font-semibold text-zinc-900">
                  {tab === "RENT" ? formatRentPrice(r.price) : formatSalePrice(r.price)}
                </Td>
                <Td className="whitespace-nowrap">
                  {r.areaPing} 坪
                  {r.areaMain ? (
                    <div className="text-[10px] text-zinc-500">主 {r.areaMain}</div>
                  ) : null}
                </Td>
                <Td className="whitespace-nowrap">{layoutText(r)}</Td>
                <Td className="whitespace-nowrap">
                  {r.floor && r.totalFloors ? `${r.floor}/${r.totalFloors}F` : "—"}
                </Td>
                <Td>{r.buildingAge != null ? `${r.buildingAge} 年` : "—"}</Td>
                <Td>{r.managementFee ? `NT$ ${r.managementFee.toLocaleString()}` : "免"}</Td>
                <Td className="whitespace-nowrap">
                  {r.parkingType ? parkingTypeLabel[r.parkingType] ?? r.parkingType : "無"}
                  {tab === "RENT" && r.parkingRent ? (
                    <div className="text-[10px] text-zinc-500">+{r.parkingRent}/月</div>
                  ) : null}
                  {tab === "SALE" && r.parkingIncluded !== null ? (
                    <div className="text-[10px] text-zinc-500">
                      {r.parkingIncluded ? "含總價" : "另計"}
                    </div>
                  ) : null}
                </Td>
                <Td className="whitespace-nowrap">
                  {r.decorLevel ?? "—"}
                  {r.orientation ? (
                    <div className="text-[10px] text-zinc-500">{r.orientation}</div>
                  ) : null}
                </Td>
                <Td>{triLabel(r.hasElevator)}</Td>
                <Td className="whitespace-nowrap">
                  <div>{r.contactName}</div>
                  <a
                    href={`tel:${r.contactPhone}`}
                    className="text-[10px] text-[#2563eb] hover:underline"
                  >
                    {r.contactPhone}
                  </a>
                </Td>
                <Td>
                  {r.ownerIdCardUrl ? (
                    <a
                      href={r.ownerIdCardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2563eb] hover:underline"
                    >
                      查看
                    </a>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </Td>
                <Td>
                  {r.images.length > 0 || r.videoUrl ? (
                    <button
                      type="button"
                      onClick={() => setPreview(r)}
                      className="group relative inline-block overflow-hidden rounded-md ring-1 ring-zinc-200 transition hover:ring-[#2563eb]"
                    >
                      {r.coverImage ? (
                        <Image
                          src={r.coverImage}
                          alt={r.title}
                          width={64}
                          height={48}
                          className="h-12 w-16 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-16 items-center justify-center bg-zinc-100 text-[10px] text-zinc-500">
                          {r.videoUrl ? "▶ 影片" : "無圖"}
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/60 to-transparent p-0.5 text-[9px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                        {r.images.length}圖{r.videoUrl ? "・影片" : ""}
                      </div>
                    </button>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </Td>
                <Td>
                  <ToggleListingButton
                    listingId={r.id}
                    isPublished={r.isPublished}
                  />
                </Td>
                <Td className="whitespace-nowrap text-zinc-500">{formatDate(r.createdAt)}</Td>
                <Td>
                  <Link
                    href={`/admin/listings/${r.id}/edit`}
                    className="text-[#2563eb] hover:underline"
                  >
                    編輯
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            此分類目前沒有符合條件的物件
          </div>
        ) : null}
      </div>

      {/* 圖片 / 影片 預覽 Modal */}
      {preview ? <MediaPreview listing={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}

function MediaPreview({
  listing,
  onClose,
}: {
  listing: AdminListingRecord;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">{listing.title}</h3>
            <p className="text-xs text-zinc-500">
              {listing.images.length} 張圖片
              {listing.videoUrl ? "・含影片" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            關閉
          </button>
        </div>

        {listing.videoUrl ? (
          <div className="mb-4">
            <p className="mb-2 text-sm font-semibold text-zinc-800">影片</p>
            {/^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)/.test(listing.videoUrl) ? (
              <iframe
                src={toYouTubeEmbed(listing.videoUrl)}
                className="aspect-video w-full rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                src={listing.videoUrl}
                controls
                className="aspect-video w-full rounded-lg bg-black"
              />
            )}
          </div>
        ) : null}

        {listing.images.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-semibold text-zinc-800">圖片</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {listing.images.map((src, i) => (
                <a
                  key={src}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block aspect-[4/3] overflow-hidden rounded-lg ring-1 ring-zinc-200"
                >
                  <Image
                    src={src}
                    alt={`${listing.title}-${i + 1}`}
                    fill
                    className="object-cover transition group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {listing.images.length === 0 && !listing.videoUrl ? (
          <p className="text-center text-sm text-zinc-500">此物件尚未上傳圖片或影片</p>
        ) : null}
      </div>
    </div>
  );
}

function toYouTubeEmbed(url: string) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  return url;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 font-medium">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 align-top text-zinc-800 ${className}`}>{children}</td>;
}
