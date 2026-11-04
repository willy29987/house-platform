/**
 * 驗證雲端 PUT 合併：舊裝置整包上傳不得抹掉另一端的追蹤進度
 * node scripts/verify-owner-tracking-cloud-merge.mjs
 */

function mergeOwnerTrackingStoresForCloudWrite(cloud, incoming) {
  const casesById = new Map();
  for (const c of cloud.cases) casesById.set(c.id, c);
  for (const incomingCase of incoming.cases) {
    const existing = casesById.get(incomingCase.id);
    if (!existing) {
      casesById.set(incomingCase.id, incomingCase);
      continue;
    }
    const cloudAt = existing.nextContactUpdatedAt || 0;
    const localAt = incomingCase.nextContactUpdatedAt || 0;
    const nextContact =
      localAt > cloudAt
        ? {
            nextContactDate: incomingCase.nextContactDate,
            nextContactUpdatedAt: localAt,
          }
        : {
            nextContactDate: existing.nextContactDate,
            nextContactUpdatedAt: cloudAt,
          };
    casesById.set(incomingCase.id, {
      ...existing,
      ...incomingCase,
      ...nextContact,
    });
  }
  const followById = new Map();
  for (const f of cloud.followUps) followById.set(f.id, f);
  for (const f of incoming.followUps) followById.set(f.id, f);
  return {
    cases: [...casesById.values()],
    followUps: [...followById.values()],
  };
}

const cloud = {
  cases: [{ id: "c1", nextContactDate: "2026-11-05", nextContactUpdatedAt: 200 }],
  followUps: [
    { id: "f1", caseId: "c1", status: "持續聯繫", createdAt: "2026-11-01T00:00:00.000Z" },
    { id: "f2", caseId: "c1", status: "可上591", createdAt: "2026-11-04T00:00:00.000Z" },
  ],
};

const stalePhone = {
  cases: [{ id: "c1", nextContactDate: "2026-11-01", nextContactUpdatedAt: 100 }],
  followUps: [
    { id: "f1", caseId: "c1", status: "持續聯繫", createdAt: "2026-11-01T00:00:00.000Z" },
  ],
};

const merged = mergeOwnerTrackingStoresForCloudWrite(cloud, stalePhone);
const ids = merged.followUps.map((f) => f.id).sort().join(",");
const next = merged.cases[0].nextContactDate;

let failed = 0;
if (ids !== "f1,f2") {
  console.error("FAIL follow-ups lost", ids);
  failed += 1;
}
if (next !== "2026-11-05") {
  console.error("FAIL nextContact overwritten", next);
  failed += 1;
}
if (failed) process.exit(1);
console.log("verify-owner-tracking-cloud-merge: ok");
