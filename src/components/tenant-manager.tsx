"use client";

import { useEffect, useMemo, useState } from "react";

/** 房客資料（自有出租用）。先存瀏覽器本機，確認流程後再接資料庫。 */
type Tenant = {
  id: string;
  name: string;
  phone: string;
  room: string;
  address: string;
  monthlyRent: number;
  dueDay: number;
  deposit: number;
  leaseStart: string;
  leaseEnd: string;
  waterUnitPrice: number;
  electricUnitPrice: number;
  note: string;
  createdAt: string;
};

type RentRecord = {
  paid: boolean;
  paidAt?: string;
};

type UtilityRecord = {
  waterPrev: number;
  waterCurr: number;
  electricPrev: number;
  electricCurr: number;
  gasAmount: number;
};

type Store = {
  tenants: Tenant[];
  /** key: `${tenantId}:${month}` */
  rent: Record<string, RentRecord>;
  utility: Record<string, UtilityRecord>;
};

const STORAGE_KEY = "house-platform:tenant-manager:v1";

const emptyStore: Store = { tenants: [], rent: {}, utility: {} };

function loadStore(): Store {
  if (typeof window === "undefined") return emptyStore;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore;
    const parsed = JSON.parse(raw) as Store;
    return {
      tenants: parsed.tenants ?? [],
      rent: parsed.rent ?? {},
      utility: parsed.utility ?? {},
    };
  } catch {
    return emptyStore;
  }
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y} 年 ${m} 月`;
}

function ntd(n: number): string {
  return `NT$ ${Math.round(n).toLocaleString("zh-TW")}`;
}

function newId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const emptyTenant = (): Tenant => ({
  id: newId(),
  name: "",
  phone: "",
  room: "",
  address: "",
  monthlyRent: 0,
  dueDay: 5,
  deposit: 0,
  leaseStart: "",
  leaseEnd: "",
  waterUnitPrice: 0,
  electricUnitPrice: 5,
  note: "",
  createdAt: new Date().toISOString(),
});

export function TenantManager() {
  const [store, setStore] = useState<Store>(emptyStore);
  const [hydrated, setHydrated] = useState(false);
  const [month, setMonth] = useState<string>(currentMonth());
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [reminderTenant, setReminderTenant] = useState<Tenant | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setStore(loadStore());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store, hydrated]);

  const tenants = store.tenants;

  const utilityFor = (tenantId: string): UtilityRecord =>
    store.utility[`${tenantId}:${month}`] ?? {
      waterPrev: 0,
      waterCurr: 0,
      electricPrev: 0,
      electricCurr: 0,
      gasAmount: 0,
    };

  const rentPaid = (tenantId: string): boolean => Boolean(store.rent[`${tenantId}:${month}`]?.paid);

  const computeUtility = (t: Tenant, u: UtilityRecord) => {
    const water = Math.max(0, u.waterCurr - u.waterPrev) * t.waterUnitPrice;
    const electric = Math.max(0, u.electricCurr - u.electricPrev) * t.electricUnitPrice;
    const gas = u.gasAmount || 0;
    return { water, electric, gas, total: water + electric + gas };
  };

  const isOverdue = (t: Tenant): boolean => {
    if (rentPaid(t.id)) return false;
    if (month !== currentMonth()) return month < currentMonth();
    return new Date().getDate() > t.dueDay;
  };

  const summary = useMemo(() => {
    let due = 0;
    let received = 0;
    let overdueCount = 0;
    for (const t of tenants) {
      due += t.monthlyRent;
      if (rentPaid(t.id)) received += t.monthlyRent;
      if (isOverdue(t)) overdueCount += 1;
    }
    return { due, received, unpaid: due - received, overdueCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenants, store.rent, month]);

  function saveTenant(t: Tenant) {
    setStore((s) => {
      const exists = s.tenants.some((x) => x.id === t.id);
      return {
        ...s,
        tenants: exists ? s.tenants.map((x) => (x.id === t.id ? t : x)) : [...s.tenants, t],
      };
    });
    setEditing(null);
  }

  function removeTenant(id: string) {
    if (!window.confirm("確定刪除此房客？相關租金與費用紀錄也會一併移除。")) return;
    setStore((s) => {
      const rent = { ...s.rent };
      const utility = { ...s.utility };
      for (const key of Object.keys(rent)) if (key.startsWith(`${id}:`)) delete rent[key];
      for (const key of Object.keys(utility)) if (key.startsWith(`${id}:`)) delete utility[key];
      return { tenants: s.tenants.filter((x) => x.id !== id), rent, utility };
    });
  }

  function toggleRent(tenantId: string) {
    setStore((s) => {
      const key = `${tenantId}:${month}`;
      const paid = !s.rent[key]?.paid;
      return {
        ...s,
        rent: { ...s.rent, [key]: { paid, paidAt: paid ? new Date().toISOString() : undefined } },
      };
    });
  }

  function updateUtility(tenantId: string, patch: Partial<UtilityRecord>) {
    setStore((s) => {
      const key = `${tenantId}:${month}`;
      const prev = s.utility[key] ?? {
        waterPrev: 0,
        waterCurr: 0,
        electricPrev: 0,
        electricCurr: 0,
        gasAmount: 0,
      };
      return { ...s, utility: { ...s.utility, [key]: { ...prev, ...patch } } };
    });
  }

  function reminderText(t: Tenant): string {
    const u = utilityFor(t.id);
    const { total: util } = computeUtility(t, u);
    const grand = t.monthlyRent + util;
    const overdue = isOverdue(t);
    return [
      `${t.name} 您好，`,
      `這是 ${monthLabel(month)}${t.room ? `（${t.room}）` : ""}的費用提醒：`,
      `・租金：${ntd(t.monthlyRent)}`,
      util > 0 ? `・水電瓦斯：${ntd(util)}` : null,
      `・合計：${ntd(grand)}`,
      `繳款期限：每月 ${t.dueDay} 號${overdue ? "（已逾期，再麻煩盡快繳納）" : ""}`,
      `再請您撥空繳納，謝謝您！`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (!hydrated) {
    return <p className="rounded-2xl bg-white p-6 text-sm text-zinc-500 ring-1 ring-zinc-200">載入中…</p>;
  }

  return (
    <div className="space-y-4">
      {/* 月份切換 + 總覽 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="h-9 w-9 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
            >
              ‹
            </button>
            <span className="min-w-[7rem] text-center text-base font-bold text-zinc-900">{monthLabel(month)}</span>
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              className="h-9 w-9 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
            >
              ›
            </button>
            {month !== currentMonth() ? (
              <button
                type="button"
                onClick={() => setMonth(currentMonth())}
                className="ml-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                回本月
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setEditing(emptyTenant())}
            className="rounded-lg bg-[#0b2545] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1e3a8a]"
          >
            ＋ 新增房客
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <StatBox label="本月應收租金" value={ntd(summary.due)} accent="text-zinc-900" />
          <StatBox label="已收" value={ntd(summary.received)} accent="text-emerald-700" />
          <StatBox label="未收" value={ntd(summary.unpaid)} accent="text-rose-700" />
          <StatBox label="逾期戶數" value={`${summary.overdueCount} 戶`} accent="text-amber-700" />
        </div>
      </section>

      {tenants.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-zinc-200">
          <p className="text-3xl">🏠</p>
          <p className="mt-2 text-sm text-zinc-600">尚未建立任何房客，點「新增房客」開始管理你的自有出租物件。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map((t) => {
            const u = utilityFor(t.id);
            const calc = computeUtility(t, u);
            const paid = rentPaid(t.id);
            const overdue = isOverdue(t);
            const grand = t.monthlyRent + calc.total;
            return (
              <article
                key={t.id}
                className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
                  overdue ? "border-rose-300 ring-1 ring-rose-200" : "border-zinc-200"
                }`}
              >
                {/* 標頭：房客資訊 + 租金狀態 */}
                <div className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-zinc-900">{t.name || "（未命名）"}</h3>
                      {t.room ? (
                        <span className="rounded bg-[#0b2545]/10 px-1.5 py-0.5 text-[11px] font-bold text-[#0b2545]">
                          {t.room}
                        </span>
                      ) : null}
                      {paid ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          本月已繳
                        </span>
                      ) : overdue ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                          逾期未繳
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                          未繳
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t.address || "（未填地址）"}
                      {t.phone ? (
                        <>
                          {" · "}
                          <a href={`tel:${t.phone}`} className="text-[#2563eb] hover:underline">
                            {t.phone}
                          </a>
                        </>
                      ) : null}
                      {" · 每月 "}
                      {t.dueDay} 號繳租
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleRent(t.id)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                        paid
                          ? "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      {paid ? "取消已繳" : "標記已繳"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReminderTenant(t);
                        setCopied(false);
                      }}
                      className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                    >
                      催繳
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(t)}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      編輯
                    </button>
                  </div>
                </div>

                {/* 費用計算 */}
                <div className="border-t border-zinc-100 bg-zinc-50/60 p-4">
                  <p className="mb-2 text-xs font-semibold text-zinc-600">本月費用計算（水 / 電 / 瓦斯）</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MeterInput
                      label={`水費（每度 ${ntd(t.waterUnitPrice)}）`}
                      prev={u.waterPrev}
                      curr={u.waterCurr}
                      amount={calc.water}
                      onPrev={(v) => updateUtility(t.id, { waterPrev: v })}
                      onCurr={(v) => updateUtility(t.id, { waterCurr: v })}
                    />
                    <MeterInput
                      label={`電費（每度 ${ntd(t.electricUnitPrice)}）`}
                      prev={u.electricPrev}
                      curr={u.electricCurr}
                      amount={calc.electric}
                      onPrev={(v) => updateUtility(t.id, { electricPrev: v })}
                      onCurr={(v) => updateUtility(t.id, { electricCurr: v })}
                    />
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600">瓦斯費（直接填金額）</label>
                      <input
                        type="number"
                        min="0"
                        value={u.gasAmount || ""}
                        onChange={(e) => updateUtility(t.id, { gasAmount: Number(e.target.value) || 0 })}
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        placeholder="例：350"
                      />
                      <p className="mt-1 text-right text-sm font-bold text-zinc-900">{ntd(calc.gas)}</p>
                    </div>
                  </div>

                  {/* 合計 */}
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-zinc-200 pt-3 text-sm">
                    <span className="text-zinc-500">
                      租金 <span className="font-semibold text-zinc-800">{ntd(t.monthlyRent)}</span>
                    </span>
                    <span className="text-zinc-500">
                      水電瓦斯 <span className="font-semibold text-zinc-800">{ntd(calc.total)}</span>
                    </span>
                    <span className="text-base font-bold text-[#0b2545]">本月合計 {ntd(grand)}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing ? (
        <TenantForm
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={saveTenant}
          onDelete={tenants.some((x) => x.id === editing.id) ? () => removeTenant(editing.id) : undefined}
        />
      ) : null}

      {reminderTenant ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setReminderTenant(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-zinc-900">催繳訊息 — {reminderTenant.name}</h3>
            <textarea
              readOnly
              value={reminderText(reminderTenant)}
              className="mt-3 h-44 w-full resize-none rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
            />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {reminderTenant.phone ? (
                <a
                  href={`tel:${reminderTenant.phone}`}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  撥打 {reminderTenant.phone}
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(reminderText(reminderTenant));
                  setCopied(true);
                }}
                className="rounded-lg bg-[#0b2545] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1e3a8a]"
              >
                {copied ? "已複製 ✓" : "複製訊息"}
              </button>
              <button
                type="button"
                onClick={() => setReminderTenant(null)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-2.5 ring-1 ring-zinc-100">
      <p className="text-[11px] font-medium text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function MeterInput({
  label,
  prev,
  curr,
  amount,
  onPrev,
  onCurr,
}: {
  label: string;
  prev: number;
  curr: number;
  amount: number;
  onPrev: (v: number) => void;
  onCurr: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min="0"
          value={prev || ""}
          onChange={(e) => onPrev(Number(e.target.value) || 0)}
          className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm"
          placeholder="上次度數"
        />
        <span className="text-zinc-400">→</span>
        <input
          type="number"
          min="0"
          value={curr || ""}
          onChange={(e) => onCurr(Number(e.target.value) || 0)}
          className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm"
          placeholder="本次度數"
        />
      </div>
      <p className="mt-1 text-right text-sm font-bold text-zinc-900">
        {Math.max(0, curr - prev)} 度 · {ntd(amount)}
      </p>
    </div>
  );
}

function TenantForm({
  initial,
  onCancel,
  onSave,
  onDelete,
}: {
  initial: Tenant;
  onCancel: () => void;
  onSave: (t: Tenant) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<Tenant>(initial);
  const set = <K extends keyof Tenant>(key: K, value: Tenant[K]) => setForm((f) => ({ ...f, [key]: value }));
  const field = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm";
  const labelCls = "mb-1 block text-xs font-medium text-zinc-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-zinc-900">{initial.name ? "編輯房客" : "新增房客"}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>房客姓名（必填）</label>
            <input className={field} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="例：陳先生" />
          </div>
          <div>
            <label className={labelCls}>房號 / 單位</label>
            <input className={field} value={form.room} onChange={(e) => set("room", e.target.value)} placeholder="例：3F-A、302" />
          </div>
          <div>
            <label className={labelCls}>聯絡電話</label>
            <input className={field} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="例：0912-345-678" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>物件地址</label>
            <input className={field} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="例：板橋區文化路一段 100 號" />
          </div>
          <div>
            <label className={labelCls}>月租金（元）</label>
            <input type="number" min="0" className={field} value={form.monthlyRent || ""} onChange={(e) => set("monthlyRent", Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelCls}>每月幾號繳租</label>
            <input type="number" min="1" max="31" className={field} value={form.dueDay || ""} onChange={(e) => set("dueDay", Number(e.target.value) || 1)} />
          </div>
          <div>
            <label className={labelCls}>押金（元）</label>
            <input type="number" min="0" className={field} value={form.deposit || ""} onChange={(e) => set("deposit", Number(e.target.value) || 0)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>水費 / 度</label>
              <input type="number" min="0" step="0.1" className={field} value={form.waterUnitPrice || ""} onChange={(e) => set("waterUnitPrice", Number(e.target.value) || 0)} />
            </div>
            <div>
              <label className={labelCls}>電費 / 度</label>
              <input type="number" min="0" step="0.1" className={field} value={form.electricUnitPrice || ""} onChange={(e) => set("electricUnitPrice", Number(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>租約起始</label>
            <input type="date" className={field} value={form.leaseStart} onChange={(e) => set("leaseStart", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>租約到期</label>
            <input type="date" className={field} value={form.leaseEnd} onChange={(e) => set("leaseEnd", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>備註</label>
            <textarea className={`${field} h-16`} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="例：含車位、押二付一…" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          {onDelete ? (
            <button type="button" onClick={onDelete} className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
              刪除
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                if (!form.name.trim()) {
                  window.alert("請填寫房客姓名");
                  return;
                }
                onSave({ ...form, name: form.name.trim() });
              }}
              className="rounded-lg bg-[#0b2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e3a8a]"
            >
              儲存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
