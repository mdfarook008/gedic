const CACHE = "gedic-shell-v7";
const SHELL = [
  "./", "./index.html", "./css/main.css", "./js/theme.js", "./js/vendor/qrcode.min.js", "./js/firebase-config.js",
  "./js/db.js", "./js/ui.js", "./js/phone.js", "./js/location.js", "./js/whatsapp.js",
  "./js/sms.js", "./js/print.js", "./js/emergency.js", "./js/biometric.js",
  "./js/patient.js", "./js/doctor.js", "./js/hospital.js", "./js/notifications.js",
  "./js/auth.js", "./js/app.js", "./js/bootstrap.js", "./js/redirect.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  // Never cache Firebase, medical API responses, QR query pages, or non-GET requests.
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.search) return;
  event.respondWith(fetch(event.request)
    .then(response => {
      if (response.ok && ["script", "style", "document"].includes(event.request.destination)) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    })
    .catch(() => caches.match(event.request).then(response => response || caches.match("./index.html"))));
});
