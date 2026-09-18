// Familienplaner — Hintergrunddienst für Erinnerungen.
// Muss neben index.html liegen, sonst kommen keine Benachrichtigungen an.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (_) { d = { body: e.data ? e.data.text() : "" }; }

  e.waitUntil(self.registration.showNotification(d.title || "Familienplaner", {
    body: d.body || "",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: self.registration.scope }
  }));
});

// Tippen auf die Benachrichtigung holt den Planer nach vorne
// oder öffnet ihn, falls er geschlossen ist.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const ziel = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenster) => {
      for (const f of fenster) {
        if (f.url.startsWith(self.registration.scope) && "focus" in f) return f.focus();
      }
      return self.clients.openWindow(ziel);
    })
  );
});
