/**
 * location.js
 * ─────────────────────────────────────────
 * GEDIC — GPS Location Module
 * ─────────────────────────────────────────
 */

const Location = (() => {
  let cached = null;

  function get() {
    return new Promise((res, rej) => {
      if (cached) return res(cached);
      if (!navigator.geolocation) return rej(new Error("Geolocation not supported."));
      navigator.geolocation.getCurrentPosition(
        p  => { cached = { lat: p.coords.latitude, lng: p.coords.longitude }; res(cached); },
        err => {
          const msgs = { 1: "Location permission denied.", 2: "Location unavailable.", 3: "Location timed out." };
          rej(new Error(msgs[err.code] || "Could not get location."));
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    });
  }

  function mapsUrl(lat, lng) { return `https://maps.google.com/?q=${lat},${lng}`; }

  async function getLink() {
    try { const l = await get(); return mapsUrl(l.lat, l.lng); }
    catch { return "https://maps.google.com/"; }
  }

  async function open() {
    try { const l = await get(); window.open(mapsUrl(l.lat, l.lng), "_blank"); }
    catch (e) { UI.toast("📍 " + e.message, "err"); }
  }

  async function copy() {
    const link = await getLink();
    try { await navigator.clipboard.writeText(link); UI.toast("📍 Location link copied!", "ok"); }
    catch { prompt("Copy location link:", link); }
  }

  return { get, getLink, open, copy };
})();
