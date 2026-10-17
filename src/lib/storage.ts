import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_BUCKET = "listing-media";

/** 只保留專案根網址，例如 https://abcdefgh.supabase.co */
export function normalizeSupabaseProjectUrl(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;

  let url = raw.trim().replace(/^["']|["']$/g, "");
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(".supabase.co")) {
      return null;
    }
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return null;
  }
}

/** 避免把整段 Storage URL 誤貼成 bucket 名稱。 */
export function normalizeStorageBucket(raw: string | undefined): string {
  let name = (raw ?? DEFAULT_BUCKET).trim().replace(/^["']|["']$/g, "");
  if (!name) return DEFAULT_BUCKET;

  const fromObjectUrl = name.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/?#]+)/i);
  if (fromObjectUrl?.[1]) return fromObjectUrl[1];

  if (name.includes("/")) {
    const segments = name.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    if (/^[a-z0-9][a-z0-9-_]*$/i.test(last)) return last;
  }

  return name.replace(/^\/+|\/+$/g, "") || DEFAULT_BUCKET;
}

export function normalizeStorageObjectPath(filename: string): string {
  return filename.replace(/^\/+/, "").replace(/\\/g, "/");
}

export function validateSupabaseStorageConfig():
  | { ok: true; url: string; bucket: string }
  | { ok: false; message: string } {
  const url = normalizeSupabaseProjectUrl(process.env.SUPABASE_URL);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, "");
  const bucket = normalizeStorageBucket(process.env.SUPABASE_STORAGE_BUCKET);

  if (!url) {
    return {
      ok: false,
      message:
        "SUPABASE_URL 格式錯誤。請在 Supabase → Settings → General 或 Data API 複製 Project URL，只填 https://xxxxx.supabase.co（不要含 /rest/v1、/storage 或金鑰）。",
    };
  }

  if (!key) {
    return { ok: false, message: "缺少 SUPABASE_SERVICE_ROLE_KEY（Supabase → API Keys → Secret key）。" };
  }

  if (key.startsWith("sb_publishable_")) {
    return {
      ok: false,
      message: "SUPABASE_SERVICE_ROLE_KEY 誤用了 Publishable key，請改貼 Secret key（sb_secret_...）。",
    };
  }

  if (!/^[a-z0-9][a-z0-9-_]{0,62}$/i.test(bucket)) {
    return {
      ok: false,
      message: `SUPABASE_STORAGE_BUCKET 名稱無效：「${bucket}」。請只填 bucket 名稱，例如 listing-media。`,
    };
  }

  return { ok: true, url, bucket };
}

export function isSupabaseStorageConfigured() {
  return validateSupabaseStorageConfig().ok;
}

export function getSupabaseStorage(): { client: SupabaseClient; bucket: string } | null {
  const validated = validateSupabaseStorageConfig();
  if (!validated.ok) return null;

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim().replace(/^["']|["']$/g, "");
  const client = createClient(validated.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { client, bucket: validated.bucket };
}

export async function probeSupabaseStorage(): Promise<{ ok: boolean; message: string }> {
  const validated = validateSupabaseStorageConfig();
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  const storage = getSupabaseStorage();
  if (!storage) {
    return { ok: false, message: "無法建立 Supabase Storage 連線。" };
  }

  const { error } = await storage.client.storage.from(storage.bucket).list("", { limit: 1 });
  if (error) {
    return {
      ok: false,
      message: `無法存取 bucket「${storage.bucket}」：${error.message}。請到 Supabase → Storage 建立同名 Public bucket。`,
    };
  }

  return { ok: true, message: `已連線 https://${new URL(validated.url).hostname} / bucket「${storage.bucket}」` };
}

export async function uploadToSupabaseStorage(
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const storage = getSupabaseStorage();
  if (!storage) {
    const validated = validateSupabaseStorageConfig();
    throw new Error(validated.ok ? "Supabase Storage 尚未設定" : validated.message);
  }

  const objectPath = normalizeStorageObjectPath(filename);
  const { error } = await storage.client.storage.from(storage.bucket).upload(objectPath, buffer, {
    contentType,
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) {
    const hint =
      error.message.includes("Invalid path") || error.message.includes("request URL")
        ? " 請檢查 Vercel 的 SUPABASE_URL 是否為 https://xxxxx.supabase.co（僅網域），SUPABASE_STORAGE_BUCKET 是否為 listing-media。"
        : "";
    throw new Error(`Supabase 上傳失敗：${error.message}${hint}`);
  }
  const { data } = storage.client.storage.from(storage.bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}
