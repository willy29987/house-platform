#!/usr/bin/env node
/**
 * 更新 .vscode/tasks.json 內「內網・內嵌」任務的 Simple Browser 網址。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TASKS_PATH = path.join(ROOT, ".vscode", "tasks.json");
const PORT = process.env.PORT || "3000";
const WATCH = process.argv.includes("--watch");
const INTERVAL_MS = Number(process.env.LAN_SYNC_MS || "4000");

const LAN_TASKS = [
  {
    label: "Cursor: 外網・手機（內網・內嵌）",
    buildUrl: (lanMobilePreview) => {
      const u = new URL(lanMobilePreview);
      u.searchParams.set("lan", "1");
      return u.toString();
    },
    pathForFetch: "/mobile-preview",
  },
  {
    label: "Cursor: 外網・電腦（內網・內嵌）",
    buildUrl: (lanBase) => `${lanBase}/?lan=1`,
    pathForFetch: "/",
  },
  {
    label: "Cursor: 後台・手機（內網・內嵌）",
    buildUrl: (lanMobilePreview) => {
      const u = new URL(lanMobilePreview);
      u.searchParams.set("scope", "admin");
      u.searchParams.set("path", "/admin/login");
      u.searchParams.set("lan", "1");
      return u.toString();
    },
    pathForFetch: "/mobile-preview",
  },
  {
    label: "Cursor: 後台・電腦（內網・內嵌）",
    buildUrl: (lanBase) => `${lanBase}/admin/login?lan=1`,
    pathForFetch: "/admin/login",
  },
];

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

function lanBaseFromUrl(fullUrl) {
  const u = new URL(fullUrl);
  return `${u.protocol}//${u.host}`;
}

function setTaskBrowserUrl(tasks, label, url) {
  const task = tasks.tasks.find((t) => t.label === label);
  if (!task?.args?.commands?.[0]) {
    throw new Error(`tasks.json missing runCommands task: ${label}`);
  }
  task.args.commands[0].args = [url];
}

function patchTasks(updates) {
  const raw = fs.readFileSync(TASKS_PATH, "utf8");
  const tasks = JSON.parse(raw);
  let changed = false;

  for (const { label, url } of updates) {
    const task = tasks.tasks.find((t) => t.label === label);
    const prev = task?.args?.commands?.[0]?.args?.[0];
    if (prev === url) continue;
    setTaskBrowserUrl(tasks, label, url);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(TASKS_PATH, `${JSON.stringify(tasks, null, 2)}\n`);
  }
  return changed;
}

async function syncOnce() {
  const [lanMobilePreview, lanHome, lanAdminLogin] = await Promise.all([
    fetchLanUrl("/mobile-preview"),
    fetchLanUrl("/"),
    fetchLanUrl("/admin/login"),
  ]);
  const lanBase = lanBaseFromUrl(lanHome);

  const updates = LAN_TASKS.map((spec) => {
    const seed =
      spec.pathForFetch === "/mobile-preview" ? lanMobilePreview : lanBase;
    const url =
      spec.pathForFetch === "/admin/login"
        ? spec.buildUrl(lanBase)
        : spec.buildUrl(seed);
    return { label: spec.label, url };
  });

  const changed = patchTasks(updates);
  if (changed) {
    process.stderr.write("[lan-preview] 內嵌網址已更新\n");
    for (const { label, url } of updates) {
      process.stderr.write(`  ${label}\n    ${url}\n`);
    }
  }
  return { updates, changed };
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
