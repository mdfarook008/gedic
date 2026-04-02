/**
 * auth.js
 * ─────────────────────────────────────────
 * GEDIC — Authentication Module
 * Handles login, register, logout for both
 * Firebase and demo (localStorage) mode.
 * ─────────────────────────────────────────
 */

const Auth = (() => {

  // ── Login ────────────────────────────
  async function login(email, pwd) {
    UI.hideAlert("loginErr");
    if (!email || !pwd) { UI.showAlert("loginErr", "Enter email and password."); return; }
    UI.btnLoad("loginBtn", true);

    if (App.DEMO) {
      const r = DB.login(email, pwd);
      if (!r.ok) { UI.showAlert("loginErr", r.msg); UI.btnLoad("loginBtn", false); return; }

      const pat = DB.getPatientByUid(r.uid);
      App.setUser({ email, uid: r.uid }, r.role, pat || { role: r.role, name: r.name, email, uid: r.uid });
      DB.saveSession({ email, uid: r.uid }, r.role, App.profile);
      UI.btnLoad("loginBtn", false);
      App.route();
      return;
    }

    try {
      await App.auth.signInWithEmailAndPassword(email, pwd);
      // onAuthStateChanged in app.js handles the rest
    } catch (e) {
      UI.showAlert("loginErr", UI.firebaseErr(e));
      UI.btnLoad("loginBtn", false);
    }
  }

  // ── Register ─────────────────────────
  let _role = "patient";

  function pickRole(el, role) {
    document.querySelectorAll(".role-opt").forEach(r => r.classList.remove("sel"));
    el.classList.add("sel");
    _role = role;
    ["fPatient","fDoctor","fHospital"].forEach(id => {
      const f = document.getElementById(id);
      if (f) f.style.display = "none";
    });
    const show = { patient:"fPatient", doctor:"fDoctor", hospital:"fHospital" }[role];
    if (show) document.getElementById(show).style.display = "block";
  }

  async function register() {
    const email = UI.val("regEmail");
    const pwd   = UI.val("regPwd");
    UI.hideAlert("regErr");

    if (!email || !pwd) { UI.showAlert("regErr", "Email and password are required."); return; }
    if (pwd.length < 6) { UI.showAlert("regErr", "Password must be at least 6 characters."); return; }

    // Build profile object
    let profile = { role: _role, email, createdAt: Date.now() };

    if (_role === "patient") {
      if (!UI.val("rName")) { UI.showAlert("regErr", "Please enter your full name."); return; }

      const ep = UI.val("rEPhone");
      const dp = UI.val("rDPhone");
      if (ep) { const r = Phone.validate(ep); if (!r.ok) { UI.showAlert("regErr", "Emergency Phone: " + r.msg); return; } }
      if (dp) { const r = Phone.validate(dp); if (!r.ok) { UI.showAlert("regErr", "Doctor Phone: "    + r.msg); return; } }

      Object.assign(profile, {
        name:             UI.val("rName"),
        age:              UI.val("rAge"),
        blood:            UI.val("rBlood"),
        diseases:         UI.val("rDis"),
        allergies:        UI.val("rAll"),
        medicines:        UI.val("rMed"),
        emergencyName:    UI.val("rEName"),
        emergencyContact: ep ? Phone.clean(ep) : "",
        doctorName:       UI.val("rDName"),
        doctorPhone:      dp ? Phone.clean(dp) : "",
        hospital:         UI.val("rHosp"),
      });

    } else if (_role === "doctor") {
      const dp = UI.val("rDocPhone");
      if (dp) { const r = Phone.validate(dp); if (!r.ok) { UI.showAlert("regErr", "Phone: " + r.msg); return; } }
      Object.assign(profile, { name: UI.val("rDocName"), specialization: UI.val("rDocSpec"), hospital: UI.val("rDocHosp"), phone: dp ? Phone.clean(dp) : "" });

    } else if (_role === "hospital") {
      const hp = UI.val("rHospPhone");
      if (hp) { const r = Phone.validate(hp); if (!r.ok) { UI.showAlert("regErr", "Phone: " + r.msg); return; } }
      Object.assign(profile, { name: UI.val("rHospName"), location: UI.val("rHospLoc"), phone: hp ? Phone.clean(hp) : "" });

    } else {
      profile.name = email.split("@")[0];
    }

    UI.btnLoad("regBtn", true);

    if (App.DEMO) {
      const r = DB.register(email, pwd, _role, profile);
      if (!r.ok) { UI.showAlert("regErr", r.msg); UI.btnLoad("regBtn", false); return; }
      profile.uid = r.uid;
      App.setUser({ email, uid: r.uid }, _role, profile);
      DB.saveSession({ email, uid: r.uid }, _role, profile);
      UI.btnLoad("regBtn", false);
      UI.toast("✅ Account created!", "ok");
      App.route();
      return;
    }

    try {
      const cred = await App.auth.createUserWithEmailAndPassword(email, pwd);
      const uid  = cred.user.uid;
      profile.uid = uid;
      await App.db.collection("users").doc(uid).set(profile);
      if (_role === "patient") {
        const ref = await App.db.collection("patients").add(profile);
        await App.db.collection("users").doc(uid).update({ patientDocId: ref.id });
      }
      App.setUser(cred.user, _role, profile);
      UI.toast("✅ Account created!", "ok");
      App.route();
    } catch (e) {
      UI.showAlert("regErr", UI.firebaseErr(e));
      UI.btnLoad("regBtn", false);
    }
  }

  // ── Logout ───────────────────────────
  async function logout() {
    if (App.DEMO) {
      DB.clearSession();
    } else {
      try { await App.auth.signOut(); } catch (e) {}
    }
    App.setUser(null, null, null);
    App.go("pg-land");
    UI.toast("Logged out", "info");
  }

  return { login, register, logout, pickRole };
})();
