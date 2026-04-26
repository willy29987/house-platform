import { createClient } from "@supabase/supabase-js";

const DEFAULT_BUCKET = "listing-media";

export function getSupabaseStorage() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? DEFAULT_BUCKET;
  if (!url || !key) return null;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { client, bucket };
}

export function isSupabaseStorageConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function uploadToSupabaseStorage(
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const storage = getSupabaseStorage();
  if (!storage) {
    throw new Error("Supabase Storage 尚未設定");
  }
  const { error } = await storage.client.storage
    .from(storage.bucket)
    .upload(filename, buffer, {
      contentType,
      upsert: false,
      cacheControl: "31536000",
    });
  if (error) {
    throw new Error(`Supabase 上傳失敗：${error.message}`);
  }
  const { data } = storage.client.storage.from(storage.bucket).getPublicUrl(filename);
  return data.publicUrl;
}
