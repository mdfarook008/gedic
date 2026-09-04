/** Calls the authenticated backend that sends GEDIC account notifications. */
const Notifications = (() => {
  async function sendThroughAppsScript(event) {
    const endpoint = GEDIC_FEATURES.appsScriptNotificationUrl?.trim();
    const user = App.auth?.currentUser;
    if (!endpoint || !user) return null;

    const idToken = await user.getIdToken();
    await fetch(endpoint, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({
        event,
        idToken,
        origin: location.origin,
        occurredAt: new Date().toISOString()
      })
    });
    UI.toast(`GEDIC ${event} email notification requested.`, "ok");
    return { email: true, sms: false, appsScript: true };
  }

  async function send(event) {
    try {
      const freeRelayResult = await sendThroughAppsScript(event);
      if (freeRelayResult) return freeRelayResult;
    } catch (error) {
      console.warn("GEDIC Apps Script notification was not sent:", error.message);
    }

    if (!GEDIC_FEATURES.cloudNotifications) {
      console.info(`GEDIC ${event} cloud notification is disabled in free Spark mode.`);
      return { email: false, sms: false, freeMode: true };
    }
    if (App.DEMO || !App.firebaseAvailable || typeof firebase?.functions !== "function") {
      console.info(`GEDIC ${event} notification skipped in local demo mode.`);
      return { email: false, sms: false, demo: true };
    }

    try {
      const callable = firebase.app().functions("us-central1").httpsCallable("sendAuthNotification");
      const response = await callable({ event });
      const result = response.data || {};
      if (result.email || result.sms) {
        const channels = [result.email && "email", result.sms && "SMS"].filter(Boolean).join(" and ");
        UI.toast(`GEDIC ${channels} notification sent.`, "ok");
      }
      return result;
    } catch (error) {
      // Authentication must never fail merely because an optional provider is
      // not configured or temporarily unavailable.
      console.warn("GEDIC notification was not sent:", error.message);
      return { email: false, sms: false, error: true };
    }
  }

  return { send };
})();
