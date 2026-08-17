/** Shared, accessible UI helpers. */
const UI = (() => {
  let toastTimer;

  function toast(message, type = "info") {
    const element = document.getElementById("toast");
    if (!element) return;
    element.textContent = message;
    element.className = `toast toast-${type} show`;
    element.setAttribute("role", type === "err" ? "alert" : "status");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("show"), 3800);
  }

  function showAlert(id, message) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = message;
    element.style.display = "block";
    element.setAttribute("role", "alert");
  }

  function hideAlert(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = "none";
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    modal.querySelector("button, input, select, textarea")?.focus();
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    modal?.classList.remove("open");
    modal?.setAttribute("aria-hidden", "true");
  }

  function initModals() {
    document.querySelectorAll(".overlay").forEach(modal => {
      modal.setAttribute("aria-hidden", "true");
      modal.addEventListener("click", event => {
        if (event.target === modal) closeModal(modal.id);
      });
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") document.querySelectorAll(".overlay.open").forEach(modal => closeModal(modal.id));
    });
  }

  function btnLoad(id, loading) {
    const button = document.getElementById(id);
    if (!button) return;
    if (loading) {
      if (!button.dataset.label) button.dataset.label = button.innerHTML;
      button.innerHTML = '<span class="spinner" aria-hidden="true"></span> Please wait…';
      button.disabled = true;
    } else {
      if (button.dataset.label) {
        button.innerHTML = button.dataset.label;
        delete button.dataset.label;
      }
      button.disabled = false;
    }
  }

  function val(id) { return (document.getElementById(id)?.value || "").trim(); }
  function clearFields(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll("input, textarea").forEach(field => {
      field.value = "";
      field.style.borderColor = "";
    });
    container.querySelectorAll("select").forEach(field => { field.selectedIndex = 0; });
    container.querySelectorAll(".phone-fb, .alert").forEach(message => { message.style.display = "none"; });
  }
  function clearLoginForm() {
    clearFields("pg-login");
    btnLoad("loginBtn", false);
  }
  function clearRegistrationForm() {
    clearFields("pg-register");
    btnLoad("regBtn", false);
  }
  function clearAuthForms() {
    clearLoginForm();
    clearRegistrationForm();
  }
  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text || "—";
  }
  function trunc(value, length) {
    if (!value) return "—";
    return value.length > length ? `${value.slice(0, length)}…` : value;
  }
  function escape(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
  }

  function hideLoader(message) {
    const screen = document.getElementById("loadScreen");
    if (!screen) return;
    if (message) setLoaderMsg(message);
    setTimeout(() => {
      screen.style.opacity = "0";
      setTimeout(() => { screen.style.display = "none"; }, 380);
    }, 180);
  }
  function setLoaderMsg(message) { setText("loadSub", message); }

  function firebaseErr(error) {
    const messages = {
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect email or password.",
      "auth/email-already-in-use": "That email is already registered.",
      "auth/weak-password": "Use a password with at least 6 characters.",
      "auth/invalid-email": "Enter a valid email address.",
      "auth/too-many-requests": "Too many attempts. Please wait and retry.",
      "auth/network-request-failed": "Network error. Check your connection.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase."
    };
    return messages[error?.code] || error?.message || "Something went wrong.";
  }

  return { toast, showAlert, hideAlert, openModal, closeModal, initModals, btnLoad, val, clearLoginForm, clearRegistrationForm, clearAuthForms, setText, trunc, escape, hideLoader, setLoaderMsg, firebaseErr };
})();
