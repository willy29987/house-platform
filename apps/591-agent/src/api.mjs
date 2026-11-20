import { config } from "./config.mjs";

async function post(path, body) {
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ label: config.label, ...(body || {}) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(json.message || `HTTP ${res.status} ${path}`);
  }
  return json;
}

export function heartbeat() {
  return post("/api/agent/591/heartbeat", {});
}

export function claimJobs(limit = 3) {
  return post("/api/agent/591/claim", { limit });
}

export function completeJob(payload) {
  return post("/api/agent/591/complete", payload);
}

export function requestExpiryScan(opts = {}) {
  return post("/api/agent/591/expiry-scan", {
    staleHours: opts.staleHours ?? 20,
    limit: opts.limit ?? 15,
    force: Boolean(opts.force),
  });
}
