/** Trusted event wiring. Keeps executable code out of HTML attributes for CSP. */
(function () {
  function report(error) {
    console.error(error);
    UI.toast(error?.message || "The requested action failed.", "err");
  }

  function livePhone(input) {
    const feedback = document.getElementById(input.dataset.phoneFeedback);
    if (!feedback) return;
    const value = input.value.trim();
    if (!value) {
      feedback.style.display = "none";
      input.style.borderColor = "";
      return;
    }
    const result = Phone.validate(value);
    feedback.textContent = result.msg;
    feedback.style.display = "block";
    feedback.className = "phone-fb " + (result.ok ? "phone-ok" : "phone-err");
    input.style.borderColor = result.ok ? "#059669" : "#dc2626";
  }

  const actions = {
    "close-modal": element => UI.closeModal(element.dataset.target),
    "open-modal": element => UI.openModal(element.dataset.target),
    go: element => App.go(element.dataset.page),
    login: () => Auth.login(UI.val("loginEmail"), UI.val("loginPass")),
    register: () => Auth.register(),
    logout: () => Auth.logout(),
    "pick-role": element => Auth.pickRole(element, element.dataset.role),
    "switch-tab": element => App.switchTab(element, element.dataset.tab),
    "demo-view": () => demoView(),
    whatsapp: element => doWA(element.dataset.recipient),
    sms: element => doSMS(element.dataset.recipient),
    call: element => callNum(element.dataset.recipient),
    "open-location": () => Location.open(),
    "copy-location": () => Location.copy(),
    "download-qr": () => Patient.dlQR(),
    "copy-qr": () => Patient.copyQR(),
    "print-card": () => printCard(),
    "rotate-token": () => Patient.rotateEmergencyToken(),
    "save-profile": () => Patient.saveProfile(),
    "save-patient": () => Hospital.save(),
    "biometric-start": () => BiometricEmergency.start(),
    "staff-view": element => App.loadStaffEmergencyView(element.dataset.patientId),
    "hospital-edit": element => Hospital.openEdit(element.dataset.patientId),
    "call-direct": element => callDirect(element.dataset.phone)
  };

  document.addEventListener("click", event => {
    const element = event.target.closest("[data-action]");
    if (!element) return;
    const action = actions[element.dataset.action];
    if (!action) return;
    event.preventDefault();
    try {
      const result = action(element);
      if (result?.catch) result.catch(report);
    } catch (error) { report(error); }
  });

  document.addEventListener("input", event => {
    if (event.target.matches("[data-phone-feedback]")) livePhone(event.target);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Enter" && event.target.id === "loginPass") {
      event.preventDefault();
      Auth.login(UI.val("loginEmail"), UI.val("loginPass")).catch(report);
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    Theme.init();
    UI.initModals();
    App.init();
    if ("serviceWorker" in navigator && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname))) {
      navigator.serviceWorker.register("./sw.js").catch(error => console.warn("Offline shell unavailable:", error.message));
    }
  });
})();
