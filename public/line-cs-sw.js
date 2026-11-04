/* 客服背景推播：即使客服分頁關閉也能收到 LINE 新訊 */
self.addEventListener("push", (event) => {
  let data = { title: "租屋配對客服", body: "有新的 LINE 訊息", url: "/admin/line-assistant" };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    /* ignore */
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "租屋配對客服", {
      body: data.body || "有新的 LINE 訊息",
      tag: data.lineUserId ? `line-cs-${data.lineUserId}` : "line-cs",
      data: { url: data.url || "/admin/line-assistant" },
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/admin/line-assistant";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && typeof client.navigate === "function") {
            try {
              await client.navigate(targetUrl);
            } catch {
              /* ignore */
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
