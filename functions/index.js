const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createHmac, randomBytes, timingSafeEqual } = require("node:crypto");
const nodemailer = require("nodemailer");
const twilio = require("twilio");

initializeApp();

const gmailUser = defineSecret("GMAIL_USER");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");
const twilioAccountSid = defineSecret("TWILIO_ACCOUNT_SID");
const twilioAuthToken = defineSecret("TWILIO_AUTH_TOKEN");
const twilioFromNumber = defineSecret("TWILIO_FROM_NUMBER");
const biometricMatchUrl = defineSecret("BIOMETRIC_MATCH_URL");
const biometricApiKey = defineSecret("BIOMETRIC_API_KEY");
const biometricSigningKey = defineSecret("BIOMETRIC_GATEWAY_SIGNING_KEY");
const biometricMinConfidence = defineString("BIOMETRIC_MIN_CONFIDENCE", { default: "0.92" });

const LOGIN_COOLDOWN_MS = 5 * 60 * 1000;
const CHALLENGE_LIFETIME_MS = 2 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_CHALLENGES_PER_WINDOW = 5;
const EMERGENCY_ROLES = new Set(["doctor", "hospital", "responder"]);
const EMERGENCY_FIELDS = [
  "name", "dateOfBirth", "age", "blood", "hospital", "diseases", "allergies",
  "medicines", "emergencyName", "emergencyContact", "doctorName", "doctorPhone",
  "updatedAt", "dataStatus"
];

function cleanName(value) {
  return String(value || "GEDIC member").replace(/[<>]/g, "").slice(0, 80);
}

function indianMobile(value) {
  const digits = String(value || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

function cleanEmergencyInput(data) {
  const incidentRef = String(data?.incidentRef || "").trim();
  const reason = String(data?.reason || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_./-]{3,39}$/.test(incidentRef)) {
    throw new HttpsError("invalid-argument", "Invalid incident reference.");
  }
  if (reason.length < 12 || reason.length > 240) {
    throw new HttpsError("invalid-argument", "Emergency reason must contain 12–240 characters.");
  }
  return { incidentRef, reason };
}

async function emergencyOperator(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Responder sign-in is required.");
  if (request.auth.token.email_verified !== true) {
    throw new HttpsError("permission-denied", "A verified responder account is required.");
  }
  const snapshot = await getFirestore().collection("users").doc(request.auth.uid).get();
  const profile = snapshot.data();
  if (!snapshot.exists || !EMERGENCY_ROLES.has(profile?.role) || profile?.staffStatus !== "active"
    || !/^[A-Za-z0-9_-]{4,64}$/.test(profile?.organisationId || "")) {
    throw new HttpsError("permission-denied", "This account is not an active, verified emergency operator.");
  }
  return { uid: request.auth.uid, role: profile.role, organisationId: profile.organisationId || null };
}

function minimumEmergencyProfile(data) {
  return Object.fromEntries(EMERGENCY_FIELDS
    .filter(field => data?.[field] !== undefined)
    .map(field => [field, data[field]]));
}

function validGatewaySignature(body, supplied) {
  if (!/^[a-f0-9]{64}$/i.test(supplied || "")) return false;
  const expected = createHmac("sha256", biometricSigningKey.value()).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(supplied, "hex"));
}

exports.createBiometricChallenge = onCall({
  region: "us-central1",
  enforceAppCheck: true
}, async request => {
  const operator = await emergencyOperator(request);
  const details = cleanEmergencyInput(request.data);
  const db = getFirestore();
  const now = Date.now();
  const challengeRef = db.collection("emergencyChallenges").doc();
  const rateRef = db.collection("emergencyRateLimits").doc(operator.uid);
  const nonce = randomBytes(32).toString("base64url");

  await db.runTransaction(async transaction => {
    const rateSnapshot = await transaction.get(rateRef);
    const previous = rateSnapshot.data() || {};
    const inWindow = Number(previous.windowStartedAt || 0) > now - RATE_WINDOW_MS;
    const count = inWindow ? Number(previous.count || 0) : 0;
    if (count >= MAX_CHALLENGES_PER_WINDOW) {
      throw new HttpsError("resource-exhausted", "Emergency scan rate limit reached. Contact the security desk.");
    }
    transaction.set(rateRef, {
      windowStartedAt: inWindow ? previous.windowStartedAt : now,
      count: count + 1,
      updatedAt: FieldValue.serverTimestamp()
    });
    transaction.create(challengeRef, {
      operator,
      ...details,
      nonce,
      state: "issued",
      issuedAt: FieldValue.serverTimestamp(),
      expiresAt: now + CHALLENGE_LIFETIME_MS
    });
  });

  return { challengeId: challengeRef.id, nonce, expiresAt: now + CHALLENGE_LIFETIME_MS };
});

exports.resolveBiometricEmergency = onCall({
  region: "us-central1",
  enforceAppCheck: true,
  secrets: [biometricMatchUrl, biometricApiKey, biometricSigningKey],
  timeoutSeconds: 30
}, async request => {
  const operator = await emergencyOperator(request);
  const details = cleanEmergencyInput(request.data);
  const challengeId = String(request.data?.challengeId || "");
  const signedCaptureToken = String(request.data?.signedCaptureToken || "");
  if (!/^[A-Za-z0-9]{10,40}$/.test(challengeId) || signedCaptureToken.length < 40 || signedCaptureToken.length > 12000) {
    throw new HttpsError("invalid-argument", "Invalid scanner response.");
  }

  const db = getFirestore();
  const challengeRef = db.collection("emergencyChallenges").doc(challengeId);
  let challenge;
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(challengeRef);
    challenge = snapshot.data();
    const valid = snapshot.exists
      && challenge.state === "issued"
      && challenge.operator?.uid === operator.uid
      && challenge.incidentRef === details.incidentRef
      && challenge.reason === details.reason
      && Number(challenge.expiresAt) >= Date.now();
    if (!valid) throw new HttpsError("failed-precondition", "Challenge is expired, used, or does not belong to this responder.");
    transaction.update(challengeRef, { state: "processing", processingAt: FieldValue.serverTimestamp() });
  });

  const gatewayUrl = biometricMatchUrl.value();
  if (!/^https:\/\//i.test(gatewayUrl)) {
    await challengeRef.update({ state: "configuration-error" });
    throw new HttpsError("failed-precondition", "The biometric gateway must use HTTPS.");
  }

  let match;
  try {
    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${biometricApiKey.value()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        challengeId,
        nonce: challenge.nonce,
        signedCaptureToken,
        purpose: "emergency-medical-identification"
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`gateway HTTP ${response.status}`);
    const body = await response.text();
    if (!validGatewaySignature(body, response.headers.get("x-gedic-signature"))) throw new Error("invalid gateway response signature");
    match = JSON.parse(body);
  } catch (error) {
    await challengeRef.update({ state: "gateway-error", completedAt: FieldValue.serverTimestamp() });
    console.error("Biometric gateway failure", { challengeId, message: error.message });
    throw new HttpsError("unavailable", "The biometric verification service is unavailable.");
  }

  const matched = match?.decision === "match"
    && match?.nonce === challenge.nonce
    && /^[A-Za-z0-9_-]{10,128}$/.test(match?.patientReference || "")
    && Number(match?.confidence) >= Number(biometricMinConfidence.value());
  if (!matched) {
    const auditRef = db.collection("emergencyAccessLogs").doc();
    const rejected = db.batch();
    rejected.update(challengeRef, { state: "rejected", completedAt: FieldValue.serverTimestamp() });
    rejected.set(auditRef, {
      operator, ...details, challengeId, outcome: "rejected", method: "biometric-1-to-many",
      gatewayTransactionId: String(match?.transactionId || "").slice(0, 128),
      recordedAt: FieldValue.serverTimestamp()
    });
    await rejected.commit();
    throw new HttpsError("not-found", "No sufficiently reliable, live biometric match was found.");
  }

  const patientAccount = await db.collection("users").doc(match.patientReference).get();
  const emergencyToken = patientAccount.data()?.emergencyToken;
  const publicSnapshot = emergencyToken
    ? await db.collection("publicProfiles").doc(emergencyToken).get()
    : null;
  if (!publicSnapshot?.exists || publicSnapshot.data()?.enabled !== true) {
    await challengeRef.update({ state: "matched-profile-missing", completedAt: FieldValue.serverTimestamp() });
    throw new HttpsError("not-found", "A patient matched, but no emergency profile is available.");
  }

  const auditRef = db.collection("emergencyAccessLogs").doc();
  const accepted = db.batch();
  accepted.update(challengeRef, { state: "consumed", completedAt: FieldValue.serverTimestamp() });
  accepted.set(auditRef, {
    operator, ...details, challengeId, patientUid: match.patientReference,
    outcome: "success", method: "biometric-1-to-many",
    confidence: Number(match.confidence),
    scannerId: String(match.scannerId || "").slice(0, 128),
    gatewayTransactionId: String(match.transactionId || "").slice(0, 128),
    recordedAt: FieldValue.serverTimestamp()
  });
  await accepted.commit();

  return { profile: minimumEmergencyProfile(publicSnapshot.data()), auditId: auditRef.id };
});

exports.sendAuthNotification = onCall({
  region: "us-central1",
  secrets: [gmailUser, gmailAppPassword, twilioAccountSid, twilioAuthToken, twilioFromNumber]
}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in before requesting a notification.");

  const event = request.data?.event;
  if (!["signup", "login"].includes(event)) {
    throw new HttpsError("invalid-argument", "Notification event must be signup or login.");
  }

  const db = getFirestore();
  const uid = request.auth.uid;
  const profileSnapshot = await db.collection("users").doc(uid).get();
  if (!profileSnapshot.exists) throw new HttpsError("failed-precondition", "GEDIC profile not found.");

  const profile = profileSnapshot.data();
  const eventRef = db.collection("notificationEvents").doc(`${uid}_${event}`);
  const previous = await eventRef.get();
  const previousTime = previous.data()?.sentAt?.toMillis?.() || 0;
  const cooldown = event === "signup" ? Number.POSITIVE_INFINITY : LOGIN_COOLDOWN_MS;
  if (previous.exists && Date.now() - previousTime < cooldown) {
    return { email: false, sms: false, throttled: true };
  }

  const email = profile.email || request.auth.token.email;
  const phone = indianMobile(profile.accountPhone);
  const name = cleanName(profile.name);
  const isSignup = event === "signup";
  const subject = isSignup ? "Welcome to GEDIC" : "New sign-in to your GEDIC account";
  const message = isSignup
    ? `Welcome ${name}. Your GEDIC emergency identity account is ready. Please verify your email and review your emergency profile.`
    : `Hello ${name}. A new sign-in to your GEDIC account was recorded at ${new Date().toISOString()}. If this was not you, reset your Firebase Authentication password immediately.`;

  const deliveries = [];
  if (email) {
    const mailer = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser.value(), pass: gmailAppPassword.value() }
    });
    deliveries.push(mailer.sendMail({
      from: `GEDIC <${gmailUser.value()}>`,
      to: email,
      subject,
      text: message,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;padding:24px;color:#172033"><h2 style="color:#4f46e5">GEDIC</h2><p>${message}</p><p style="color:#65718a;font-size:12px">Global Emergency Digital Identity Card</p></div>`
    }).then(() => "email"));
  }

  if (phone) {
    const sms = twilio(twilioAccountSid.value(), twilioAuthToken.value());
    deliveries.push(sms.messages.create({ body: `GEDIC: ${message}`, from: twilioFromNumber.value(), to: phone }).then(() => "sms"));
  }

  const settled = await Promise.allSettled(deliveries);
  const delivered = settled.filter(result => result.status === "fulfilled").map(result => result.value);
  const failures = settled.filter(result => result.status === "rejected");
  if (!delivered.length && failures.length) {
    console.error("All GEDIC notification providers failed", failures.map(result => result.reason?.message));
    throw new HttpsError("unavailable", "Notification providers are currently unavailable.");
  }

  await eventRef.set({ sentAt: FieldValue.serverTimestamp(), event, channels: delivered }, { merge: true });
  return { email: delivered.includes("email"), sms: delivered.includes("sms") };
});
