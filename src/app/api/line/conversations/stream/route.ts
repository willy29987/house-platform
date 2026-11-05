import { getCurrentAdmin } from "@/lib/admin-auth";
import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readLineConversations } from "@/lib/line-conversations";
import { listOpenGuestSessions } from "@/lib/line-guest-sessions";
import { listGuestProfileUserIds } from "@/lib/line-guest-profile";
import { listActiveGuestWatches } from "@/lib/line-guest-watch";
import { readLineRentalCases } from "@/lib/line-rental-cases";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const WATCH_KEYS = [
  ADMIN_CLOUD_DATA_KEYS.lineConversations,
  ADMIN_CLOUD_DATA_KEYS.lineRentalCases,
  ADMIN_CLOUD_DATA_KEYS.lineGuestSessions,
  ADMIN_CLOUD_DATA_KEYS.lineGuestWatchCriteria,
  ADMIN_CLOUD_DATA_KEYS.lineGuestProfile,
] as const;

async function readChangeStamp(): Promise<string> {
  const rows = await prisma.adminCloudData.findMany({
    where: { key: { in: [...WATCH_KEYS] } },
    select: { key: true, updatedAt: true },
  });
  return WATCH_KEYS.map((key) => {
    const row = rows.find((item) => item.key === key);
    return `${key}:${row?.updatedAt?.toISOString() ?? "0"}`;
  }).join("|");
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => resolve(), ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return new Response("未登入", { status: 401 });
  }

  const encoder = new TextEncoder();
  const { signal } = request;
  let lastStamp = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      let lastPingAt = 0;
      try {
        send("ready", { ok: true, at: new Date().toISOString() });

        while (!signal.aborted) {
          const stamp = await readChangeStamp();
          if (stamp !== lastStamp) {
            lastStamp = stamp;
            const [conversations, cases, sessions, watches, profileUserIds] = await Promise.all([
              readLineConversations(),
              readLineRentalCases(),
              listOpenGuestSessions(),
              listActiveGuestWatches(),
              listGuestProfileUserIds(),
            ]);
            send("snapshot", {
              conversations,
              cases,
              sessions,
              watches,
              profileUserIds,
              fetchedAt: new Date().toISOString(),
            });
          } else if (Date.now() - lastPingAt > 15_000) {
            // 心跳，避免中介層切斷長連線
            lastPingAt = Date.now();
            send("ping", { at: new Date().toISOString() });
          }

          // ~LINE 傳訊體感：變更後通常 0.4s 內推到客服頁
          await sleep(400, signal);
        }
      } catch (error) {
        if (!signal.aborted) {
          console.error("[line/conversations/stream]", error);
          try {
            send("error", { message: "stream_failed" });
          } catch {
            /* ignore */
          }
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      }
    },
    cancel() {
      /* client disconnected */
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
