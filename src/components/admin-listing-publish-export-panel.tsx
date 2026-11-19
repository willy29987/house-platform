"use client";

import { useMemo, useState } from "react";
import {
  buildPublishChecklist,
  formatPublishExportPlainText,
} from "@/lib/listing-publish-checklist";

type Props = {
  listingType: "RENT" | "SALE";
  title: string;
  city: string;
  district: string;
  address: string;
  price: string;
  areaPing: string;
  rooms: string;
  bathrooms: string;
  contactName: string;
  contactPhone: string;
  coverImage: string;
  images: string[];
  features: string[];
  specialMatters: string;
  source591Url: string;
  sourceFacebookUrl: string;
  sourceLejuUrl: string;
  sourceOtherPortalUrl: string;
  onChangePortal: (patch: {
    sourceFacebookUrl?: string;
    sourceLejuUrl?: string;
    sourceOtherPortalUrl?: string;
  }) => void;
};

export function AdminListingPublishExportPanel(props: Props) {
  const [copied, setCopied] = useState(false);
  const checklist = useMemo(
    () =>
      buildPublishChecklist({
        listingType: props.listingType,
        title: props.title,
        city: props.city,
        district: props.district,
        address: props.address,
        price: props.price,
        areaPing: props.areaPing,
        rooms: props.rooms,
        bathrooms: props.bathrooms,
        contactName: props.contactName,
        contactPhone: props.contactPhone,
        coverImage: props.coverImage,
        images: props.images,
        source591Url: props.source591Url,
        sourceFacebookUrl: props.sourceFacebookUrl,
        sourceLejuUrl: props.sourceLejuUrl,
        sourceOtherPortalUrl: props.sourceOtherPortalUrl,
      }),
    [props],
  );
  const requiredOk = checklist.filter((c) => !c.id.startsWith("backfill")).every((c) => c.ok);
  const plain = useMemo(
    () =>
      formatPublishExportPlainText({
        listingType: props.listingType,
        title: props.title,
        city: props.city,
        district: props.district,
        address: props.address,
        price: props.price,
        areaPing: props.areaPing,
        rooms: props.rooms,
        bathrooms: props.bathrooms,
        contactName: props.contactName,
        contactPhone: props.contactPhone,
        images: props.images.length ? props.images : props.coverImage ? [props.coverImage] : [],
        features: props.features,
        specialMatters: props.specialMatters,
        source591Url: props.source591Url,
        sourceFacebookUrl: props.sourceFacebookUrl,
        sourceLejuUrl: props.sourceLejuUrl,
        sourceOtherPortalUrl: props.sourceOtherPortalUrl,
      }),
    [props],
  );

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.alert("複製失敗，請改手動選取");
    }
  }

  const field =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0b2545] focus:ring-2 focus:ring-[#0b2545]/15";

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">外掛刊登檢查</h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            本站為主；外掛（如房仲好幫手）只補自動上架。刊登後把網址貼回下方。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copyAll()}
          className="rounded-lg bg-[#0b2545] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {copied ? "已複製" : "複製摘要給外掛"}
        </button>
      </div>

      <ul className="mb-4 grid gap-1.5 sm:grid-cols-2">
        {checklist.map((item) => (
          <li
            key={item.id}
            className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
              item.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
            }`}
          >
            <span className="font-semibold">{item.ok ? "✓" : "！"}</span>
            <span className="min-w-0">
              <span className="font-medium">{item.label}</span>
              {item.detail ? <span className="ml-1 text-[10px] opacity-80">{item.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      {!requiredOk ? (
        <p className="mb-3 text-[11px] text-amber-700">必填項未齊，外掛刊登容易缺欄，建議先補完再複製。</p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs text-zinc-600 sm:col-span-2">
          FB／社團網址（回填）
          <input
            className={`mt-1 ${field}`}
            value={props.sourceFacebookUrl}
            onChange={(e) => props.onChangePortal({ sourceFacebookUrl: e.target.value })}
            placeholder="https://…"
          />
        </label>
        <label className="block text-xs text-zinc-600">
          樂屋網址（回填）
          <input
            className={`mt-1 ${field}`}
            value={props.sourceLejuUrl}
            onChange={(e) => props.onChangePortal({ sourceLejuUrl: e.target.value })}
            placeholder="https://…"
          />
        </label>
        <label className="block text-xs text-zinc-600">
          其他平台網址（回填）
          <input
            className={`mt-1 ${field}`}
            value={props.sourceOtherPortalUrl}
            onChange={(e) => props.onChangePortal({ sourceOtherPortalUrl: e.target.value })}
            placeholder="https://…"
          />
        </label>
      </div>
      <p className="mt-2 text-[10px] text-zinc-400">591 網址請用上方「591 物件網址」欄；儲存表單後才會寫入。</p>
    </section>
  );
}
