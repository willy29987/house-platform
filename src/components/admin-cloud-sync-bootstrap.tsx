"use client";

import { useEffect } from "react";
import { prefetchAdminCloudData } from "@/lib/admin-cloud-sync-client";

/** 登入後台後預拉雲端資料，避免各頁只看到該網域的空 localStorage */
export function AdminCloudSyncBootstrap() {
  useEffect(() => {
    prefetchAdminCloudData();
  }, []);
  return null;
}
