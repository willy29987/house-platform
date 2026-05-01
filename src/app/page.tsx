import { ListingType } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import { getListings } from "@/lib/listings";
import { ListingCarousel } from "@/components/listing-carousel";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [rentListings, saleListings] = await Promise.all([
    getListings({ listingType: ListingType.RENT }),
    getListings({ listingType: ListingType.SALE }),
  ]);
  const lineUrl = process.env.NEXT_PUBLIC_LINE_OA_URL;

  return (
    <main>
      {/* Hero */}
      <section className="relative h-[520px] w-full overflow-hidden bg-[#0b2545] sm:h-[620px]">
        <Image
          src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1920&q=80"
          alt="高樓豪宅室內景觀"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        {/* 深海軍藍漸層遮罩 */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b2545]/80 via-[#0b2545]/55 to-[#0b2545]/85" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b2545]/70 to-transparent" />

        <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col items-start justify-center px-6 text-white sm:px-10">
          <div className="flex items-center gap-3">
            <span className="h-px w-12 bg-[#d4af37]" />
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#d4af37]">
              Realty Practitioner
            </p>
          </div>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight drop-shadow-lg sm:text-6xl">
            不動產實踐家
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-100/90 sm:text-base">
            專業顧問協助帶看、行情分析與交易流程，
            <br className="hidden sm:block" />
            從找房到成交，每一步都有人陪你走完。
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/rent"
              className="rounded-lg bg-white px-8 py-3.5 text-sm font-semibold text-[#0b2545] shadow-xl transition hover:bg-zinc-100 sm:text-base"
            >
              探索租賃物件
            </Link>
            <Link
              href="/sale"
              className="rounded-lg border-2 border-white/80 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 sm:text-base"
            >
              探索買賣物件
            </Link>
          </div>
        </div>
      </section>

      {/* 物件輪播 */}
      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <div id="rent-section" className="scroll-mt-20">
          <ListingCarousel title="精選租賃物件" badge="RENT" listings={rentListings} />
        </div>
        <div id="sale-section" className="scroll-mt-20">
          <ListingCarousel title="精選買賣物件" badge="SALE" listings={saleListings} />
        </div>
      </section>

      {/* 數字統計 */}
      <section className="border-y border-zinc-100 bg-white py-14">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-16 px-6 text-center sm:gap-24">
          {[
            { num: "500+", label: "服務客戶" },
            { num: "300+", label: "成功媒合" },
          ].map((item) => (
            <div key={item.label} className="relative">
              <p className="text-5xl font-extrabold text-[#0b2545] sm:text-6xl">{item.num}</p>
              <p className="mt-3 text-sm font-medium uppercase tracking-widest text-zinc-500">{item.label}</p>
              <span className="absolute -bottom-2 left-1/2 h-0.5 w-10 -translate-x-1/2 bg-[#d4af37]" />
            </div>
          ))}
        </div>
      </section>

      {/* 為什麼選擇我們 */}
      <section className="border-t border-zinc-100 bg-zinc-50 py-14">
        <div className="mx-auto w-full max-w-6xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold text-zinc-900">為什麼選擇我們</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { title: "在地市場熟悉", desc: "熟悉各行政區行情，幫你快速篩掉不適合物件。" },
              { title: "流程透明", desc: "從看房、議價到成交，每一步都清楚說明與提醒。" },
              { title: "專人即時回覆", desc: "可透過 LINE 或表單聯絡，快速安排帶看與諮詢。" },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
                <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LINE 浮動按鈕 */}
      {lineUrl ? (
        <a
          href={lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#06C755] shadow-lg hover:opacity-90"
          aria-label="LINE 諮詢"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white">
            <path d="M12 2C6.48 2 2 6.03 2 11c0 3.07 1.67 5.79 4.23 7.51L5.5 22l3.93-2.1A10.7 10.7 0 0 0 12 20c5.52 0 10-4.03 10-9S17.52 2 12 2zm5.5 11.5h-3v1h3v1.5h-4.5V10H17v1.5h-3v1h3v1zm-5.5 2.5h-1.5V10H12v6zm-3-6H7.5v6H9V14h1.5v-1.5H9v-1h1.5V10z" />
          </svg>
        </a>
      ) : null}
    </main>
  );
}
