/**
 * 物件廣告照：先評分再決定調多少。
 * 已經夠好的幾乎不動；偏暗／平／色偏才輕～中度拉齊。
 * 只用 sharp，不呼叫付費 AI。
 */

export type ListingPhotoEnhanceTier = "skip" | "light" | "medium";

export type ListingPhotoEnhanceResult = {
  buffer: Buffer;
  contentType: string;
  extension: string;
  tier: ListingPhotoEnhanceTier;
  reason: string;
};

type PhotoStats = {
  brightness: number;
  contrast: number;
  castWarm: number;
  castCool: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

async function loadSharp() {
  const mod = await import("sharp");
  return mod.default;
}

/** 抽樣統計：亮度／對比／冷暖色偏 */
async function analyzePhoto(buffer: Buffer): Promise<PhotoStats | null> {
  try {
    const sharp = await loadSharp();
    const { data, info } = await sharp(buffer)
      .rotate()
      .resize(160, 160, { fit: "inside", withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels || 3;
    if (channels < 3 || data.length < channels * 16) return null;

    let sumY = 0;
    let sumSqY = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    const pixels = Math.floor(data.length / channels);
    for (let i = 0; i < pixels; i++) {
      const o = i * channels;
      const r = data[o]!;
      const g = data[o + 1]!;
      const b = data[o + 2]!;
      // Rec. 601 luma
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      sumY += y;
      sumSqY += y * y;
      sumR += r;
      sumG += g;
      sumB += b;
    }

    const meanY = sumY / pixels;
    const variance = Math.max(0, sumSqY / pixels - meanY * meanY);
    const contrast = Math.sqrt(variance);
    const meanR = sumR / pixels;
    const meanG = sumG / pixels;
    const meanB = sumB / pixels;

    return {
      brightness: meanY,
      contrast,
      castWarm: meanR - meanB, // >0 偏暖／黃
      castCool: meanB - meanR, // >0 偏冷／藍
    };
  } catch {
    return null;
  }
}

function decideTier(stats: PhotoStats): { tier: ListingPhotoEnhanceTier; reason: string } {
  const { brightness, contrast, castWarm, castCool } = stats;
  const absCast = Math.max(Math.abs(castWarm), Math.abs(castCool));

  // 室內照對比天生較柔，門檻略寬，避免「已夠好看」仍被判太平
  const dark = brightness < 78;
  const bright = brightness > 178;
  const flat = contrast < 24;
  const casty = absCast > 22;

  const mildDark = brightness < 95;
  const mildBright = brightness > 160;
  const mildFlat = contrast < 32;
  const mildCast = absCast > 14;

  if (dark || bright || flat || casty) {
    const bits = [
      dark ? "偏暗" : "",
      bright ? "偏亮" : "",
      flat ? "對比不足" : "",
      casty ? "色偏" : "",
    ].filter(Boolean);
    return { tier: "medium", reason: bits.join("、") || "需調整" };
  }

  if (mildDark || mildBright || mildFlat || mildCast) {
    const bits = [
      mildDark ? "略暗" : "",
      mildBright ? "略亮" : "",
      mildFlat ? "略平" : "",
      mildCast ? "輕微色偏" : "",
    ].filter(Boolean);
    return { tier: "light", reason: bits.join("、") || "輕調" };
  }

  return { tier: "skip", reason: "品質已夠好" };
}

function buildPipeline(
  sharp: Awaited<ReturnType<typeof loadSharp>>,
  buffer: Buffer,
  stats: PhotoStats,
  tier: ListingPhotoEnhanceTier,
) {
  let img = sharp(buffer).rotate();

  if (tier === "skip") {
    return img;
  }

  // 亮度：以 118 為居家照舒適帶中心，只做有限修正
  const targetBright = 118;
  let brightness = 1;
  if (stats.brightness < targetBright) {
    const deficit = targetBright - stats.brightness;
    brightness = 1 + clamp(deficit / 220, 0, tier === "medium" ? 0.18 : 0.1);
  } else if (stats.brightness > 155) {
    const excess = stats.brightness - 145;
    brightness = 1 - clamp(excess / 260, 0, tier === "medium" ? 0.1 : 0.06);
  }

  // 飽和：略增一點居家感，已夠好的不進這層
  const saturation = tier === "medium" ? 1.08 : 1.04;

  // 色溫：微暖居家，但冷偏才補暖、過暖則略壓
  let warmthBoost = 0;
  if (stats.castCool > 12) {
    warmthBoost = tier === "medium" ? 6 : 3;
  } else if (stats.castWarm > 18) {
    warmthBoost = tier === "medium" ? -4 : -2;
  }

  img = img.modulate({
    brightness,
    saturation,
  });

  // 對比不足才做很輕的 normalize；已夠好的不做
  if (stats.contrast < 30) {
    img = img.normalize({ lower: tier === "medium" ? 2 : 1, upper: tier === "medium" ? 98 : 99 });
  }

  if (warmthBoost !== 0) {
    // 線性通道微調近似色溫（保守）
    const warm = warmthBoost;
    img = img.linear(
      [1 + warm * 0.004, 1, 1 - warm * 0.004],
      [warm * 0.35, 0, -warm * 0.25],
    );
  }

  // 輕銳化：讓空間邊緣清楚，不做重磨皮感
  img = img.sharpen({
    sigma: tier === "medium" ? 0.9 : 0.7,
    m1: 0.5,
    m2: 0.3,
  });

  return img;
}

/**
 * 物件廣告照美化。非圖片／讀取失敗時原樣返回（仍盡力轉正）。
 */
export async function enhanceListingPhoto(input: Buffer): Promise<ListingPhotoEnhanceResult> {
  let sharp: Awaited<ReturnType<typeof loadSharp>>;
  try {
    sharp = await loadSharp();
  } catch {
    return {
      buffer: input,
      contentType: "image/jpeg",
      extension: "jpg",
      tier: "skip",
      reason: "美化模組不可用，保留原圖",
    };
  }
  let working = input;

  try {
    // HEIC／奇怪方向先轉成可分析的 jpeg buffer
    const meta = await sharp(input).metadata();
    if (meta.format === "gif" && (meta.pages ?? 1) > 1) {
      return {
        buffer: input,
        contentType: "image/gif",
        extension: "gif",
        tier: "skip",
        reason: "動圖不處理",
      };
    }
  } catch {
    return {
      buffer: input,
      contentType: "image/jpeg",
      extension: "jpg",
      tier: "skip",
      reason: "無法讀取，保留原圖",
    };
  }

  const stats = await analyzePhoto(working);
  if (!stats) {
    try {
      const out = await sharp(working).rotate().jpeg({ quality: 85, mozjpeg: true }).toBuffer();
      return {
        buffer: out,
        contentType: "image/jpeg",
        extension: "jpg",
        tier: "skip",
        reason: "無法評分，僅轉正",
      };
    } catch {
      return {
        buffer: input,
        contentType: "image/jpeg",
        extension: "jpg",
        tier: "skip",
        reason: "處理失敗，保留原圖",
      };
    }
  }

  const { tier, reason } = decideTier(stats);

  try {
    if (tier === "skip") {
      const meta = await sharp(working).metadata();
      const needsRotate = Boolean(meta.orientation && meta.orientation !== 1);
      // 夠好的：能原樣上架就不重編碼，避免無謂改變觀感
      if (!needsRotate && meta.format === "jpeg") {
        return { buffer: working, contentType: "image/jpeg", extension: "jpg", tier, reason };
      }
      if (!needsRotate && meta.format === "png") {
        return { buffer: working, contentType: "image/png", extension: "png", tier, reason };
      }
      if (!needsRotate && meta.format === "webp") {
        return { buffer: working, contentType: "image/webp", extension: "webp", tier, reason };
      }
      const out = await sharp(working).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      return { buffer: out, contentType: "image/jpeg", extension: "jpg", tier, reason };
    }

    const pipeline = buildPipeline(sharp, working, stats, tier);
    const quality = tier === "light" ? 85 : 84;
    const out = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    return {
      buffer: out,
      contentType: "image/jpeg",
      extension: "jpg",
      tier,
      reason,
    };
  } catch {
    return {
      buffer: input,
      contentType: "image/jpeg",
      extension: "jpg",
      tier: "skip",
      reason: "美化失敗，保留原圖",
    };
  }
}
