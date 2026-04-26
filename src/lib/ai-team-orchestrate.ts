import type { TeamMember } from "@/lib/ai-team-data";

/** 協作深度：參與討論的角色數量與部門範圍 */
export type OrchestrateDepth = "quick" | "standard" | "full";

const FULL: TeamMember["id"][] = [
  "marketing-strategist",
  "scriptwriter",
  "director-video",
  "social-editor",
  "paid-media",
  "seo",
  "dm-closer",
  "crm",
  "legal",
  "analyst",
];

const STANDARD: TeamMember["id"][] = [
  "marketing-strategist",
  "scriptwriter",
  "social-editor",
  "paid-media",
  "seo",
  "dm-closer",
];

// 快速模式仍強制帶法務，避免快速提案直接踩法規
const QUICK: TeamMember["id"][] = [
  "marketing-strategist",
  "scriptwriter",
  "paid-media",
  "legal",
];

export const ORCHESTRATE_DEPTH_LABEL: Record<OrchestrateDepth, { label: string; hint: string; count: number }> = {
  quick: { label: "快速", hint: "4 角色 · 最省成本，先定方向 + 法務把關", count: 4 },
  standard: { label: "標準", hint: "6 角色 · 平衡成本與覆蓋", count: 6 },
  full: { label: "完整", hint: "10 角色 · 大案/月檢/風險全覆蓋", count: 10 },
};

export function getWorkerIdsForDepth(depth: OrchestrateDepth): TeamMember["id"][] {
  switch (depth) {
    case "quick":
      return [...QUICK];
    case "standard":
      return [...STANDARD];
    case "full":
    default:
      return [...FULL];
  }
}

/** 週一（本機週一 0:00–23:59）可作為手動升級深度參考 */
export function isMondayLocal(d = new Date()): boolean {
  return d.getDay() === 1;
}
