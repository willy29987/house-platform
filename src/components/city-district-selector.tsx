"use client";

import { TAIWAN_REGIONS } from "@/lib/taiwan-regions";

type CityDistrictSelectorProps = {
  cityValue: string;
  districtValue: string;
  onCityChange: (city: string) => void;
  onDistrictChange: (district: string) => void;
};

export function CityDistrictSelector({
  cityValue,
  districtValue,
  onCityChange,
  onDistrictChange,
}: CityDistrictSelectorProps) {
  const selectedRegion = TAIWAN_REGIONS.find((r) => r.city === cityValue);

  function handleCityChange(city: string) {
    onCityChange(city);
    onDistrictChange("");
  }

  return (
    <div className="flex gap-2">
      <select
        value={cityValue}
        onChange={(e) => handleCityChange(e.target.value)}
        className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      >
        <option value="">選擇縣市</option>
        {TAIWAN_REGIONS.map((r) => (
          <option key={r.city} value={r.city}>
            {r.city}
          </option>
        ))}
      </select>
      <select
        value={districtValue}
        onChange={(e) => onDistrictChange(e.target.value)}
        disabled={!selectedRegion}
        className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
      >
        <option value="">選擇行政區</option>
        {selectedRegion?.districts.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </div>
  );
}
