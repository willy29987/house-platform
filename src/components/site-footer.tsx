import Link from "next/link";

export function SiteFooter() {
  const lineUrl = process.env.NEXT_PUBLIC_LINE_OA_ADD_FRIEND_URL;

  return (
    <footer id="contact" className="mt-auto border-t border-zinc-200 bg-zinc-900 text-zinc-300">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-lg font-bold text-white">不動產實踐家</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              專業房地產顧問服務，協助您找到最理想的租賃或買賣物件，從看房到成交全程陪伴。
            </p>
            {lineUrl ? (
              <a
                href={lineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                LINE 加入好友諮詢
              </a>
            ) : null}
          </div>

          <div>
            <p className="text-sm font-semibold text-white">快速連結</p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/?type=RENT" className="text-sm text-zinc-400 hover:text-white">
                  租賃物件
                </Link>
              </li>
              <li>
                <Link href="/?type=SALE" className="text-sm text-zinc-400 hover:text-white">
                  買賣物件
                </Link>
              </li>
              <li>
                <Link href="/" className="text-sm text-zinc-400 hover:text-white">
                  全部房源
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">聯絡我們</p>
            <ul className="mt-3 space-y-2 text-sm text-zinc-400">
              {lineUrl ? (
                <li>
                  <a href={lineUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    LINE 官方帳號
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-zinc-700 pt-6 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} 不動產實踐家．All rights reserved.
        </div>
      </div>
    </footer>
  );
}
