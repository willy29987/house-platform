import { LineAgentReschedule } from "@/components/line-agent-reschedule";

export const dynamic = "force-dynamic";

export default async function AgentReschedulePage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string }>;
}) {
  const params = await searchParams;
  const caseId = params.caseId?.trim() ?? "";

  if (!caseId) {
    return (
      <main className="mx-auto max-w-md p-6 text-center text-sm text-zinc-600">
        缺少約看案件編號，請從 LINE「改時間」重新進入。
      </main>
    );
  }

  return (
    <main>
      <LineAgentReschedule caseId={caseId} />
    </main>
  );
}
