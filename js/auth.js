/** Authentication and account onboarding for Firebase and local demo mode. */
const Auth = (() => {
  const DEMO_EMAILS = new Set([
    "patient@gedic.app",
    "doctor@gedic.app",
    "hospital@gedic.app"
  ]);
  let role = "patient";

  function showLoginError(message) {
    UI.showAlert("loginErr", message);
    UI.btnLoad("loginBtn", false);
  }

  async function loginLocal(email, password) {
    const result = DB.login(email, password);
    if (!result.ok) { showLoginError(result.msg); return false; }

    if (App.auth?.currentUser) {
      try { await App.auth.signOut(); } catch { /* Local demo can still continue. */ }
    }
    App.useDemoMode();
    const patient = DB.getPatientByUid(result.uid);
    const profile = patient || { role: result.role, name: result.name, email, uid: result.uid };
    const user = { email, uid: result.uid };
    App.setUser(user, result.role, profile);
    DB.saveSession(user, result.role, profile);
    UI.clearLoginForm();
    App.route();
    UI.toast("Signed in to the GEDIC demo.", "ok");
    return true;
  }

  async function login(rawEmail, password) {
    const email = rawEmail.trim().toLowerCase();
    UI.hideAlert("loginErr");
    UI.hideAlert("loginInfo");
    if (!email || !password) { showLoginError("Enter your email and password."); return; }
    UI.btnLoad("loginBtn", true);

    // Published demo credentials always use the seeded local database, even
    // when a real Firebase project is connected.
    if (DEMO_EMAILS.has(email)) {
      await loginLocal(email, password);
      return;
    }

    if (!App.firebaseAvailable) {
      await loginLocal(email, password);
      return;
    }

    App.useFirebaseMode();
    App.beginAuthFlow();
    try {
      const credential = await App.auth.signInWithEmailAndPassword(email, password);
      if (!credential.user.emailVerified) {
        let resent = true;
        try { await credential.user.sendEmailVerification(); }
        catch (error) { resent = false; console.warn("Verification email:", error.message); }
        await App.auth.signOut();
        App.endAuthFlow();
        UI.clearLoginForm();
        if (resent) UI.showAlert("loginInfo", "Verify your email before signing in. A new verification link has been sent.");
        else UI.showAlert("loginErr", "Your email is not verified and GEDIC could not resend the link. Try again shortly.");
        return;
      }
      const completed = await App.completeFirebaseLogin(credential.user);
      UI.btnLoad("loginBtn", false);
      if (completed) {
        UI.toast("Welcome back to GEDIC.", "ok");
        Notifications.send("login");
      }
    } catch (error) {
      App.endAuthFlow();
      showLoginError(UI.firebaseErr(error));
    }
  }

  function pickRole(element, nextRole) {
    document.querySelectorAll(".role-opt").forEach(option => option.classList.remove("sel"));
    element.classList.add("sel");
    role = nextRole;
    ["fPatient", "fDoctor", "fHospital"].forEach(id => {
      const section = document.getElementById(id);
      if (section) section.style.display = "none";
    });
    const visibleSection = { patient: "fPatient", doctor: "fDoctor", hospital: "fHospital" }[nextRole];
    if (visibleSection) document.getElementById(visibleSection).style.display = "block";
  }

  function buildProfile(email) {
    const accountPhoneRaw = UI.val("regPhone");
    if (accountPhoneRaw) {
      const result = Phone.validate(accountPhoneRaw);
      if (!result.ok) throw new Error(`Account mobile: ${result.msg}`);
    }

    const profile = {
      role,
      email,
      accountPhone: accountPhoneRaw ? Phone.clean(accountPhoneRaw) : "",
      createdAt: Date.now()
    };

    if (role === "patient") {
      if (!UI.val("rName")) throw new Error("Please enter your full name.");
      const emergencyPhone = UI.val("rEPhone");
      const doctorPhone = UI.val("rDPhone");
      if (emergencyPhone && !Phone.validate(emergencyPhone).ok) throw new Error(`Emergency phone: ${Phone.validate(emergencyPhone).msg}`);
      if (doctorPhone && !Phone.validate(doctorPhone).ok) throw new Error(`Doctor phone: ${Phone.validate(doctorPhone).msg}`);
      Object.assign(profile, {
        name: UI.val("rName"), age: UI.val("rAge"), blood: UI.val("rBlood"),
        diseases: UI.val("rDis"), allergies: UI.val("rAll"), medicines: UI.val("rMed"),
        emergencyName: UI.val("rEName"), emergencyContact: emergencyPhone ? Phone.clean(emergencyPhone) : "",
        doctorName: UI.val("rDName"), doctorPhone: doctorPhone ? Phone.clean(doctorPhone) : "",
        hospital: UI.val("rHosp")
      });
    } else if (role === "doctor") {
      const phone = UI.val("rDocPhone");
      if (phone && !Phone.validate(phone).ok) throw new Error(`Doctor phone: ${Phone.validate(phone).msg}`);
      Object.assign(profile, {
        name: UI.val("rDocName") || email.split("@")[0], specialization: UI.val("rDocSpec"),
        hospital: UI.val("rDocHosp"), phone: phone ? Phone.clean(phone) : ""
      });
    } else if (role === "hospital") {
      const phone = UI.val("rHospPhone");
      if (phone && !Phone.validate(phone).ok) throw new Error(`Hospital phone: ${Phone.validate(phone).msg}`);
      Object.assign(profile, {
        name: UI.val("rHospName") || email.split("@")[0], location: UI.val("rHospLoc"),
        phone: phone ? Phone.clean(phone) : ""
      });
    } else {
      profile.name = email.split("@")[0];
    }
    return profile;
  }

  async function register() {
    const email = UI.val("regEmail").toLowerCase();
    const password = UI.val("regPwd");
    UI.hideAlert("regErr");
    if (!email || !password) { UI.showAlert("regErr", "Email and password are required."); return; }
    if (password.length < 6) { UI.showAlert("regErr", "Password must be at least 6 characters."); return; }

    let profile;
    try { profile = buildProfile(email); }
    catch (error) { UI.showAlert("regErr", error.message); return; }
    UI.btnLoad("regBtn", true);

    if (!App.firebaseAvailable) {
      const result = DB.register(email, password, role, profile);
      if (!result.ok) { UI.showAlert("regErr", result.msg); UI.btnLoad("regBtn", false); return; }
      profile.uid = result.uid;
      const user = { email, uid: result.uid };
      App.useDemoMode();
      App.setUser(user, role, profile);
      DB.saveSession(user, role, profile);
      UI.clearRegistrationForm();
      App.route();
      UI.toast("Demo account created in this browser.", "ok");
      return;
    }

    App.useFirebaseMode();
    App.beginAuthFlow();
    let createdUser = null;
    try {
      const credential = await App.auth.createUserWithEmailAndPassword(email, password);
      createdUser = credential.user;
      const uid = createdUser.uid;
      profile.uid = uid;

      await App.db.collection("users").doc(uid).set(profile);
      if (role === "patient") {
        const patientRef = await App.db.collection("patients").add(profile);
        await App.db.collection("users").doc(uid).update({ patientDocId: patientRef.id });
        try { await App.fbSyncPublicProfile(uid, profile); }
        catch (error) { console.warn("Public QR profile will sync after Firestore rules are deployed:", error.message); }
      }

      let verificationSent = true;
      try { await createdUser.sendEmailVerification(); }
      catch (error) { verificationSent = false; console.warn("Verification email:", error.message); }
      await Notifications.send("signup");
      await App.auth.signOut();
      App.setUser(null, null, null);
      App.endAuthFlow();
      UI.clearRegistrationForm();
      App.go("pg-login");
      if (verificationSent) {
        UI.showAlert("loginInfo", "Account created. Open the verification link sent to your email, then sign in.");
        UI.toast("Verification email sent.", "ok");
      } else {
        UI.showAlert("loginErr", "Account created, but the verification email could not be sent. Try signing in to resend it.");
      }
    } catch (error) {
      App.endAuthFlow();
      // Avoid leaving an unusable Authentication account if profile setup failed.
      if (createdUser) {
        try { await createdUser.delete(); } catch { /* Report the original setup error. */ }
      }
      UI.showAlert("regErr", UI.firebaseErr(error));
      UI.btnLoad("regBtn", false);
    }
  }

  async function logout() {
    DB.clearSession();
    if (App.auth?.currentUser) {
      try { await App.auth.signOut(); } catch { /* Local state is still cleared. */ }
    }
    App.setUser(null, null, null);
    App.go("pg-land");
    UI.toast("Logged out securely.", "info");
  }

  return { login, register, logout, pickRole };
})();
