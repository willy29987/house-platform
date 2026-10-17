"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminListingForm, type AdminListingFormData } from "@/components/admin-listing-form";
import { createEmptyFormData } from "@/lib/listing-form-defaults";
import { ownerCaseToListingDraft } from "@/lib/owner-case-to-listing-draft";
import { loadOwnerTrackingStore } from "@/lib/owner-tracking-preview";

type Props = {
  listingType: "RENT" | "SALE";
  fromOwnerCaseId?: string;
};

export function AdminNewListingClient({ listingType, fromOwnerCaseId }: Props) {
  const [initialData, setInitialData] = useState<AdminListingFormData | null>(null);
  const [ownerCaseFound, setOwnerCaseFound] = useState<boolean | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);

  useEffect(() => {
    let data = createEmptyFormData(listingType);
    let found: boolean | null = null;
    let label: string | null = null;

    if (fromOwnerCaseId?.trim()) {
      const store = loadOwnerTrackingStore();
      const ownerCase = store.cases.find((c) => c.id === fromOwnerCaseId.trim());
      if (ownerCase) {
        data = ownerCaseToListingDraft(ownerCase, listingType);
        found = true;
        label = ownerCase.address.trim() || ownerCase.ownerName.trim() || fromOwnerCaseId;
      } else {
        found = false;
      }
    }

    setInitialData(data);
    setOwnerCaseFound(found);
    setSourceLabel(label);
  }, [fromOwnerCaseId, listingType]);

  if (!initialData) {
    return <p className="text-sm text-zinc-500">載入表單…</p>;
  }

  return (
    <>
      {fromOwnerCaseId ? (
        <div
          className={`mb-4 rounded-lg border px-3 py-2.5 text-sm ${
            ownerCaseFound
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
          role="status"
        >
          {ownerCaseFound ? (
            <>
              <p className="font-semibold">已從屋主追蹤案件帶入</p>
              <p className="mt-0.5 text-emerald-800/90">
                {sourceLabel ? `「${sourceLabel}」` : "此案件"}的欄位已預填；請確認縣市／行政區、照片與必填項後再上架。
              </p>
              <Link
                href={`/admin/owner-tracking/${fromOwnerCaseId}`}
                className="mt-1 inline-block text-xs font-medium text-[#1e3a8a] hover:underline"
              >
                ← 回屋主案件
              </Link>
            </>
          ) : (
            <p>找不到屋主案件（可能已清除或不在此瀏覽器），請手動填寫或回列表重選。</p>
          )}
        </div>
      ) : null}

      <AdminListingForm
        mode="create"
        submitUrl="/api/admin/listings"
        initialData={initialData}
        lockedListingType={listingType}
      />
    </>
  );
}
