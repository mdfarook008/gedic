/** Fresh high-accuracy GPS capture and precise Google Maps links. */
const Location = (() => {
  const TARGET_ACCURACY_METRES = 25;
  const CAPTURE_TIMEOUT_MS = 12000;
  let latest = null;

  function normalize(position) {
    return {
      lat: Number(position.coords.latitude),
      lng: Number(position.coords.longitude),
      accuracy: Math.round(Number(position.coords.accuracy) || 0),
      capturedAt: Date.now()
    };
  }

  function errorMessage(error) {
    return ({
      1: "Location permission was denied. Allow precise location for this site.",
      2: "An accurate location is currently unavailable. Turn on GPS and retry.",
      3: "Location capture timed out. Move near a window or outdoors and retry."
    })[error?.code] || "GEDIC could not capture the current location.";
  }

  function get() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("This browser does not support geolocation."));
        return;
      }

      let best = null;
      let settled = false;
      let watchId;
      const finish = (result, error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
        if (result) { latest = result; resolve(result); }
        else reject(error);
      };

      const timer = setTimeout(() => {
        if (best) finish(best);
        else finish(null, new Error("Location capture timed out. Turn on GPS and allow precise location."));
      }, CAPTURE_TIMEOUT_MS);

      watchId = navigator.geolocation.watchPosition(position => {
        const reading = normalize(position);
        if (!best || reading.accuracy < best.accuracy) best = reading;
        if (reading.accuracy > 0 && reading.accuracy <= TARGET_ACCURACY_METRES) finish(reading);
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

  async function open() {
    // Open synchronously so popup blockers do not discard the map while GPS is resolving.
    const mapWindow = window.open("about:blank", "_blank");
    try {
      UI.toast("Finding the most accurate GPS position…", "info");
      const location = await get();
      const url = mapsUrl(location.lat, location.lng);
      if (mapWindow) mapWindow.location.replace(url);
      else window.location.href = url;
      const accuracy = location.accuracy ? ` (approximately ±${location.accuracy} m)` : "";
      UI.toast(`Current location pinned${accuracy}.`, "ok");
    } catch (error) {
      mapWindow?.close();
      UI.toast(error.message, "err");
    }
  }

  async function copy() {
    try {
      UI.toast("Capturing fresh GPS coordinates…", "info");
      const location = await get();
      const link = mapsUrl(location.lat, location.lng);
      await navigator.clipboard.writeText(link);
      const accuracy = location.accuracy ? ` Accuracy approximately ±${location.accuracy} m.` : "";
      UI.toast(`Exact map link copied.${accuracy}`, "ok");
    } catch (error) {
      UI.toast(error.message, "err");
    }
  }

  return { get, getLink, mapsUrl, open, copy, get latest() { return latest; } };
})();
