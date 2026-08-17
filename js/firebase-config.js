/**
 * firebase-config.js
 * ─────────────────────────────────────────
 * GEDIC — Firebase Configuration & Init
 * Replace the values below with YOUR project
 * from console.firebase.google.com
 * ─────────────────────────────────────────
 */

const FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyCKbfIeP1XaRmQWvbDZ1wfD7wYydy4pHjw",
  authDomain: "gedic-webapp.firebaseapp.com",
  projectId: "gedic-webapp",
  storageBucket: "gedic-webapp.firebasestorage.app",
  messagingSenderId: "1091050383531",
  appId: "1:1091050383531:web:64701727f97e8b88b9afee",
  measurementId: "G-XLNY3YN432"
});

// Backwards-compatible alias for older embedded GEDIC pages.
const firebaseConfig = FIREBASE_CONFIG;

// Spark-plan default. Set to true only after deploying the optional backend
// with firebase.blaze.json and configuring all Gmail/Twilio secrets.
const GEDIC_FEATURES = Object.freeze({
  cloudNotifications: false,
  // Optional no-billing login email relay. Paste the deployed Google Apps
  // Script /exec URL here after following README setup instructions.
  appsScriptNotificationUrl: "https://script.google.com/macros/s/AKfycbwbZouxQTn9p7Y_nPU1j-X3R-w5dVIm1VftbLynA7Vx7e8oV4FCGMUMbWq7V-at1rb7/exec"
});

// ── Detect if config is placeholder ──────
const IS_DEMO = FIREBASE_CONFIG.apiKey.includes("DEMO_REPLACE");

let _auth = null;
let _db   = null;

function getAuth() { return _auth; }
function getDB()   { return _db; }

/**
 * Initialise Firebase.
 * Returns { auth, db, demo } or { demo: true } if failed.
 */
function initFirebase() {
  if (IS_DEMO) return { auth: null, db: null, demo: true };
  try {
    if (typeof firebase === "undefined") throw new Error("Firebase SDK did not load.");
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _auth = firebase.auth();
    _db   = firebase.firestore();
    return { auth: _auth, db: _db, demo: false };
  } catch (e) {
    console.warn("Firebase init failed:", e.message);
    return { auth: null, db: null, demo: true };
  }
}
