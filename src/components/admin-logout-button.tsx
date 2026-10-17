"use client";

export function AdminLogoutButton() {
  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 md:w-auto md:rounded-lg md:px-3 md:py-2"
    >
      登出
    </button>
  );
}
