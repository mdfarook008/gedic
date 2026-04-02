/**
 * firebase-config.js
 * ─────────────────────────────────────────
 * GEDIC — Firebase Configuration & Init
 * Replace the values below with YOUR project
 * from console.firebase.google.com
 * ─────────────────────────────────────────
 */

const firebaseConfig = {
  apiKey: "AIzaSyCKbfIeP1XaRmQWvbDZ1wfD7wYydy4pHjw",
  authDomain: "gedic-webapp.firebaseapp.com",
  projectId: "gedic-webapp",
  storageBucket: "gedic-webapp.firebasestorage.app",
  messagingSenderId: "1091050383531",
  appId: "1:1091050383531:web:64701727f97e8b88b9afee",
  measurementId: "G-XLNY3YN432"
};

// ── Detect if config is placeholder ──────
const IS_DEMO = firebaseConfig.apiKey.includes("DEMO_REPLACE");

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
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _auth = firebase.auth();
    _db   = firebase.firestore();
    return { auth: _auth, db: _db, demo: false };
  } catch (e) {
    console.warn("Firebase init failed:", e.message);
    return { auth: null, db: null, demo: true };
  }
}
