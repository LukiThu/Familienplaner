// Familienplaner — Hintergrunddienst.
// Zwei Aufgaben: Erinnerungen anzeigen und die App offline verfügbar halten.
// Muss neben index.html liegen.

const SPEICHER = "familienplaner-v1";
const BIBLIOTHEK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
// Nur eigene Dateien vorab ablegen. Die Bibliothek landet beim ersten
// Laden über den fetch-Teil im Speicher — hinge das Einrichten an einem
// fremden Server, käme es ohne Netz gar nicht erst zustande.
const SCHALE = ["./", "./index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SPEICHER);
    // Einzeln ablegen: fällt eine Datei aus, soll der Rest trotzdem da sein.
    await Promise.all(SCHALE.map((u) => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen.filter((n) => n !== SPEICHER).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const eigenes = url.origin === self.location.origin && !url.pathname.endsWith("sw.js");
  const bibliothek = req.url === BIBLIOTHEK;
  // Alles andere — allen voran die Supabase-Abfragen — läuft unberührt
  // durch. Zwischengespeicherte Termine wären sonst doppelt gehalten und
  // könnten veraltet ausgeliefert werden.
  if (!eigenes && !bibliothek) return;

  if (bibliothek) {
    // Feste Version: aus dem Speicher bedienen, im Hintergrund auffrischen.
    e.respondWith((async () => {
      const c = await caches.open(SPEICHER);
      const treffer = await c.match(req);
      const ausDemNetz = fetch(req)
        .then((a) => { if (a && a.ok) c.put(req, a.clone()); return a; })
        .catch(() => null);
      return treffer || (await ausDemNetz) || new Response("", { status: 504 });
    })());
    return;
  }

  // Eigene Dateien: immer zuerst aus dem Netz, damit eine neu hochgeladene
  // Fassung sofort ankommt. Der Speicher ist nur die Rückfalllösung.
  e.respondWith((async () => {
    const c = await caches.open(SPEICHER);
    try {
      const antwort = await fetch(req);
      if (antwort && antwort.ok) c.put(req, antwort.clone());
      return antwort;
    } catch (_) {
      const treffer = (await c.match(req)) || (await c.match("./index.html")) || (await c.match("./"));
      return treffer || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
  })());
});

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
