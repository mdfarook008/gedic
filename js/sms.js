/**
 * sms.js
 * ─────────────────────────────────────────
 * GEDIC — SMS Emergency Alert Module
 * ─────────────────────────────────────────
 */

const SMS = (() => {

  async function buildBody(p) {
    let ml = "Location unavailable";
    try { ml = await Location.getLink(); } catch (error) { console.warn("SMS location:", error.message); }
    const token = p.emergencyToken || p.uid;
    const link = (p.emergencyEnabled || p.enabled) && token ? getEmergencyURL(token) : "Not publicly shared";
    return `EMERGENCY: ${p.name||'Unknown'}\nBlood: ${p.blood||'?'}\nCondition: ${p.diseases||'?'}\nAllergies: ${p.allergies||'?'}\nDoctor: ${p.doctorName||'?'} +91${p.doctorPhone||'?'}\nLocation: ${ml}\nEmergency summary: ${link}\nTime: ${new Date().toLocaleString('en-IN')}`;
  }

  async function send(p, target) {
    const body  = await buildBody(p);
    let   phone = '108';
    if (target === 'doctor')    phone = p.doctorPhone || '108';
    if (target === 'family')    phone = p.emergencyContact || '108';
    if (target === 'ambulance') phone = '108';
    if (phone.length === 10)    phone = '91' + phone;
    window.location.href = `sms:+${phone}?body=${encodeURIComponent(body)}`;
  }

  return { send };
})();
