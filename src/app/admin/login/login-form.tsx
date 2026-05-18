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
    <form method="POST" action="/api/admin/login-form" className="mt-6 grid gap-3">
      <input type="hidden" name="next" value={targetPath} />
      <input
        required
        name="username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        placeholder="帳號"
        autoComplete="username"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />
      <input
        required
        type="password"
        name="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="密碼"
        autoComplete="current-password"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
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
