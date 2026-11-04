/** 客服背景推播（Web Push）：即使關掉客服分頁也能收到新訊提醒 */

import webpush from "web-push";
import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";

export type AdminPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
  updatedAt: string;
  userAgent?: string;
};

type SubscriptionStore = {
  subscriptions: AdminPushSubscription[];
};

type VapidStore = {
  publicKey: string;
  privateKey: string;
  subject: string;
  updatedAt: string;
};

const MAX_SUBSCRIPTIONS = 40;

function normalizeSubscriptions(payload: unknown): SubscriptionStore {
  if (!payload || typeof payload !== "object") return { subscriptions: [] };
  const rows = Array.isArray((payload as SubscriptionStore).subscriptions)
    ? (payload as SubscriptionStore).subscriptions
    : [];
  return {
    subscriptions: rows
      .filter(
        (row) =>
          row &&
          typeof row.endpoint === "string" &&
          row.keys &&
          typeof row.keys.p256dh === "string" &&
          typeof row.keys.auth === "string",
      )
      .slice(0, MAX_SUBSCRIPTIONS),
  };
}

async function readVapidFromEnv(): Promise<VapidStore | null> {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() || "";
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() || "";
  const subject =
    process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || "mailto:admin@house-platform.local";
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject,
    updatedAt: new Date().toISOString(),
  };
}

export async function ensureAdminWebPushVapid(): Promise<VapidStore> {
  const fromEnv = await readVapidFromEnv();
  if (fromEnv) return fromEnv;

  const existing = (await readAdminCloudPayload(
    ADMIN_CLOUD_DATA_KEYS.adminWebPushVapid,
  )) as VapidStore | null;
  if (
    existing &&
    typeof existing.publicKey === "string" &&
    typeof existing.privateKey === "string" &&
    existing.publicKey &&
    existing.privateKey
  ) {
    return {
      publicKey: existing.publicKey,
      privateKey: existing.privateKey,
      subject: existing.subject || "mailto:admin@house-platform.local",
      updatedAt: existing.updatedAt || new Date().toISOString(),
    };
  }

  const generated = webpush.generateVAPIDKeys();
  const next: VapidStore = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject: "mailto:admin@house-platform.local",
    updatedAt: new Date().toISOString(),
  };
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.adminWebPushVapid, next);
  return next;
}

export async function getAdminWebPushPublicKey(): Promise<string> {
  const vapid = await ensureAdminWebPushVapid();
  return vapid.publicKey;
}

export async function upsertAdminPushSubscription(input: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}): Promise<void> {
  const endpoint = input.endpoint.trim();
  const p256dh = input.keys.p256dh.trim();
  const auth = input.keys.auth.trim();
  if (!endpoint || !p256dh || !auth) throw new Error("invalid subscription");

  const store = normalizeSubscriptions(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.adminWebPushSubscriptions),
  );
  const now = new Date().toISOString();
  const nextRow: AdminPushSubscription = {
    endpoint,
    keys: { p256dh, auth },
    createdAt: now,
    updatedAt: now,
    userAgent: input.userAgent?.slice(0, 180),
  };
  const index = store.subscriptions.findIndex((row) => row.endpoint === endpoint);
  if (index >= 0) {
    nextRow.createdAt = store.subscriptions[index].createdAt || now;
    store.subscriptions[index] = nextRow;
  } else {
    store.subscriptions.unshift(nextRow);
  }
  store.subscriptions = store.subscriptions.slice(0, MAX_SUBSCRIPTIONS);
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.adminWebPushSubscriptions, store);
}

export async function removeAdminPushSubscription(endpoint: string): Promise<void> {
  const target = endpoint.trim();
  if (!target) return;
  const store = normalizeSubscriptions(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.adminWebPushSubscriptions),
  );
  store.subscriptions = store.subscriptions.filter((row) => row.endpoint !== target);
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.adminWebPushSubscriptions, store);
}

export async function notifyAdminsLineGuestMessage(input: {
  lineUserId: string;
  displayName: string;
  text: string;
}): Promise<void> {
  const store = normalizeSubscriptions(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.adminWebPushSubscriptions),
  );
  if (!store.subscriptions.length) return;

  const vapid = await ensureAdminWebPushVapid();
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const title = input.displayName.trim() || "LINE 客人";
  const body = input.text.replace(/\s+/g, " ").trim().slice(0, 120) || "傳了一則新訊息";
  const payload = JSON.stringify({
    title,
    body,
    url: "/admin/line-assistant",
    lineUserId: input.lineUserId,
    at: new Date().toISOString(),
  });

  const stale: string[] = [];
  await Promise.all(
    store.subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          payload,
          { TTL: 60 * 60, urgency: "high" },
        );
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          stale.push(sub.endpoint);
        } else {
          console.warn("[admin-web-push] send failed", statusCode || error);
        }
      }
    }),
  );

  if (stale.length) {
    store.subscriptions = store.subscriptions.filter((row) => !stale.includes(row.endpoint));
    await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.adminWebPushSubscriptions, store);
  }
}
