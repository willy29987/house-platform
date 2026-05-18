import { ListingType } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import { getListings } from "@/lib/listings";
import { services } from "@/lib/services";
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
      <section className="relative h-[460px] w-full overflow-hidden bg-[#0b2545] sm:h-[560px]">
        <Image
          src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1920&q=80"
          alt="高樓豪宅室內景觀"
          fill
          className="object-cover object-[center_38%] sm:object-center"
          priority
          sizes="100vw"
        />
        {/* 深海軍藍漸層遮罩 */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b2545]/80 via-[#0b2545]/55 to-[#0b2545]/85" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b2545]/70 to-transparent" />

        <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col justify-center px-6 py-6 text-white sm:px-10 sm:py-8">
          <div className="flex w-full flex-col items-center gap-8 text-center lg:flex-row lg:items-end lg:justify-between lg:gap-10 lg:text-left">
            <div className="max-w-xl lg:mx-0">
              <div className="flex items-center justify-center gap-3 lg:justify-start">
                <span className="h-px w-12 bg-[#d4af37]" />
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#d4af37]">
                  Realty Practitioner
                </p>
              </div>
              <h1 className="mt-5 text-4xl font-extrabold leading-tight drop-shadow-lg sm:text-6xl">
                不動產實踐家
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-zinc-100/90 sm:text-base">
                專業顧問協助帶看、行情分析與交易流程，
                <br className="hidden sm:block" />
                從找房到成交，每一步都有人陪你走完。
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-3 sm:flex-row sm:gap-3.5 sm:justify-center lg:justify-end">
              <Link
                href="/rent"
                className="inline-flex min-w-[9.5rem] items-center justify-center rounded-lg bg-white px-5 py-3 text-center text-sm font-semibold text-[#0b2545] shadow-xl transition hover:bg-zinc-100 sm:min-w-[10.5rem] sm:px-6 sm:text-base"
              >
                探索租賃物件
              </Link>
              <Link
                href="/sale"
                className="inline-flex min-w-[9.5rem] items-center justify-center rounded-lg border-2 border-white/80 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 sm:min-w-[10.5rem] sm:px-6 sm:text-base"
              >
                探索買賣物件
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 物件輪播 */}
      <section className="mx-auto w-full max-w-6xl px-6 py-8 sm:py-10">
        <div id="rent-section" className="scroll-mt-20">
          <ListingCarousel title="精選租賃物件" badge="RENT" listings={rentListings} />
        </div>
        <div id="sale-section" className="scroll-mt-20">
          <ListingCarousel title="精選買賣物件" badge="SALE" listings={saleListings} />
        </div>
      </section>

      {/* 數字統計（單列、較精緻） */}
      <section className="border-y border-zinc-100 bg-white py-8 sm:py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-row items-center justify-center gap-8 px-6 sm:gap-12 md:gap-16">
          <div className="text-center">
            <p className="text-3xl font-extrabold tabular-nums text-[#0b2545] sm:text-4xl">500+</p>
            <p className="mt-1 text-[11px] font-medium tracking-wide text-zinc-500 sm:text-xs">服務客戶</p>
          </div>
          <span className="h-10 w-px shrink-0 bg-zinc-200" aria-hidden />
          <div className="text-center">
            <p className="text-3xl font-extrabold tabular-nums text-[#0b2545] sm:text-4xl">300+</p>
            <p className="mt-1 text-[11px] font-medium tracking-wide text-zinc-500 sm:text-xs">成功媒合</p>
          </div>
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
              { title: "專人即時回覆", desc: "透過 LINE 快速安排帶看與諮詢。" },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
                <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 服務項目 */}
      <section id="services" className="scroll-mt-24 border-t border-zinc-100 bg-white py-16">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#c9a24b]">
                Services
              </p>
              <h2 className="mt-2 text-3xl font-extrabold text-zinc-950">服務項目</h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-zinc-600">
              從住宅、店面到商辦，並延伸到投資規劃、包租代管與裝修整合，讓不動產需求能在同一個團隊內被完整處理。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <Link
                key={service.title}
                href={`/services/${service.slug}`}
                className="group overflow-hidden rounded-2xl bg-zinc-950 shadow-sm ring-1 ring-zinc-200"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image
                    src={service.image}
                    alt={service.title}
                    fill
                    className="object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-95"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b2545]/90 via-[#0b2545]/25 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-xl font-extrabold text-white">{service.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/80">{service.summary}</p>
                  </div>
                </div>
              </Link>
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
