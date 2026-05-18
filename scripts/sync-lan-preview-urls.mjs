#!/usr/bin/env node
/**
 * 更新 .vscode/tasks.json 內「後台・內網」任務的 Simple Browser 網址。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TASKS_PATH = path.join(ROOT, ".vscode", "tasks.json");
const PORT = process.env.PORT || "3000";
const WATCH = process.argv.includes("--watch");
const INTERVAL_MS = Number(process.env.LAN_SYNC_MS || "4000");

const LABEL_MOBILE = "Cursor: 後台・手機（內網・內嵌）";
const LABEL_DESKTOP = "Cursor: 後台・電腦（內網・內嵌）";

async function fetchLanUrl(pathSuffix) {
  const encoded = encodeURIComponent(pathSuffix);
  const res = await fetch(
    `http://127.0.0.1:${PORT}/api/dev/preview-urls?path=${encoded}`,
    { signal: AbortSignal.timeout(3000) },
  );
  if (!res.ok) throw new Error(`preview-urls ${res.status}`);
  const data = await res.json();
  const lan = data.lan;
  if (Array.isArray(lan) && lan[0]) return lan[0];
  return data.localhost || `http://127.0.0.1:${PORT}${pathSuffix}`;
}

function adminMobilePreviewUrl(baseMobilePreviewUrl) {
  const u = new URL(baseMobilePreviewUrl);
  u.searchParams.set("scope", "admin");
  u.searchParams.set("path", "/admin/login");
  u.searchParams.set("lan", "1");
  return u.toString();
}

function setTaskBrowserUrl(tasks, label, url) {
  const task = tasks.tasks.find((t) => t.label === label);
  if (!task?.args?.commands?.[0]) {
    throw new Error(`tasks.json missing runCommands task: ${label}`);
  }
  task.args.commands[0].args = [url];
}

function patchTasks(adminMobileUrl, adminDesktopUrl) {
  const raw = fs.readFileSync(TASKS_PATH, "utf8");
  const tasks = JSON.parse(raw);

  const mobileTask = tasks.tasks.find((t) => t.label === LABEL_MOBILE);
  const desktopTask = tasks.tasks.find((t) => t.label === LABEL_DESKTOP);
  const prevMobile = mobileTask?.args?.commands?.[0]?.args?.[0];
  const prevDesktop = desktopTask?.args?.commands?.[0]?.args?.[0];
  if (prevMobile === adminMobileUrl && prevDesktop === adminDesktopUrl) return false;

  setTaskBrowserUrl(tasks, LABEL_MOBILE, adminMobileUrl);
  setTaskBrowserUrl(tasks, LABEL_DESKTOP, adminDesktopUrl);
  fs.writeFileSync(TASKS_PATH, `${JSON.stringify(tasks, null, 2)}\n`);
  return true;
}

async function syncOnce() {
  const [mobileShell, adminDesktop] = await Promise.all([
    fetchLanUrl("/mobile-preview"),
    fetchLanUrl("/admin/login"),
  ]);
  const adminMobile = adminMobilePreviewUrl(mobileShell);
  const changed = patchTasks(adminMobile, adminDesktop);
  if (changed) {
    process.stderr.write(
      `[lan-preview] 後台內嵌網址已更新\n  手機 ${adminMobile}\n  電腦 ${adminDesktop}\n`,
    );
  }
  return { adminMobile, adminDesktop, changed };
}

async function main() {
  if (!WATCH) {
    await syncOnce();
    return;
  }

  process.stderr.write("[lan-preview] 等待 dev server…\n");
  for (;;) {
    try {
      await syncOnce();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  setInterval(() => {
    syncOnce().catch(() => {});
  }, INTERVAL_MS);
}

main().catch((err) => {
  process.stderr.write(`[lan-preview] ${err.message}\n`);
  process.exit(1);
});
