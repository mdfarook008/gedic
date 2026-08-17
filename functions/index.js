const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const twilio = require("twilio");

initializeApp();

const gmailUser = defineSecret("GMAIL_USER");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");
const twilioAccountSid = defineSecret("TWILIO_ACCOUNT_SID");
const twilioAuthToken = defineSecret("TWILIO_AUTH_TOKEN");
const twilioFromNumber = defineSecret("TWILIO_FROM_NUMBER");

const LOGIN_COOLDOWN_MS = 5 * 60 * 1000;

function cleanName(value) {
  return String(value || "GEDIC member").replace(/[<>]/g, "").slice(0, 80);
}

function indianMobile(value) {
  const digits = String(value || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

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
