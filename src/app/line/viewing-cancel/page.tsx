import { LineViewingCancel } from "@/components/line-viewing-cancel";

export const dynamic = "force-dynamic";

export default async function ViewingCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string; demo?: string }>;
}) {
  const params = await searchParams;
  const caseId =
    params.demo === "1" ? "demo" : params.caseId?.trim() || (params.demo ? "demo" : "");

  if (!caseId) {
    return (
      <main className="mx-auto max-w-md p-6 text-center text-sm text-zinc-600">
        缺少約看案件編號，請從 LINE「取消這次預約」重新進入。
      </main>
    );
  }

  return (
    <main>
      <LineViewingCancel caseId={caseId} />
    </main>
  );
}
