/** 租屋篩選用：台北捷運／輕軌路線（與後台 mrtLine 字串比對） */
export const TAIPEI_MRT_FILTER_LINES = [
  { id: "wenhu", shortLabel: "文湖", match: "文湖", badgeClass: "bg-amber-700" },
  { id: "tamsui", shortLabel: "淡水信義", match: "淡水信義", badgeClass: "bg-red-600" },
  { id: "songshan", shortLabel: "松山新店", match: "松山新店", badgeClass: "bg-green-600" },
  { id: "zhonghe", shortLabel: "中和新蘆", match: "中和新蘆", badgeClass: "bg-orange-600" },
  { id: "bannan", shortLabel: "板南", match: "板南", badgeClass: "bg-blue-600" },
  { id: "circle", shortLabel: "環狀", match: "環狀", badgeClass: "bg-yellow-400" },
  { id: "danhai", shortLabel: "淡海", match: "淡海", badgeClass: "bg-cyan-600" },
  { id: "ankeng", shortLabel: "安坑", match: "安坑", badgeClass: "bg-lime-600" },
] as const;

export function listingMatchesMrtLines(mrtLine: string | null | undefined, selectedIds: string[]) {
  if (selectedIds.length === 0) return true;
  if (!mrtLine?.trim()) return false;
  return TAIPEI_MRT_FILTER_LINES.some(
    (line) => selectedIds.includes(line.id) && mrtLine.includes(line.match),
  );
}

export function shortMrtLine(line: string | null) {
  if (!line) return null;
  const parts = line.split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : line;
}

export function getMrtBadgeClass(line: string | null) {
  if (!line) return "bg-orange-500";
  if (line.includes("文湖")) return "bg-amber-700";
  if (line.includes("淡水信義")) return "bg-red-600";
  if (line.includes("松山新店")) return "bg-green-600";
  if (line.includes("中和新蘆")) return "bg-orange-600";
  if (line.includes("板南")) return "bg-blue-600";
  if (line.includes("環狀")) return "bg-yellow-400";
  if (line.includes("淡海")) return "bg-cyan-600";
  if (line.includes("安坑")) return "bg-lime-600";
  if (line.includes("桃園") || line.includes("機場")) return "bg-purple-600";
  if (line.includes("台中")) return "bg-emerald-600";
  if (line.includes("高雄") && line.includes("紅")) return "bg-red-600";
  if (line.includes("高雄") && line.includes("橘")) return "bg-orange-600";
  return "bg-orange-500";
}
