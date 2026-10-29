/* 任务笔记工作台 - Service Worker（外壳缓存；api.github.com 一律不缓存） */
const CACHE = "lwb-shell-v1";
const SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/util.js",
  "./js/commit.js",
  "./js/seed.js",
  "./js/model.js",
  "./js/store.js",
  "./js/pwa.js",
  "./js/app.js",
  "./js/views/focus.js",
  "./js/views/tree.js",
  "./js/views/timeline.js",
  "./js/views/journal.js",
  "./js/views/more.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  /* 数据 API：不缓存、直接放行（数据一致性由 localStorage 快照负责） */
  if (url.hostname === "api.github.com") return;

  if (req.mode === "navigate") {
    /* 导航：网络优先，离线回退缓存外壳 */
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put("./index.html", copy)).catch(() => {});
        return res;
      }).catch(() =>
        caches.match("./index.html").then((r) => r || caches.match("./"))
      )
    );
    return;
  }

  /* 同源静态资源：stale-while-revalidate */
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const fetchP = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached);
        return cached || fetchP;
      })
    );
  }
});
