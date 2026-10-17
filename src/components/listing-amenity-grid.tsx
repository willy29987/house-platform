import { AmenityIcon } from "@/components/listing-amenity-icon";

type AmenityItem = { name: string; on: boolean };

/** 設備／家具圖示格：有提供為深色，未提供為淡灰（不加刪除線，留白較多）。 */
export function ListingAmenityGrid({ items }: { items: AmenityItem[] }) {
  return (
    <ul className="grid max-w-3xl grid-cols-4 gap-x-4 gap-y-8 sm:grid-cols-5 sm:gap-x-6 sm:gap-y-9 md:grid-cols-6 md:gap-x-8 lg:grid-cols-7">
      {items.map((item) => (
        <li key={item.name} className="flex flex-col items-center gap-2.5 px-0.5 text-center">
          <AmenityIcon
            name={item.name}
            className={`h-9 w-9 sm:h-10 sm:w-10 ${item.on ? "text-zinc-700" : "text-zinc-300"}`}
          />
          <span
            className={`text-xs leading-snug sm:text-[13px] ${
              item.on ? "font-medium text-zinc-800" : "font-normal text-zinc-300"
            }`}
          >
            {item.name}
          </span>
          <span className="sr-only">{item.on ? "有提供" : "未提供"}</span>
        </li>
      ))}
    </ul>
  );
}
