/** 當 Vercel 未設 LINE_CHANNEL_ACCESS_TOKEN 時，從 AdminCloud 讀取（由本機腳本寫入） */

import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";

type Secrets = {
  lineChannelAccessToken?: string;
  updatedAt?: string;
};

export async function readLineChannelAccessTokenFromCloud(): Promise<string> {
  try {
    const payload = (await readAdminCloudPayload(
      ADMIN_CLOUD_DATA_KEYS.lineRuntimeSecrets,
    )) as Secrets | null;
    const token =
      typeof payload?.lineChannelAccessToken === "string"
        ? payload.lineChannelAccessToken.trim()
        : "";
    return token;
  } catch {
    return "";
  }
}

export async function writeLineChannelAccessTokenToCloud(token: string) {
  const trimmed = token.trim();
  if (!trimmed) throw new Error("empty token");
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineRuntimeSecrets, {
    lineChannelAccessToken: trimmed,
    updatedAt: new Date().toISOString(),
  } satisfies Secrets);
}
