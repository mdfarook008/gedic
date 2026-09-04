/**
 * Cardless emergency identification.
 *
 * A browser cannot read or compare a patient's fingerprint. In production a
 * certified scanner captures it and returns a signed, short-lived token bound
 * to a server nonce. GEDIC receives no image or biometric template.
 */
const BiometricEmergency = (() => {
  let busy = false;

  const element = id => document.getElementById(id);
  const setStatus = (message, state = "info") => {
    const box = element("bioStatus");
    if (!box) return;
    box.textContent = message;
    box.className = `bio-status bio-${state}`;
    box.hidden = false;
  };

  function incidentDetails() {
    return {
      incidentRef: (element("bioIncident")?.value || "").trim(),
      reason: (element("bioReason")?.value || "").trim()
    };
  }

  function validate(details) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_./-]{3,39}$/.test(details.incidentRef)) {
      throw new Error("Enter a 4–40 character incident reference (letters, numbers, /, . or -).");
    }
    if (details.reason.length < 12 || details.reason.length > 240) {
      throw new Error("Explain the emergency reason in 12–240 characters.");
    }
    if (!element("bioAttest")?.checked) {
      throw new Error("Confirm that this is a genuine emergency and access will be audited.");
    }
  }

  async function demoMatch(details) {
    setStatus("Demo scanner: checking liveness and matching an encrypted template…");
    await new Promise(resolve => setTimeout(resolve, 900));
    const profile = DB.getAllPatients()[0];
    if (!profile) throw new Error("No enrolled demo patient is available.");
    const audit = DB.recordEmergencyAccess({
      actorUid: App.user?.uid,
      actorRole: App.role,
      patientUid: profile.uid,
      reason: details.reason,
      incidentRef: details.incidentRef,
      method: "simulated-biometric"
    });
    setStatus("Demo match accepted. Minimum emergency record released and audit event stored.", "ok");
    Emergency.render(profile, profile.uid, { mode: "biometric", auditId: audit.id });
    setTimeout(() => App.go("pg-emergency"), 450);
  }

  async function productionMatch(details) {
    if (!GEDIC_FEATURES.biometricEmergencyAccess) {
      throw new Error("Production biometric access is disabled until App Check, Cloud Functions, and a certified scanner gateway are configured.");
    }
    if (!window.GEDIC_SCANNER?.capture) {
      throw new Error("No approved scanner bridge was detected. Connect the registered emergency scanner.");
    }

    const functions = firebase.app().functions("us-central1");
    setStatus("Requesting a one-time, responder-bound scan challenge…");
    const challengeResult = await functions.httpsCallable("createBiometricChallenge")(details);
    const challenge = challengeResult.data;

    setStatus("Scanner active. Follow the device prompt; raw biometrics remain inside the scanner service.");
    const capture = await window.GEDIC_SCANNER.capture({
      challengeId: challenge.challengeId,
      nonce: challenge.nonce,
      expiresAt: challenge.expiresAt
    });
    if (!capture?.signedCaptureToken) throw new Error("The scanner did not return a signed capture token.");

    setStatus("Verifying liveness, signature, one-time nonce, and biometric match…");
    const matchResult = await functions.httpsCallable("resolveBiometricEmergency")({
      ...details,
      challengeId: challenge.challengeId,
      signedCaptureToken: capture.signedCaptureToken
    });
    const result = matchResult.data;
    setStatus("Verified match. Minimum emergency record released and access logged.", "ok");
    Emergency.render(result.profile, null, { mode: "biometric", auditId: result.auditId });
    setTimeout(() => App.go("pg-emergency"), 450);
  }

  async function start() {
    if (busy) return;
    const button = element("bioStart");
    try {
      const details = incidentDetails();
      validate(details);
      busy = true;
      if (button) button.disabled = true;
      if (App.DEMO) await demoMatch(details);
      else await productionMatch(details);
    } catch (error) {
      setStatus(error.message || "Emergency identification failed.", "err");
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  }

  function configure() {
    const button = element("bioStart");
    if (!button) return;
    const productionUnavailable = !App.DEMO && !GEDIC_FEATURES.biometricEmergencyAccess;
    button.disabled = productionUnavailable;
    if (productionUnavailable) {
      setStatus("Real biometric identification is unavailable in the free Spark deployment. Use the patient's revocable QR or normal clinical identity procedures.", "err");
    }
  }

  return { start, configure };
})();
