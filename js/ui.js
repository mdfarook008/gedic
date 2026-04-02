/**
 * ui.js
 * ─────────────────────────────────────────
 * GEDIC — Shared UI Helpers
 * Toast, modals, tabs, loading screen, etc.
 * ─────────────────────────────────────────
 */

const UI = (() => {

  // ── Toast ────────────────────────────
  let _toastTimer;
  function toast(msg, type = "info") {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.className   = `toast toast-${type} show`;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.remove("show"), 3400);
  }

  // ── Alerts ───────────────────────────
  function showAlert(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent   = msg;
    el.style.display = "block";
  }
  function hideAlert(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  }

  // ── Modals ───────────────────────────
  function openModal(id)  { document.getElementById(id)?.classList.add("open"); }
  function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }

  function initModals() {
    document.querySelectorAll(".overlay").forEach(m => {
      m.addEventListener("click", e => { if (e.target === m) m.classList.remove("open"); });
    });
  }

  // ── Button loading state ─────────────
  function btnLoad(id, on) {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (on) {
      btn._saved   = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Please wait…';
      btn.disabled  = true;
    } else {
      btn.innerHTML = btn._saved || "Submit";
      btn.disabled  = false;
    }
  }

  // ── Value getter ─────────────────────
  function val(id) { return (document.getElementById(id)?.value || "").trim(); }

  // ── Inner text setter ─────────────────
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || "—";
  }

  // ── Truncate ─────────────────────────
  function trunc(str, n) {
    if (!str) return "—";
    return str.length > n ? str.slice(0, n) + "…" : str;
  }

  // ── Loading screen ───────────────────
  function hideLoader(msg) {
    const ls = document.getElementById("loadScreen");
    if (!ls) return;
    if (msg) {
      const sub = document.getElementById("loadSub");
      if (sub) sub.textContent = msg;
    }
    setTimeout(() => {
      ls.style.opacity = "0";
      setTimeout(() => { ls.style.display = "none"; }, 380);
    }, 200);
  }

  function setLoaderMsg(msg) {
    const sub = document.getElementById("loadSub");
    if (sub) sub.textContent = msg;
  }

  // ── Firebase error messages ──────────
  function firebaseErr(e) {
    const map = {
      "auth/user-not-found":        "No account found with this email.",
      "auth/wrong-password":        "Incorrect password.",
      "auth/email-already-in-use":  "Email already registered. Please sign in.",
      "auth/weak-password":         "Password must be at least 6 characters.",
      "auth/invalid-email":         "Invalid email address.",
      "auth/too-many-requests":     "Too many attempts. Please wait a moment.",
      "auth/network-request-failed":"Network error. Check your connection.",
      "auth/invalid-credential":    "Invalid email or password.",
      "auth/operation-not-allowed": "Email/password auth not enabled in Firebase.",
    };
    return map[e.code] || e.message;
  }

  return { toast, showAlert, hideAlert, openModal, closeModal, initModals, btnLoad, val, setText, trunc, hideLoader, setLoaderMsg, firebaseErr };
})();
