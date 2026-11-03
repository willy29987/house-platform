/** 動態載入 LIFF，避免靜態 import 在非 LIFF 網頁弄壞 hydration */

export type LiffClient = typeof import("@line/liff").default;

let cached: LiffClient | null = null;

export async function loadLiffClient(): Promise<LiffClient | null> {
  if (cached) return cached;
  try {
    const mod = await import("@line/liff");
    cached = mod.default;
    return cached;
  } catch (error) {
    console.warn("[line-liff-client] load failed", error);
    return null;
  }
}
