/**
 * app.js
 * ─────────────────────────────────────────
 * GEDIC — Main App Controller
 * Handles routing, state, init, and startup.
 * This is the ONLY script that touches the
 * loading screen and page navigation.
 * ─────────────────────────────────────────
 *
 * FIX FOR STUCK LOADING (file:// and Vercel):
 * ─────────────────────────────────────────
 * Problem: Firebase scripts are loaded with <script src="...">
 * but on file:// they may not be available at DOMContentLoaded.
 * Solution: We use a polling approach — check every 100ms if
 * firebase is defined, with a 4s hard timeout to demo mode.
 */

const App = (() => {
  // ── Public state ─────────────────────
  let auth    = null;
  let db      = null;
  let DEMO    = true;
  let user    = null;
  let role    = null;
  let profile = null;

  function setUser(u, r, p) { user = u; role = r; profile = p; }

  // ── Page navigation ──────────────────
  function go(pageId) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const el = document.getElementById(pageId);
    if (el) el.classList.add("active");
  }

  function switchTab(btn, paneId) {
    const dash = btn.closest(".dash");
    if (!dash) return;
    dash.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    dash.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    const pane = document.getElementById(paneId);
    if (pane) pane.classList.add("active");
  }

  // ── Routing ──────────────────────────
  function route() {
    if (!role) { go("pg-land"); return; }
    if (role === "patient")   { Patient.load();   go("pg-patient");   return; }
    if (role === "doctor")    { Doctor.load();    go("pg-doctor");    return; }
    if (role === "hospital")  { Hospital.load();  go("pg-hospital");  return; }
    if (role === "responder") {                   go("pg-responder"); return; }
    go("pg-land");
  }

  // ── Firebase data helpers ─────────────
  async function fbLoadUserRole(uid) {
    try {
      const snap = await db.collection("users").doc(uid).get();
      if (snap.exists) { role = snap.data().role; profile = snap.data(); }
    } catch (e) { console.error("fbLoadUserRole:", e); }
  }

  async function fbFetchPatients() {
    try {
      const snap = await db.collection("patients").orderBy("createdAt", "desc").get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { UI.toast("Error loading patients: " + e.message, "err"); return []; }
  }

  // ── Emergency view (public QR scan) ──
  async function loadEmergencyView(uid) {
    go("pg-emergency");
    let p = null;

    if (DEMO) {
      p = DB.getPatientByUid(uid);
    } else {
      try {
        const ud = await db.collection("users").doc(uid).get();
        if (ud.exists && ud.data().role === "patient") p = ud.data();
        if (!p) {
          const sn = await db.collection("patients").where("uid","==",uid).limit(1).get();
          if (!sn.empty) p = { id: sn.docs[0].id, ...sn.docs[0].data() };
        }
      } catch (e) { console.error(e); }
    }

    Emergency.render(p, uid);
  }

  // ── Startup ──────────────────────────
  function _startDemo() {
    DEMO = true;
    DB.seed();
    UI.setLoaderMsg("Demo mode — Firebase not connected");
    _bootCheck();
  }

  function _bootCheck() {
    // Check ?view= param for emergency QR scan
    const viewId = new URLSearchParams(location.search).get("view");
    if (viewId) {
      UI.hideLoader();
      loadEmergencyView(viewId);
      return;
    }

    if (DEMO) {
      const sess = DB.loadSession();
      if (sess) {
        try {
          user    = sess.user;
          role    = sess.role;
          profile = sess.profile;
          UI.hideLoader();
          route();
        } catch (e) {
          DB.clearSession();
          UI.hideLoader();
          go("pg-land");
        }
      } else {
        UI.hideLoader();
        go("pg-land");
      }
    }
    // Firebase mode handled by onAuthStateChanged below
  }

  /**
   * Main init — polls for Firebase SDK availability.
   * Works for both file:// and https:// deployments.
   */
  function init() {
    DB.seed();

    // Determine if placeholder config
    const isPlaceholder = (typeof FIREBASE_CONFIG !== "undefined") && FIREBASE_CONFIG.apiKey.includes("DEMO_REPLACE");

    if (isPlaceholder) {
      _startDemo();
      return;
    }

    let attempts = 0;
    const MAX_ATTEMPTS = 40; // 40 × 100ms = 4 seconds max

    UI.setLoaderMsg("Loading Firebase SDK…");

    const poll = setInterval(() => {
      attempts++;

      // Firebase SDK is available
      if (typeof firebase !== "undefined") {
        clearInterval(poll);
        try {
          if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
          auth = firebase.auth();
          db   = firebase.firestore();
          DEMO = false;
          UI.setLoaderMsg("Checking login…");

          const viewId = new URLSearchParams(location.search).get("view");
          if (viewId) {
            UI.hideLoader();
            loadEmergencyView(viewId);
            return;
          }

          // Firebase auth state listener
          auth.onAuthStateChanged(async fbUser => {
            if (fbUser) {
              user = fbUser;
              await fbLoadUserRole(fbUser.uid);
              UI.hideLoader();
              route();
            } else {
              UI.hideLoader();
              go("pg-land");
            }
          });

        } catch (e) {
          console.warn("Firebase init error:", e.message);
          _startDemo();
        }
        return;
      }

      // Timeout — switch to demo
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(poll);
        console.warn("Firebase SDK not loaded after 4s — demo mode");
        _startDemo();
      }
    }, 100);
  }

  // ── Expose ───────────────────────────
  return {
    get auth()    { return auth; },
    get db()      { return db; },
    get DEMO()    { return DEMO; },
    get user()    { return user; },
    get role()    { return role; },
    get profile() { return profile; },
    setUser, go, switchTab, route,
    fbFetchPatients, loadEmergencyView,
    init
  };
})();

// ── Global convenience wrappers (called from HTML onclick) ──
function go(id)           { App.go(id); }
function switchTab(b, id) { App.switchTab(b, id); }
function doLogin()        { Auth.login(UI.val("loginEmail"), UI.val("loginPass")); }
function doRegister()     { Auth.register(); }
function doLogout()       { Auth.logout(); }
function pickRole(el, r)  { Auth.pickRole(el, r); }
function openMod(id)      { UI.openModal(id); }
function closeModal(id)   { UI.closeModal(id); }
function openLoc()        { Location.open(); }
function copyLoc()        { Location.copy(); }
function doWA(t)          { const p = Emergency._active || App.profile; if(p) { closeModal("modWA"); UI.toast("Opening WhatsApp…","info"); WA.send(p,t); } }
function doSMS(t)         { const p = Emergency._active || App.profile; if(p) { closeModal("modSMS"); UI.toast("Opening SMS…","info"); SMS.send(p,t); } }
function callNum(target)  {
  if (target === "108") { window.location.href = "tel:108"; return; }
  const p = Emergency._active || App.profile;
  if (!p) return;
  let phone = target === "family" ? p.emergencyContact : p.doctorPhone;
  if (!phone) { UI.toast("Phone number not in profile.", "err"); return; }
  window.location.href = `tel:+91${phone}`;
}
function printCard() {
  const p = App.profile;
  if (!p) { UI.toast("Load your profile first.", "err"); return; }
  PrintCard.generate(p);
}
function demoView() { App.loadEmergencyView("demo-uid-p1"); }

// ── URL helper ─────────────────────────────────────────────
// Returns the base URL of the app regardless of file:// or https://
function getBaseURL() {
  const p = location.pathname;
  // Remove the filename (index.html or anything.html) from end
  return location.origin + p.substring(0, p.lastIndexOf('/') + 1);
}

function getEmergencyURL(uid) {
  return getBaseURL() + 'index.html?view=' + encodeURIComponent(uid);
}
