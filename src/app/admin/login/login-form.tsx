"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

type LoginFormProps = {
  nextPath: string;
  initialError?: string;
};

function safeNextPath(raw: string) {
  const path = raw.trim() || "/admin";
  if (!path.startsWith("/") || path.startsWith("//")) return "/admin";
  return path;
}

function isInIframe() {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function LoginFormInner({ nextPath, initialError }: LoginFormProps) {
  const searchParams = useSearchParams();
  const queryError = searchParams.get("error");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const targetPath = safeNextPath(nextPath);
  const error = queryError || initialError || "";

  return (
    <form method="POST" action="/api/admin/login-form" className="mt-6 grid gap-4">
      <input type="hidden" name="next" value={targetPath} />
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-zinc-600">帳號</span>
        <input
          required
          name="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="請輸入帳號"
          autoComplete="username"
          className="rounded-xl border border-zinc-300 px-4 py-3.5 text-base outline-none ring-[#0b2545]/20 focus:border-[#0b2545] focus:ring-2"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-zinc-600">密碼</span>
        <input
          required
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="請輸入密碼"
          autoComplete="current-password"
          className="rounded-xl border border-zinc-300 px-4 py-3.5 text-base outline-none ring-[#0b2545]/20 focus:border-[#0b2545] focus:ring-2"
        />
      </label>
      <button
        type="submit"
        className="mt-1 rounded-xl bg-[#0b2545] px-4 py-3.5 text-base font-semibold text-white shadow-md hover:bg-[#1e3a8a] active:scale-[0.99]"
      >
        登入後台
      </button>
      {isInIframe() ? (
        <p className="text-[11px] leading-relaxed text-zinc-500">
          預覽框內登入請用上方按鈕；若仍失敗請
          <a
            href={`/admin/login?next=${encodeURIComponent(targetPath)}`}
            target="_top"
            rel="noopener noreferrer"
            className="ml-1 text-blue-600 underline"
          >
            全螢幕登入
          </a>
        </p>
      ) : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </form>
  );
}

export function LoginForm({ nextPath, initialError }: LoginFormProps) {
  return (
    <Suspense fallback={<p className="mt-6 text-sm text-zinc-500">載入登入表單…</p>}>
      <LoginFormInner nextPath={nextPath} initialError={initialError} />
    </Suspense>
  );
}
