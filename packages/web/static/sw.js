self.addEventListener("push", (event) => {
  const data = event.data?.json?.() ?? {};
  const title = data.title ?? "ChatGPA";
  const body = data.body ?? "";
  const tag = data.tag ?? "chatgpa";
  const url = data.url ?? "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: { url },
      icon: "/favicon.ico",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
