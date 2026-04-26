"use client";

import { FormEvent, useState } from "react";

type InquiryFormProps = {
  listingId: string;
};

export function InquiryForm({ listingId }: InquiryFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactTime, setContactTime] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    const response = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, name, phone, contactTime, message }),
    });

    const result = (await response.json()) as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setStatus(result.message ?? "送出失敗，請稍後再試。");
      setLoading(false);
      return;
    }

    setStatus("已收到你的聯絡需求，我們會盡快與你聯繫。");
    setName("");
    setPhone("");
    setContactTime("");
    setMessage("");
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
      <input
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="姓名"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />
      <input
        required
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="電話"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />
      <input
        value={contactTime}
        onChange={(event) => setContactTime(event.target.value)}
        placeholder="方便聯絡時段（選填）"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="留言（選填）"
        className="min-h-24 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "送出中..." : "送出聯絡需求"}
      </button>
      {status ? <p className="text-sm text-zinc-700">{status}</p> : null}
    </form>
  );
}
