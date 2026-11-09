import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp 含原生二進位；標成外部套件，避免 webhook 冷啟動因打包方式炸掉
  serverExternalPackages: ["sharp"],
  // sharp 執行時才 dlopen libvips，追蹤不到；不手動帶進去 Vercel 會 ERR_DLOPEN_FAILED
  outputFileTracingIncludes: {
    "/api/line/webhook": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.supabase.in",
      },
      {
        protocol: "https",
        hostname: "**.591.com.tw",
      },
    ],
  },
};

export default nextConfig;
