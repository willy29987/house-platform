import { TAIWAN_REGIONS } from "@/lib/taiwan-regions";

/** 從整段地址試著拆出縣市、行政區與剩餘路址。 */
export function parseTaiwanAddress(full: string): { city: string; district: string; address: string } {
  const raw = full.trim();
  if (!raw) return { city: "", district: "", address: "" };

  const regions = [...TAIWAN_REGIONS].sort((a, b) => b.city.length - a.city.length);
  for (const region of regions) {
    const cityIdx = raw.indexOf(region.city);
    if (cityIdx === -1) continue;
    const afterCity = raw.slice(cityIdx + region.city.length);
    const districts = [...region.districts].sort((a, b) => b.length - a.length);
    for (const d of districts) {
      if (afterCity.startsWith(d)) {
        const rest = afterCity.slice(d.length).trim();
        return { city: region.city, district: d, address: rest || raw };
      }
    }
    const rest = afterCity.trim();
    return { city: region.city, district: "", address: rest || raw };
  }

  return { city: "", district: "", address: raw };
}

export type OwnerCaseAddressParts = {
  city: string;
  district: string;
  address: string;
  floor: string;
  totalFloors: string;
};

/** 列表／詳情顯示用完整地址。 */
export function formatOwnerCaseAddress(parts: OwnerCaseAddressParts): string {
  const loc = `${parts.city.trim()}${parts.district.trim()}${parts.address.trim()}`;
  const f = parts.floor.trim();
  const t = parts.totalFloors.trim();
  if (!f && !t) return loc;
  if (f && t) return `${loc} ${f}/${t}F`.trim();
  if (f) return `${loc} ${f}F`.trim();
  return `${loc} 共${t}F`.trim();
}
