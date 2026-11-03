/** 當 Vercel 未設 LINE token／secret 時，從 AdminCloud 讀取（由本機腳本寫入） */

import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";

type Secrets = {
  lineChannelAccessToken?: string;
  lineChannelSecret?: string;
  updatedAt?: string;
};

async function readSecrets(): Promise<Secrets> {
  try {
    const payload = (await readAdminCloudPayload(
      ADMIN_CLOUD_DATA_KEYS.lineRuntimeSecrets,
    )) as Secrets | null;
    return payload && typeof payload === "object" ? payload : {};
  } catch {
    return {};
  }
}

export async function readLineChannelAccessTokenFromCloud(): Promise<string> {
  const payload = await readSecrets();
  return typeof payload.lineChannelAccessToken === "string"
    ? payload.lineChannelAccessToken.trim()
    : "";
}

export async function readLineChannelSecretFromCloud(): Promise<string> {
  const payload = await readSecrets();
  return typeof payload.lineChannelSecret === "string"
    ? payload.lineChannelSecret.trim()
    : "";
}

export async function writeLineRuntimeSecretsToCloud(input: {
  accessToken?: string;
  channelSecret?: string;
}) {
  const current = await readSecrets();
  const next: Secrets = {
    ...current,
    updatedAt: new Date().toISOString(),
  };
  if (input.accessToken?.trim()) {
    next.lineChannelAccessToken = input.accessToken.trim();
  }
  if (input.channelSecret?.trim()) {
    next.lineChannelSecret = input.channelSecret.trim();
  }
  if (!next.lineChannelAccessToken && !next.lineChannelSecret) {
    throw new Error("empty secrets");
  }
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineRuntimeSecrets, next);
}

export async function writeLineChannelAccessTokenToCloud(token: string) {
  await writeLineRuntimeSecretsToCloud({ accessToken: token });
}
