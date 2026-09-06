/**
 * app.js
 * ─────────────────────────────────────────
 * GEDIC — Main App Controller
 * Handles routing, state, init, and startup.
 * This is the ONLY script that touches the
 * loading screen and page navigation.
 * ─────────────────────────────────────────
 *
 * Firebase loading is polled for four seconds. Production fails closed if
 * cloud services are unavailable; demo data is enabled only on localhost or
 * with the explicit ?demo=1 query flag.
 */

const App = (() => {
  // ── Public state ─────────────────────
  let auth    = null;
  let db      = null;
  let DEMO    = false;
  let user    = null;
  let role    = null;
  let profile = null;
  let authFlowActive = false;

  function setUser(u, r, p) { user = u; role = r; profile = p; }
  function beginAuthFlow() { authFlowActive = true; }
  function endAuthFlow() { authFlowActive = false; }
  function useDemoMode() { DEMO = true; }
  function useFirebaseMode() { if (auth && db) DEMO = false; }

  // ── Page navigation ──────────────────
  function go(pageId) {
    const currentPage = document.querySelector(".page.active")?.id;
    if (pageId === "pg-land") UI.clearAuthForms();
    if (pageId === "pg-login" && currentPage !== "pg-login") UI.clearLoginForm();
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
    if (role === "responder") { BiometricEmergency.configure?.(); go("pg-responder"); return; }
    go("pg-land");
  }

  // ── Firebase data helpers ─────────────
  async function fbLoadUserRole(uid) {
    role = null;
    profile = null;
    try {
      const snap = await db.collection("users").doc(uid).get();
      if (snap.exists) {
        const account = snap.data();
        role = account.role;
        profile = account;
        if (["doctor", "hospital", "responder"].includes(role)
          && (account.staffStatus !== "active" || typeof account.organisationId !== "string" || account.organisationId.length < 4)) {
          console.warn("Staff account is not active or has no valid organisation assignment.");
          role = null;
          profile = null;
          return false;
        }
        if (role === "patient") {
          let patientDoc = await db.collection("patients").doc(uid).get();
          if (!patientDoc.exists) {
            const legacy = await db.collection("patients").where("uid", "==", uid).limit(1).get();
            if (!legacy.empty) patientDoc = legacy.docs[0];
          }
          const medical = patientDoc.exists ? patientDoc.data() : account;
          const token = account.emergencyToken || medical.emergencyToken || createEmergencyToken();
          profile = {
            ...account,
            ...medical,
            uid,
            patientDocId: patientDoc.exists ? patientDoc.id : uid,
            emergencyToken: token,
            emergencyEnabled: medical.emergencyEnabled === true,
            dataStatus: medical.dataStatus || "self-reported"
          };
          if (!account.emergencyToken || !patientDoc.exists) {
            const batch = db.batch();
            batch.set(db.collection("users").doc(uid), { emergencyToken: token }, { merge: true });
            batch.set(db.collection("patients").doc(uid), patientRecord(profile), { merge: true });
            await batch.commit();
            profile.patientDocId = uid;
          }
          if (profile.emergencyEnabled) {
            try { await fbSyncPublicProfile(uid, profile); }
            catch (error) { console.warn("Emergency QR synchronization pending:", error.message); }
          }
        }
        return true;
      }
    } catch (e) { console.error("fbLoadUserRole:", e); }
    return false;
  }

  async function completeFirebaseLogin(fbUser) {
    user = fbUser;
    const loaded = await fbLoadUserRole(fbUser.uid);
    authFlowActive = false;
    if (!loaded) {
      go("pg-login");
      UI.showAlert("loginErr", "Your login is valid, but the GEDIC profile is missing or inaccessible. Check Firestore rules, or create a new account.");
      return false;
    }
    UI.clearLoginForm();
    route();
    return true;
  }

  async function fbFetchPatients() {
    try {
      let query = db.collection("patients");
      if (role === "hospital" && profile?.organisationId) {
        query = query.where("organisationId", "==", profile.organisationId).limit(100);
      } else if (role === "doctor" && profile?.organisationId && user?.uid) {
        query = query.where("organisationId", "==", profile.organisationId)
          .where("careTeamUids", "array-contains", user.uid).limit(100);
      } else {
        return [];
      }
      const snap = await query.get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
    } catch (e) { UI.toast("Error loading patients: " + e.message, "err"); return []; }
  }

  function createEmergencyToken() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  }

  function patientRecord(data) {
    const allowed = [
      "uid", "name", "dateOfBirth", "age", "blood", "hospital", "diseases",
      "allergies", "medicines", "emergencyName", "emergencyContact", "doctorName",
      "doctorPhone", "createdAt", "updatedAt", "dataStatus", "emergencyEnabled",
      "emergencyToken", "organisationId", "careTeamUids"
    ];
    return allowed.reduce((result, key) => {
      if (data?.[key] !== undefined) result[key] = data[key];
      return result;
    }, {});
  }

  function publicProfile(profile, uid = profile?.uid) {
    const allowed = [
      "name", "age", "blood", "hospital", "diseases", "allergies",
      "medicines", "emergencyName", "emergencyContact", "doctorName",
      "doctorPhone", "updatedAt", "dateOfBirth", "dataStatus"
    ];
    return allowed.reduce((result, key) => {
      if (profile?.[key] !== undefined) result[key] = profile[key];
      return result;
    }, { ownerUid: uid, enabled: profile?.emergencyEnabled === true });
  }

  async function fbSyncPublicProfile(uid, data) {
    if (!uid || !db) throw new Error("A patient ID and Firestore connection are required.");
    const token = data?.emergencyToken;
    if (!token) throw new Error("An emergency access token is required.");
    const ref = db.collection("publicProfiles").doc(token);
    if (data.emergencyEnabled === true) await ref.set(publicProfile(data, uid));
    else await ref.delete();
  }

  // ── Emergency view (public QR scan) ──
  async function loadEmergencyView(uid) {
    go("pg-emergency");
    let p = null;

    if (DEMO) {
      p = DB.getPatientByUid(uid)
        || DB.getAllPatients().find(patient => patient.emergencyToken === uid);
    } else {
      try {
        const publicDoc = await db.collection("publicProfiles").doc(uid).get();
        if (publicDoc.exists) p = { id: publicDoc.id, uid, ...publicDoc.data() };
      } catch (e) {
        if (e?.code === "permission-denied" || e?.code === "not-found") {
          console.info("Emergency profile was invalid, disabled, or revoked.");
        } else {
          console.error("Emergency profile lookup failed:", e);
          UI.toast("Emergency profile service is temporarily unavailable. You can still call 108 or share your location.", "err");
        }
      }
    }

    Emergency.render(p, uid, DEMO ? { mode: "demo" } : {});
  }

  function loadDemoEmergencyView() {
    DB.seed();
    go("pg-emergency");
    const patient = DB.getPatientByUid("demo-uid-p1");
    Emergency.render(patient, "demo-emergency-token-p1", { mode: "demo" });
  }

  async function loadStaffEmergencyView(patientId) {
    if (!patientId || !["doctor", "hospital"].includes(role)) {
      throw new Error("An authorised clinical account is required.");
    }
    go("pg-emergency");
    let patient = null;
    if (DEMO) patient = DB.getAllPatients().find(item => (item.id || item.uid) === patientId);
    else {
      const snapshot = await db.collection("patients").doc(patientId).get();
      if (snapshot.exists) patient = { id: snapshot.id, ...snapshot.data() };
    }
    Emergency.render(patient, patientId, { mode: "clinical" });
  }

  // ── Startup ──────────────────────────
  function _startDemo() {
    DEMO = true;
    DB.seed();
    UI.setLoaderMsg("Demo mode — Firebase not connected");
    _bootCheck();
  }

  function _startUnavailable(message) {
    DEMO = false;
    auth = null;
    db = null;
    UI.hideLoader();
    go("pg-land");
    UI.toast(message || "GEDIC is offline. Cloud medical records are unavailable; no demo data was substituted.", "err");
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
    // Determine if placeholder config
    const isPlaceholder = typeof FIREBASE_CONFIG === "undefined" || FIREBASE_CONFIG.apiKey.includes("DEMO_REPLACE");
    const params = new URLSearchParams(location.search);
    const explicitDemo = params.get("demo") === "1"
      || (["localhost", "127.0.0.1"].includes(location.hostname) && params.get("live") !== "1");

    if (isPlaceholder || explicitDemo) {
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
          const services = initFirebase();
          auth = services.auth;
          db   = services.db;
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
            if (DEMO || authFlowActive) return;
            if (fbUser) {
              if (!fbUser.emailVerified) {
                await auth.signOut();
                UI.hideLoader();
                go("pg-login");
                UI.showAlert("loginInfo", "Verify your email before signing in.");
                return;
              }
              user = fbUser;
              const loaded = await fbLoadUserRole(fbUser.uid);
              UI.hideLoader();
              if (loaded) route();
              else {
                go("pg-login");
                UI.showAlert("loginErr", "This Firebase account does not have a GEDIC profile.");
              }
            } else {
              UI.hideLoader();
              const active = document.querySelector(".page.active")?.id;
              if (!["pg-login", "pg-register"].includes(active)) go("pg-land");
            }
          });

        } catch (e) {
          console.warn("Firebase init error:", e.message);
          _startUnavailable();
        }
        return;
      }

      // Timeout — fail closed in production.
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(poll);
        console.warn("Firebase SDK not loaded after 4s");
        _startUnavailable();
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
    get firebaseAvailable() { return Boolean(auth && db); },
    setUser, beginAuthFlow, endAuthFlow, useDemoMode, useFirebaseMode, completeFirebaseLogin, go, switchTab, route,
    fbFetchPatients, fbSyncPublicProfile, createEmergencyToken, patientRecord, publicProfile, loadEmergencyView, loadDemoEmergencyView, loadStaffEmergencyView,
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
function doWA(t)          { const p = Emergency._active || App.profile; if (!p) { UI.toast("No emergency profile is loaded.", "err"); return; } closeModal("modWA"); UI.toast("Preparing location and WhatsApp message…","info"); return WA.send(p,t); }
function doSMS(t)         { const p = Emergency._active || App.profile; if (!p) { UI.toast("No emergency profile is loaded.", "err"); return; } closeModal("modSMS"); UI.toast("Preparing location and SMS message…","info"); return SMS.send(p,t); }
function callNum(target)  {
  if (target === "108") { window.location.href = "tel:108"; return; }
  const p = Emergency._active || App.profile;
  if (!p) return;
  let phone = target === "family" ? p.emergencyContact : p.doctorPhone;
  if (!phone) { UI.toast("Phone number not in profile.", "err"); return; }
  window.location.href = `tel:+91${phone}`;
}
function callDirect(value) {
  const phone = String(value || "").replace(/\D/g, "");
  if (phone === "108") { window.location.href = "tel:108"; return; }
  if (!/^[6-9]\d{9}$/.test(phone)) { UI.toast("Valid patient phone number unavailable.", "err"); return; }
  window.location.href = `tel:+91${phone}`;
}
function printCard() {
  const p = App.profile;
  if (!p) { UI.toast("Load your profile first.", "err"); return; }
  PrintCard.generate(p);
}
function demoView() { App.loadDemoEmergencyView(); }

// ── URL helper ─────────────────────────────────────────────
// Returns the base URL of the app regardless of file:// or https://
function getBaseURL() {
  const p = location.pathname;
  // Remove the filename (index.html or anything.html) from end
  return location.origin + p.substring(0, p.lastIndexOf('/') + 1);
}

function getEmergencyURL(uid) {
  const query = new URLSearchParams({ view: uid });
  const isPublishedDemo = App.DEMO && !["localhost", "127.0.0.1"].includes(location.hostname);
  if (isPublishedDemo) query.set("demo", "1");
  return getBaseURL() + 'index.html?' + query.toString();
}
