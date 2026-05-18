import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceBySlug, services } from "@/lib/services";

type ServicePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) return {};
  return {
    title: `${service.title} | 不動產實踐家`,
    description: service.summary,
  };
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) notFound();

  return (
    <main>
      <section className="relative overflow-hidden bg-[#0b2545]">
        <div className="absolute inset-0">
          <Image
            src={service.image}
            alt={service.title}
            fill
            priority
            className="object-cover opacity-35"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b2545] via-[#0b2545]/85 to-[#0b2545]/45" />
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-6 py-20 text-white sm:py-24">
          <Link href="/#services" className="text-sm font-semibold text-white/75 hover:text-white">
            ← 回服務項目
          </Link>
          <p className="mt-10 text-xs font-semibold uppercase tracking-[0.4em] text-[#d4af37]">
            Services
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">
            {service.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
            {service.summary}
          </p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-14 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-zinc-200 sm:p-9">
          <h2 className="text-2xl font-bold text-zinc-950">服務說明</h2>
          <p className="mt-4 text-base leading-8 text-zinc-700">{service.intro}</p>

          <div className="mt-8">
            <h3 className="text-lg font-bold text-zinc-950">我們會協助你</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {service.highlights.map((item) => (
                <div key={item} className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-100">
                  <p className="text-sm font-semibold text-zinc-800">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl bg-[#0b2545] p-7 text-white shadow-sm">
            <h2 className="text-xl font-bold">服務流程</h2>
            <ol className="mt-5 space-y-4">
              {service.process.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="pt-1 text-sm leading-relaxed text-white/85">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-zinc-200">
            <h2 className="text-xl font-bold text-zinc-950">適合對象</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {service.suitableFor.map((item) => (
                <span key={item} className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <Link
            href="/#services"
            className="block rounded-2xl border border-[#0b2545] px-5 py-4 text-center text-sm font-bold text-[#0b2545] transition hover:bg-[#0b2545] hover:text-white"
          >
            查看其他服務項目
          </Link>
        </aside>
      </section>
    </main>
  );
}
