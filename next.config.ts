import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp 含原生二進位；標成外部套件，避免 webhook 冷啟動因打包方式炸掉
  serverExternalPackages: ["sharp"],
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
