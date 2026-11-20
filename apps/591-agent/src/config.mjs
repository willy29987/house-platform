import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadDotEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    const val = trimmed.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnv();

export const config = {
  baseUrl: (process.env.HOUSE_PLATFORM_URL || "http://127.0.0.1:3000").replace(/\/$/, ""),
  token: process.env.AGENT_TOKEN || "",
  label: process.env.AGENT_LABEL || "office-agent",
  pollMs: Math.max(5000, Number(process.env.POLL_MS || 15000) || 15000),
  userDataDir: path.resolve(root, process.env.USER_DATA_DIR || "./.browser-profile"),
};

export function assertConfig() {
  if (!config.token) {
    throw new Error("缺少 AGENT_TOKEN：請在 apps/591-agent/.env 設定（後台可產生）");
  }
}
