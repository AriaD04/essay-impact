// Service worker: simpan semua file game agar bisa dimainkan offline
// setelah dibuka sekali. Naikkan VERSION setiap kali file game diubah.
const VERSION = "coral-quest-v2";
const CORE = [
  "./", "index.html", "css/style.css", "manifest.webmanifest", "icons/icon.svg",
  "js/main.js", "js/engine.js", "js/models.js", "js/data.js", "js/ui.js", "js/i18n.js", "js/audio.js", "js/creatures.js",
  "js/levels/common.js", "js/levels/l1.js", "js/levels/l2.js", "js/levels/l3.js", "js/levels/l4.js", "js/levels/sim.js",
  "js/vendor/three.module.js",
  "js/vendor/addons/loaders/GLTFLoader.js", "js/vendor/addons/loaders/DRACOLoader.js",
  "js/vendor/addons/controls/OrbitControls.js", "js/vendor/addons/utils/BufferGeometryUtils.js", "js/vendor/addons/utils/SkeletonUtils.js",
  "js/vendor/addons/libs/draco/draco_decoder.js", "js/vendor/addons/libs/draco/draco_decoder.wasm", "js/vendor/addons/libs/draco/draco_wasm_wrapper.js",
];
self.addEventListener("install", (e) => e.waitUntil(caches.open(VERSION).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" && e.request.method !== "HEAD") return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    // model .glb juga disimpan setelah pertama kali dimuat
    if (res.ok && e.request.method === "GET" && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return res;
  })));
});
