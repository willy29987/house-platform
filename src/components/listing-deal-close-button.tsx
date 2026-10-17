"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CommissionRecordForm } from "@/components/commission-record-form";
import {
  appendCommissionRecord,
  commissionDraftFromListing,
  hasCommissionForListing,
  loadCommissionRecordsLocal,
  persistCommissionRecordsLocal,
  type CommissionListingDraftSource,
  type CommissionRecord,
} from "@/lib/commission-stats";
import { hydrateCommissionRecordsOnce } from "@/lib/admin-cloud-sync-client";

type Props = CommissionListingDraftSource & {
  isPublished: boolean;
  buttonClassName?: string;
};

export function ListingDealCloseButton({
  isPublished,
  buttonClassName,
  ...listing
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CommissionRecord | null>(null);
  const [expectedReleaseDate, setExpectedReleaseDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void hydrateCommissionRecordsOnce(loadCommissionRecordsLocal, persistCommissionRecordsLocal);
  }, []);

  if (!isPublished) return null;

  const defaultBtn =
    "whitespace-nowrap rounded-lg border border-[#0b2545] bg-white px-3 py-1.5 text-sm font-semibold text-[#0b2545] hover:bg-[#0b2545]/5 disabled:opacity-60";

  const isRent = listing.listingType === "RENT";

  function resetModal() {
    setOpen(false);
    setDraft(null);
    setExpectedReleaseDate("");
    setError("");
  }

  function openModal() {
    setError("");
    setExpectedReleaseDate("");
    setDraft(commissionDraftFromListing(listing));
    setOpen(true);
  }

  async function confirmDeal(record: CommissionRecord) {
    if (isRent && !expectedReleaseDate.trim()) {
      window.alert("請填寫預計釋出日期");
      return;
    }

    if (hasCommissionForListing(listing.id)) {
      const ok = window.confirm("此物件已有服務費紀錄，仍要再新增一筆並成交下架？");
      if (!ok) return;
    }

    setBusy(true);
    setError("");

    appendCommissionRecord(record);

    const body: {
      isPublished: boolean;
      unpublishCategory?: "DEAL";
      expectedReleaseDate?: string;
    } = {
      isPublished: false,
    };
    if (isRent) {
      body.unpublishCategory = "DEAL";
      body.expectedReleaseDate = expectedReleaseDate.trim();
    }

    try {
      const response = await fetch(`/api/admin/listings/${listing.id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !result.ok) {
        setError(
          result.message ??
            "服務費已寫入本機，但下架失敗。請至「服務費統計」確認紀錄，並手動下架或重試。",
        );
        setBusy(false);
        return;
      }

      resetModal();
      setBusy(false);
      router.refresh();
    } catch {
      setError("服務費已寫入本機，但下架請求失敗。請至「服務費統計」確認，並手動下架。");
      setBusy(false);
    }
  }

  const releaseDateSection = isRent ? (
    <div className="rounded-xl bg-amber-50/80 p-3 ring-1 ring-amber-100">
      <label className="mb-1 block text-xs font-medium text-zinc-700">
        預計釋出日期（必填）
        <span className="mt-0.5 block font-normal text-zinc-500">將於 2 個月前提醒再聯繫屋主</span>
      </label>
      <input
        type="date"
        required
        value={expectedReleaseDate}
        onChange={(e) => setExpectedReleaseDate(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
      />
    </div>
  ) : null;

  return (
    <>
      <button type="button" onClick={openModal} disabled={busy} className={buttonClassName ?? defaultBtn}>
        {busy ? "處理中…" : "成交"}
      </button>
      {open && draft ? (
        <CommissionRecordForm
          initial={draft}
          title="成交並記錄服務費"
          saveLabel={busy ? "處理中…" : "確認成交"}
          extraSection={releaseDateSection}
          onCancel={() => {
            if (busy) return;
            resetModal();
          }}
          onSave={(r) => {
            if (busy) return;
            void confirmDeal(r);
          }}
        />
      ) : null}
      {error ? (
        <span className="pointer-events-auto relative z-20 max-w-[14rem] text-xs text-rose-700">{error}</span>
      ) : null}
    </>
  );
}
