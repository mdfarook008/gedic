/**
 * GEDIC free Gmail notification relay for Google Apps Script.
 * Set the FIREBASE_API_KEY Script Property before deploying this as a web app.
 */
const FIREBASE_LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=";
const LOGIN_COOLDOWN_SECONDS = 300;
const SIGNUP_COOLDOWN_SECONDS = 21600;

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function(character) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character];
  });
}

function verifyFirebaseUser(idToken) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("FIREBASE_API_KEY");
  if (!apiKey) throw new Error("FIREBASE_API_KEY Script Property is not configured.");
  const response = UrlFetchApp.fetch(FIREBASE_LOOKUP_URL + encodeURIComponent(apiKey), {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ idToken: idToken }),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error("Invalid or expired Firebase ID token.");
  const user = JSON.parse(response.getContentText()).users?.[0];
  if (!user?.localId || !user?.email) throw new Error("Firebase user email was not found.");
  return user;
}

function doPost(request) {
  try {
    const payload = JSON.parse(request.postData?.contents || "{}");
    if (!["login", "signup"].includes(payload.event)) throw new Error("Unsupported notification event.");
    if (!payload.idToken) throw new Error("Firebase ID token is required.");

    const user = verifyFirebaseUser(payload.idToken);
    if (payload.event === "login" && !user.emailVerified) throw new Error("Login email is not verified.");

    const cooldown = payload.event === "login" ? LOGIN_COOLDOWN_SECONDS : SIGNUP_COOLDOWN_SECONDS;
    const cache = CacheService.getScriptCache();
    const cacheKey = `gedic_${payload.event}_${user.localId}`;
    if (cache.get(cacheKey)) return jsonResponse({ ok: true, throttled: true });
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error("Daily Gmail recipient quota is exhausted.");

    const isLogin = payload.event === "login";
    const subject = isLogin ? "New sign-in to your GEDIC account" : "Welcome to GEDIC";
    const time = payload.occurredAt ? new Date(payload.occurredAt) : new Date();
    const displayTime = Utilities.formatDate(time, Session.getScriptTimeZone(), "dd MMM yyyy, hh:mm:ss a");
    const origin = String(payload.origin || "GEDIC web app").slice(0, 200);
    const body = isLogin
      ? `A new sign-in to your GEDIC account (${user.email}) was recorded on ${displayTime}.\n\nApp: ${origin}\n\nIf this was not you, reset your password immediately.`
      : `Welcome to GEDIC. Your account ${user.email} was created on ${displayTime}. Please complete email verification before signing in.`;

    MailApp.sendEmail({
      to: user.email,
      subject: subject,
      body: body,
      name: "GEDIC Security",
      htmlBody: `<div style="font-family:Arial,sans-serif;max-width:560px;padding:24px;color:#172033"><h2 style="color:#4f46e5">GEDIC</h2><p>${escapeHtml(body).replace(/\n/g, "<br>")}</p><p style="color:#65718a;font-size:12px">Global Emergency Digital Identity Card</p></div>`
    });
    cache.put(cacheKey, "sent", cooldown);
    return jsonResponse({ ok: true, email: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: error.message });
  }
}
