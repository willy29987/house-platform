import Link from "next/link";
import { redirect } from "next/navigation";
import { AiTeamPanel } from "@/components/ai-team-panel";
import { GoPublicSiteButton } from "@/components/go-public-site-button";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { TEAM_MEMBERS } from "@/lib/ai-team-data";
import { getAIConfig } from "@/lib/ai-team-server";

export default async function AdminTeamPage() {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  const aiReady = Boolean(getAIConfig());

  const members = TEAM_MEMBERS.map(({ id, code, name, title, group, emoji, avatarUrl, blurb }) => ({
    id,
    code,
    name,
    title,
    group,
    emoji,
    avatarUrl,
    blurb,
  }));

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-600">內部管理後台</p>
          <h1 className="text-2xl font-bold text-zinc-900">AI 團隊面板</h1>
          <p className="mt-1 text-xs text-zinc-500">
            直接在這裡與你的 {members.length} 位 AI 成員對話，不用再去 ChatGPT 貼提示詞。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GoPublicSiteButton />
          <Link
            href="/admin/team/queue"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            待審核與排程
          </Link>
          <Link
            href="/admin"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            ← 回後台
          </Link>
        </div>
      </div>

      {!aiReady ? (
        <div className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          <p className="font-semibold">尚未設定 AI 供應商</p>
          <p className="mt-2">在 <code className="rounded bg-amber-100 px-1">.env</code>（或 Vercel 專案設定）擇一填寫：</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Claude</strong>：<code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY=sk-ant-...</code>
              、<code className="rounded bg-amber-100 px-1">AI_MODEL=claude-haiku-4-5</code>
              <span className="ml-1 text-xs">（Claude Pro/Max 訂閱不等於 API，API 需去 console.anthropic.com 另外取得並儲值）</span>
            </li>
            <li>
              <strong>OpenAI 相容</strong>：<code className="rounded bg-amber-100 px-1">AI_API_KEY=sk-...</code>
              ，可另設 <code className="rounded bg-amber-100 px-1">AI_BASE_URL</code>、<code className="rounded bg-amber-100 px-1">AI_MODEL</code> 切換成 DeepSeek / Moonshot / Gemini OpenAI 相容模式。
            </li>
            <li>
              <strong>省成本建議</strong>：<code className="rounded bg-amber-100 px-1">AI_TEMPERATURE=0.35</code>、
              <code className="rounded bg-amber-100 px-1">AI_MAX_TOKENS=700</code>、
              <code className="rounded bg-amber-100 px-1">AI_CHAT_CONTEXT_TURNS=10</code>、
              <code className="rounded bg-amber-100 px-1">AI_ULTRA_SAVING_MODE=1</code>
            </li>
          </ul>
        </div>
      ) : null}

      <AiTeamPanel members={members} />
    </main>
  );
}
