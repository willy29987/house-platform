import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminContentQueue } from "@/components/admin-content-queue";
import { GoPublicSiteButton } from "@/components/go-public-site-button";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getContentDraftDelegate, missingContentDraftMessage } from "@/lib/content-draft-delegate";

async function getDrafts() {
  const contentDraft = getContentDraftDelegate();
  if (!contentDraft) return [];
  return contentDraft.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export default async function AdminTeamQueuePage() {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  const delegateReady = Boolean(getContentDraftDelegate());
  const drafts = await getDrafts();
  const serialized = drafts.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    approvedAt: d.approvedAt?.toISOString() ?? null,
    scheduledAt: d.scheduledAt?.toISOString() ?? null,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-600">AI 團隊內容中台</p>
          <h1 className="text-2xl font-bold text-zinc-900">待審核與排程</h1>
          <p className="mt-1 text-xs text-zinc-500">所有對外內容必須先經人工核准，才可送排程發佈。</p>
        </div>
        <div className="flex items-center gap-2">
          <GoPublicSiteButton />
          <Link href="/admin/team" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            回 AI 團隊
          </Link>
          <Link href="/admin" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            回後台
          </Link>
        </div>
      </div>

      {!delegateReady ? (
        <div className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          {missingContentDraftMessage()}
        </div>
      ) : null}

      <AdminContentQueue initialDrafts={serialized} />
    </main>
  );
}

