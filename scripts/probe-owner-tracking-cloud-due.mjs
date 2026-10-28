#!/usr/bin/env node
/** 雲端 owner_tracking 聯繫日統計（只讀） */
import { PrismaClient } from "@prisma/client";

const TAIPEI_TZ = "Asia/Taipei";

function taipeiTodayYmd() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TAIPEI_TZ });
}

function dueCount(cases, today) {
  let n = 0;
  for (const c of cases) {
    const ymd = String(c.nextContactDate ?? "").trim();
    if (ymd && ymd <= today) n += 1;
  }
  return n;
}

const p = new PrismaClient();
const today = taipeiTodayYmd();
const row = await p.adminCloudData.findUnique({ where: { key: "owner_tracking" } });
const store = typeof row?.payload === "string" ? JSON.parse(row.payload) : row?.payload;
const cases = store?.cases ?? [];
const withDate = cases.filter((c) => String(c.nextContactDate ?? "").trim()).length;
const due = dueCount(cases, today);

console.log(
  JSON.stringify(
    {
      taipeiToday: today,
      totalCases: cases.length,
      withNextContactDate: withDate,
      dueTodayOrOverdue: due,
    },
    null,
    2,
  ),
);
await p.$disconnect();
