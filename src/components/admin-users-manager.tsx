"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type AdminUser = {
  id: string;
  username: string;
  role: "SUPER_ADMIN" | "OPERATOR";
  createdAt: string;
};

type AdminUsersManagerProps = {
  initialUsers: AdminUser[];
  hasDatabase: boolean;
};

const roleLabel: Record<AdminUser["role"], string> = {
  SUPER_ADMIN: "最高管理員",
  OPERATOR: "物件操作員",
};

const roleBadgeColor: Record<AdminUser["role"], string> = {
  SUPER_ADMIN: "bg-[#0b2545] text-white",
  OPERATOR: "bg-zinc-100 text-zinc-700",
};

export function AdminUsersManager({ initialUsers, hasDatabase }: AdminUsersManagerProps) {
  const [users, setUsers] = useState(initialUsers);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AdminUser["role"]>("OPERATOR");
  const [createStatus, setCreateStatus] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [changingPasswordId, setChangingPasswordId] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [pwStatus, setPwStatus] = useState("");
  const router = useRouter();

  if (!hasDatabase) {
    return (
      <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        尚未連接資料庫，無法管理多帳號。
      </div>
    );
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setCreateLoading(true);
    setCreateStatus("");

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
    });
    const data = (await res.json()) as { ok: boolean; message?: string; user?: AdminUser };

    if (!res.ok || !data.ok) {
      setCreateStatus(data.message ?? "新增失敗");
      setCreateLoading(false);
      return;
    }

    if (data.user) setUsers((prev) => [...prev, data.user!]);
    setNewUsername("");
    setNewPassword("");
    setNewRole("OPERATOR");
    setCreateStatus("新增成功！");
    setCreateLoading(false);
    router.refresh();
  }

  async function onDelete(id: string, username: string) {
    if (!confirm(`確定要刪除帳號「${username}」嗎？`)) return;

    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const data = (await res.json()) as { ok: boolean; message?: string };

    if (!res.ok || !data.ok) {
      alert(data.message ?? "刪除失敗");
      return;
    }

    setUsers((prev) => prev.filter((u) => u.id !== id));
    router.refresh();
  }

  async function onChangePassword(id: string) {
    if (!newPw) return;
    setPwStatus("");

    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPw }),
    });
    const data = (await res.json()) as { ok: boolean; message?: string };

    if (!res.ok || !data.ok) {
      setPwStatus(data.message ?? "更新失敗");
      return;
    }

    setPwStatus("密碼已更新！");
    setNewPw("");
    setTimeout(() => {
      setChangingPasswordId(null);
      setPwStatus("");
    }, 1000);
  }

  async function onChangeRole(id: string, role: AdminUser["role"]) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = (await res.json()) as { ok: boolean; message?: string };

    if (!res.ok || !data.ok) {
      alert(data.message ?? "更新失敗");
      return;
    }

    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* 角色說明 */}
      <div className="rounded-xl bg-blue-50/60 p-4 text-sm text-blue-900">
        <p className="font-medium">權限說明</p>
        <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
          <li><strong>最高管理員 (SUPER_ADMIN)</strong>：可操作物件 + 管理人員帳號</li>
          <li><strong>物件操作員 (OPERATOR)</strong>：僅可操作物件（新增/修改/上下架）</li>
        </ul>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-zinc-900">目前帳號</h3>
        {users.length === 0 ? (
          <p className="text-sm text-zinc-500">尚無帳號，請在下方新增。</p>
        ) : (
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {users.map((user) => (
              <div key={user.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{user.username}</p>
                      <p className="text-xs text-zinc-500">
                        建立於 {new Intl.DateTimeFormat("zh-TW").format(new Date(user.createdAt))}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeColor[user.role]}`}>
                      {roleLabel[user.role]}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={user.role}
                      onChange={(e) => onChangeRole(user.id, e.target.value as AdminUser["role"])}
                      className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-700"
                    >
                      <option value="OPERATOR">物件操作員</option>
                      <option value="SUPER_ADMIN">最高管理員</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setChangingPasswordId(changingPasswordId === user.id ? null : user.id);
                        setNewPw("");
                        setPwStatus("");
                      }}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      改密碼
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(user.id, user.username)}
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      刪除
                    </button>
                  </div>
                </div>
                {changingPasswordId === user.id ? (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="password"
                      placeholder="輸入新密碼（至少 6 字）"
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => onChangePassword(user.id)}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
                    >
                      確認
                    </button>
                    {pwStatus ? <span className="text-xs text-zinc-600">{pwStatus}</span> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-zinc-900">新增帳號</h3>
        <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="帳號（至少 2 字）"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="password"
            placeholder="密碼（至少 6 字）"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as AdminUser["role"])}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
          >
            <option value="OPERATOR">物件操作員（只能管理物件）</option>
            <option value="SUPER_ADMIN">最高管理員（可管理人員）</option>
          </select>
          <button
            type="submit"
            disabled={createLoading}
            className="rounded-lg bg-[#0b2545] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e3a8a] disabled:opacity-60 sm:col-span-2"
          >
            {createLoading ? "新增中..." : "新增帳號"}
          </button>
          {createStatus ? (
            <p className="text-sm text-zinc-700 sm:col-span-2">{createStatus}</p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
