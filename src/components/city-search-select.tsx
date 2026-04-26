"use client";

import { useState } from "react";
import { TAIWAN_REGIONS } from "@/lib/taiwan-regions";

export function CitySearchSelect({ defaultCity }: { defaultCity?: string }) {
  const [city, setCity] = useState(defaultCity ?? "");

  return (
    <select
      name="city"
      value={city}
      onChange={(e) => setCity(e.target.value)}
      className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm"
    >
      <option value="">所有縣市</option>
      {TAIWAN_REGIONS.map((r) => (
        <option key={r.city} value={r.city}>
          {r.city}
        </option>
      ))}
    </select>
  );
}
