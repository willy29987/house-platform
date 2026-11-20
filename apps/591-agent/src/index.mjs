import { claimJobs, completeJob, heartbeat, requestExpiryScan } from "./api.mjs";
import { launchContext, detect591Login } from "./browser.mjs";
import { assertConfig, config } from "./config.mjs";
import { runJob } from "./actions/rent-sync.mjs";

assertConfig();

console.log(`[591-agent] start → ${config.baseUrl} label=${config.label}`);

const context = await launchContext({ headless: false });
const page = context.pages()[0] || (await context.newPage());

let lastExpiryScanAt = 0;
const EXPIRY_SCAN_EVERY_MS = 6 * 60 * 60 * 1000; // 約每 6 小時排一批到期檢查

async function tick() {
  try {
    await heartbeat();
  } catch (e) {
    console.warn("[heartbeat]", e.message || e);
  }

  if (Date.now() - lastExpiryScanAt > EXPIRY_SCAN_EVERY_MS) {
    try {
      const scan = await requestExpiryScan({ staleHours: 20, limit: 15 });
      lastExpiryScanAt = Date.now();
      if (scan.enqueued) console.log(`[expiry-scan] enqueued ${scan.enqueued}`);
    } catch (e) {
      console.warn("[expiry-scan]", e.message || e);
    }
  }

  let jobs = [];
  try {
    const res = await claimJobs(2);
    jobs = res.jobs || [];
  } catch (e) {
    console.warn("[claim]", e.message || e);
    return;
  }

  if (!jobs.length) return;

  const loggedIn = await detect591Login(page);
  if (!loggedIn) {
    for (const job of jobs) {
      await completeJob({
        jobId: job.id,
        status: "needs_login",
        error: "本機未登入 591，請執行 npm run login",
        result591Status: "needs_login",
      }).catch(() => {});
    }
    console.warn("[591-agent] needs_login — 已回報雲端");
    return;
  }

  for (const job of jobs) {
    console.log(`[job] ${job.id} ${job.type} listing=${job.listingId}`);
    try {
      const result = await runJob(page, job);
      const payload = {
        jobId: job.id,
        status: "done",
        logLine: result.logLine || `done:${job.type}`,
        result591Id: result.result591Id ?? null,
        result591Url: result.result591Url ?? null,
        result591Status: result.result591Status ?? null,
      };
      if (result.resultExpiresAt) payload.resultExpiresAt = result.resultExpiresAt;
      await completeJob(payload);
      console.log(`[job] done ${job.id}`);
    } catch (e) {
      const needsLogin = e?.code === "needs_login" || /未登入|登入/.test(String(e?.message || e));
      await completeJob({
        jobId: job.id,
        status: needsLogin ? "needs_login" : "failed",
        error: String(e?.message || e).slice(0, 400),
        result591Status: needsLogin ? "needs_login" : "sync_error",
      }).catch(() => {});
      console.error(`[job] fail ${job.id}`, e?.message || e);
      // 間隔，降低風控
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(1500);
  }
}

await tick();
setInterval(() => {
  tick().catch((e) => console.error(e));
}, config.pollMs);
