/**
 * 僅成員定義，可供 Client Component 安全匯入（不含 node:fs）。
 */
export type TeamGroup = "leader" | "growth" | "content" | "conversion" | "risk" | "analytics";

export type TeamMember = {
  id: string;
  code: string;
  /** 顯示名稱（可自行改成你想叫的同事名字） */
  name: string;
  title: string;
  group: TeamGroup;
  /** 頭像圖（可選）：例如 /avatars/director.png */
  avatarUrl?: string;
  /** 沒有頭像圖時的備援顯示 */
  emoji: string;
  blurb: string;
  file: string;
};

export const TEAM_GROUPS: Record<TeamGroup, { label: string; color: string }> = {
  leader: { label: "領導層", color: "bg-[#0b2545] text-white" },
  growth: { label: "增長組", color: "bg-blue-100 text-blue-800" },
  content: { label: "內容組", color: "bg-emerald-100 text-emerald-800" },
  conversion: { label: "轉換組", color: "bg-amber-100 text-amber-800" },
  risk: { label: "風控組", color: "bg-rose-100 text-rose-800" },
  analytics: { label: "分析組", color: "bg-violet-100 text-violet-800" },
};

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: "director",
    code: "00",
    name: "AI 營運總監",
    title: "Chief AI Officer",
    group: "leader",
    emoji: "👑",
    blurb: "最高職位，拆解目標、分派任務、驗收成果",
    file: "00-AI營運總監.md",
  },
  {
    id: "marketing-strategist",
    code: "01",
    name: "網路行銷策略師",
    title: "Digital Marketing Strategist",
    group: "growth",
    emoji: "🎯",
    blurb: "漏斗設計、受眾策略、活動企劃",
    file: "01-網路行銷策略師.md",
  },
  {
    id: "paid-media",
    code: "02",
    name: "流量投手",
    title: "Paid Media Specialist",
    group: "growth",
    emoji: "📈",
    blurb: "Meta / Google / TikTok 廣告投放與優化",
    file: "02-流量投手.md",
  },
  {
    id: "seo",
    code: "03",
    name: "SEO 在地搜尋專員",
    title: "Local SEO Specialist",
    group: "growth",
    emoji: "🔍",
    blurb: "關鍵字、Google 商家、區域搜尋",
    file: "03-SEO在地搜尋專員.md",
  },
  {
    id: "scriptwriter",
    code: "04",
    name: "短影音腳本企劃",
    title: "Short-form Scriptwriter",
    group: "content",
    emoji: "✍️",
    blurb: "Reels / Shorts 分鏡、鉤子、CTA",
    file: "04-短影音腳本企劃.md",
  },
  {
    id: "director-video",
    code: "05",
    name: "短影音導演",
    title: "Short-form Director",
    group: "content",
    emoji: "🎬",
    blurb: "拍攝清單、B-roll、剪輯指揮",
    file: "05-短影音導演.md",
  },
  {
    id: "social-editor",
    code: "06",
    name: "發文小幫手",
    title: "Social Media Editor",
    group: "content",
    emoji: "📱",
    blurb: "IG / FB / Threads / 小紅書多平台改寫",
    file: "06-發文小幫手.md",
  },
  {
    id: "property-expert",
    code: "07",
    name: "房產內容專家",
    title: "Real Estate Content Expert",
    group: "content",
    emoji: "🏠",
    blurb: "物件賣點、生活機能、產品力",
    file: "07-房產內容專家.md",
  },
  {
    id: "dm-closer",
    code: "08",
    name: "私訊成交助手",
    title: "DM Closer",
    group: "conversion",
    emoji: "💬",
    blurb: "DM / LINE 回覆、名單分級、預約看屋",
    file: "08-私訊成交助手.md",
  },
  {
    id: "crm",
    code: "09",
    name: "CRM 客戶培育",
    title: "CRM / Lead Nurturing",
    group: "conversion",
    emoji: "🌱",
    blurb: "長期追蹤、再行銷、沉睡名單喚醒",
    file: "09-CRM客戶培育.md",
  },
  {
    id: "legal",
    code: "10",
    name: "法律顧問",
    title: "Real Estate Legal Advisor",
    group: "risk",
    emoji: "⚖️",
    blurb: "廣告合規、契約風險、用詞審核",
    file: "10-法律顧問.md",
  },
  {
    id: "pr",
    code: "11",
    name: "品牌公關",
    title: "Brand PR & Reputation",
    group: "risk",
    emoji: "🛡️",
    blurb: "負評處理、口碑管理、危機應對",
    file: "11-品牌公關.md",
  },
  {
    id: "analyst",
    code: "12",
    name: "數據分析師",
    title: "Marketing Data Analyst",
    group: "analytics",
    emoji: "📊",
    blurb: "週報、題材存活率、漏斗診斷",
    file: "12-數據分析師.md",
  },
  {
    id: "maintenance-bot",
    code: "13",
    name: "維修機器人",
    title: "Property Maintenance Coordinator",
    group: "risk",
    emoji: "🛠️",
    blurb: "報修分級、派工建議、住戶溝通與時程追蹤",
    file: "13-維修機器人.md",
  },
];

export function getTeamMember(id: string): TeamMember | undefined {
  return TEAM_MEMBERS.find((m) => m.id === id);
}

export function getTeamMembersByGroup(): Record<TeamGroup, TeamMember[]> {
  const acc = {
    leader: [],
    growth: [],
    content: [],
    conversion: [],
    risk: [],
    analytics: [],
  } as Record<TeamGroup, TeamMember[]>;
  for (const m of TEAM_MEMBERS) acc[m.group].push(m);
  return acc;
}
