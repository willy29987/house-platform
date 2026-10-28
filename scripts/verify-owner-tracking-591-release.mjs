/**
 * 驗證 591 下架：首次清空聯繫日；再檢查／屋主已出租 不清聯繫日
 * node scripts/verify-owner-tracking-591-release.mjs
 */

const SKIP = ["屋主已出租"];

function apply591RemovedSim(store, removedCaseIds) {
  const idSet = new Set(removedCaseIds);
  const releaseYmd = "2027-10-28";
  let casesChanged = false;
  const cases = store.cases.map((c) => {
    if (!idSet.has(c.id)) return c;
    const last = store.followUps
      .filter((f) => f.caseId === c.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (last && SKIP.includes(last.status)) return c;
    const existing = (c.expectedReleaseDate || "").trim();
    if (existing) return c;
    casesChanged = true;
    return { ...c, expectedReleaseDate: releaseYmd, nextContactDate: "" };
  });
  return { cases, casesChanged };
}

const store = {
  cases: [
    { id: "recheck", nextContactDate: "2026-10-28", expectedReleaseDate: "2027-10-28" },
    { id: "first", nextContactDate: "2026-10-28", expectedReleaseDate: "" },
    { id: "rented", nextContactDate: "2026-10-28", expectedReleaseDate: "" },
  ],
  followUps: [
    {
      caseId: "recheck",
      status: "持續聯繫",
      note: "591 連結已下架",
      createdAt: "2026-01-02",
    },
    { caseId: "rented", status: "屋主已出租", note: "", createdAt: "2026-01-02" },
  ],
};

const { cases } = apply591RemovedSim(store, ["recheck", "first", "rented"]);
const byId = Object.fromEntries(cases.map((c) => [c.id, c]));

const checks = [
  [byId.recheck.nextContactDate, "2026-10-28"],
  [byId.recheck.expectedReleaseDate, "2027-10-28"],
  [byId.first.nextContactDate, ""],
  [byId.first.expectedReleaseDate, "2027-10-28"],
  [byId.rented.nextContactDate, "2026-10-28"],
  [byId.rented.expectedReleaseDate, ""],
];

let failed = 0;
for (const [got, expected] of checks) {
  if (got !== expected) {
    console.error("FAIL", { got, expected });
    failed += 1;
  }
}

if (failed > 0) process.exit(1);
console.log("verify-owner-tracking-591-release: ok", {
  recheckKeptContact: byId.recheck.nextContactDate === "2026-10-28",
  firstClearedContact: byId.first.nextContactDate === "",
  rentedKeptContact: byId.rented.nextContactDate === "2026-10-28",
});
