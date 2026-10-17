/** 房客管理本機快取 key（雲端同步見 admin-cloud-sync-client） */
export const TENANT_MANAGER_STORAGE_KEY = "house-platform:tenant-manager:v1";

export type TenantManagerStore = {
  tenants: {
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
  }[];
  rent: Record<string, { paid: boolean; paidAt?: string }>;
  utility: Record<
    string,
    {
      waterPrev: number;
      waterCurr: number;
      electricPrev: number;
      electricCurr: number;
      gasAmount: number;
    }
  >;
};

export const emptyTenantManagerStore: TenantManagerStore = { tenants: [], rent: {}, utility: {} };

export function loadTenantManagerStoreLocal(): TenantManagerStore {
  if (typeof window === "undefined") return emptyTenantManagerStore;
  try {
    const raw = window.localStorage.getItem(TENANT_MANAGER_STORAGE_KEY);
    if (!raw) return emptyTenantManagerStore;
    const parsed = JSON.parse(raw) as TenantManagerStore;
    return {
      tenants: parsed.tenants ?? [],
      rent: parsed.rent ?? {},
      utility: parsed.utility ?? {},
    };
  } catch {
    return emptyTenantManagerStore;
  }
}

export function persistTenantManagerStoreLocal(store: TenantManagerStore): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TENANT_MANAGER_STORAGE_KEY, JSON.stringify(store));
}
