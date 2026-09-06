/** Fresh high-accuracy GPS capture and precise Google Maps links. */
const Location = (() => {
  const TARGET_ACCURACY_METRES = 30;
  const ACCEPTABLE_ACCURACY_METRES = 100;
  const CAPTURE_TIMEOUT_MS = 10000;
  const SETTLE_AFTER_MS = 2500;
  const MAX_READING_AGE_MS = 30000;
  let latest = null;

  function report(message, state = "info") {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return;
    document.querySelectorAll("[data-location-status]").forEach(element => {
      element.textContent = message;
      element.className = `location-status location-${state}`;
      element.setAttribute("role", state === "error" ? "alert" : "status");
    });
  }

  function describe(location) {
    const accuracy = location.accuracy > 0 ? `±${location.accuracy} m` : "accuracy unavailable";
    const quality = location.accuracy > ACCEPTABLE_ACCURACY_METRES ? "Low accuracy" : "GPS ready";
    return `${quality}: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)} (${accuracy}) · ${new Date(location.capturedAt).toLocaleTimeString("en-IN")}`;
  }

  function normalize(position) {
    const receivedAt = Date.now();
    const sourceAt = Number(position.timestamp) || receivedAt;
    return {
      lat: Number(position.coords.latitude),
      lng: Number(position.coords.longitude),
      accuracy: Math.round(Number(position.coords.accuracy) || 0),
      capturedAt: sourceAt,
      ageMs: Math.max(0, receivedAt - sourceAt)
    };
  }

  function validReading(reading) {
    return Number.isFinite(reading.lat) && reading.lat >= -90 && reading.lat <= 90
      && Number.isFinite(reading.lng) && reading.lng >= -180 && reading.lng <= 180
      && reading.ageMs <= MAX_READING_AGE_MS;
  }

  function errorMessage(error) {
    return ({
      1: "Location permission was denied. Allow precise location for this site.",
      2: "An accurate location is currently unavailable. Turn on GPS and retry.",
      3: "Location capture timed out. Move near a window or outdoors and retry."
    })[error?.code] || error?.message || "GEDIC could not capture the current location.";
  }

  async function permissionState() {
    try {
      if (!navigator.permissions?.query) return "unknown";
      return (await navigator.permissions.query({ name: "geolocation" })).state;
    } catch { return "unknown"; }
  }

  function get() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        report("Location is not supported by this browser.", "error");
        reject(new Error("This browser does not support geolocation."));
        return;
      }

      report("Requesting precise location permission…", "working");
      let best = null;
      let settled = false;
      let watchId;
      let settleTimer;
      const finish = (result, error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(settleTimer);
        if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
        if (result) {
          latest = result;
          report(describe(result), result.accuracy > ACCEPTABLE_ACCURACY_METRES ? "warning" : "success");
          resolve(result);
        } else {
          report(errorMessage(error), "error");
          reject(error);
        }
      };

      const timer = setTimeout(() => {
        if (best) finish(best);
        else finish(null, new Error("Location capture timed out. Turn on GPS and allow precise location."));
      }, CAPTURE_TIMEOUT_MS);

      watchId = navigator.geolocation.watchPosition(position => {
        const reading = normalize(position);
        if (!validReading(reading)) {
          report("The device returned an invalid or stale position. Waiting for a fresh GPS reading…", "warning");
          return;
        }
        if (!best || reading.accuracy < best.accuracy) best = reading;
        report(`GPS found ${reading.lat.toFixed(6)}, ${reading.lng.toFixed(6)} (±${reading.accuracy || "?"} m). Improving accuracy…`, "working");
        if (reading.accuracy > 0 && reading.accuracy <= TARGET_ACCURACY_METRES) finish(reading);
        else if (!settleTimer) {
          settleTimer = setTimeout(() => {
            if (best?.accuracy > 0 && best.accuracy <= ACCEPTABLE_ACCURACY_METRES) finish(best);
          }, SETTLE_AFTER_MS);
        }
      }, error => {
        if (best) finish(best);
        else finish(null, new Error(errorMessage(error)));
      }, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: CAPTURE_TIMEOUT_MS
      });
    });
  }

  function mapsUrl(lat, lng) {
    const latitude = Number(lat).toFixed(6);
    const longitude = Number(lng).toFixed(6);
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }

  async function getLink() {
    const location = await get();
    return mapsUrl(location.lat, location.lng);
  }

  async function refreshStatus() {
    if (!window.isSecureContext) {
      report("Location requires HTTPS. Open the deployed GEDIC website.", "error");
      return "insecure";
    }
    const state = await permissionState();
    if (state === "denied") report("Location blocked. Allow Location in this site's browser settings, then retry.", "error");
    else if (state === "granted" && latest) report(describe(latest), "success");
    else if (state === "granted") report("Location permission allowed. Tap a GPS action to capture a fresh position.", "success");
    else report("Location permission not decided. Your browser will ask when you tap a GPS action.", "info");
    return state;
  }

  function legacyCopy(text) {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    let copied = false;
    try { copied = document.execCommand?.("copy") === true; }
    finally { field.remove(); }
    return copied;
  }

  async function open() {
    try {
      UI.toast("Finding the most accurate GPS position…", "info");
      const location = await get();
      const url = mapsUrl(location.lat, location.lng);
      const accuracy = location.accuracy ? ` (approximately ±${location.accuracy} m)` : "";
      UI.toast(`Current location pinned${accuracy}.`, "ok");
      // Same-tab navigation is reliable after an asynchronous permission/GPS
      // wait; opening a blank child first can leave an unusable blank tab.
      window.location.assign(url);
      return url;
    } catch (error) {
      const state = await permissionState();
      const help = state === "denied" ? " Open the browser site settings, allow Location, then retry." : "";
      UI.toast(errorMessage(error) + help, "err");
    }
  }

  async function copy() {
    try {
      UI.toast("Capturing fresh GPS coordinates…", "info");
      const location = await get();
      const link = mapsUrl(location.lat, location.lng);
      let copied = false;
      try {
        if (window.isSecureContext && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(link);
          copied = true;
        }
      } catch { /* Fall back for browsers that expire click permission while GPS resolves. */ }
      if (!copied) copied = legacyCopy(link);
      if (!copied) {
        window.prompt("Copy this current-location link:", link);
        UI.toast("Clipboard access was blocked. Copy the map link from the dialog.", "info");
        return link;
      }
      const accuracy = location.accuracy ? ` Accuracy approximately ±${location.accuracy} m.` : "";
      UI.toast(`Exact map link copied.${accuracy}`, "ok");
      report(`Google Maps link copied · ${describe(location)}`, location.accuracy > ACCEPTABLE_ACCURACY_METRES ? "warning" : "success");
      return link;
    } catch (error) {
      const state = await permissionState();
      const help = state === "denied" ? " Open the browser site settings, allow Location, then retry." : "";
      UI.toast(errorMessage(error) + help, "err");
    }
  }

  return { get, getLink, mapsUrl, open, copy, permissionState, refreshStatus, describe, get latest() { return latest; } };
})();
