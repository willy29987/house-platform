"use client";

import { FormEvent, useState } from "react";

type LoginFormProps = {
  nextPath: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const result = (await response.json()) as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setError(result.message ?? "登入失敗，請稍後再試。");
      setLoading(false);
      return;
    }

    window.location.href = nextPath;
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-3">
      <input
        required
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        placeholder="帳號"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />
      <input
        required
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="密碼"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
      >
        {loading ? "登入中..." : "登入後台"}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </form>
  );
}
