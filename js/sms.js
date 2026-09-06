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
    const savedPhone = target === 'doctor' ? p.doctorPhone : target === 'family' ? p.emergencyContact : '108';
    if (!savedPhone) throw new Error(`No ${target === 'doctor' ? 'doctor' : 'emergency contact'} phone number is saved.`);
    // Reserve a browsing context before GPS resolves so the operating system
    // still accepts the external SMS-protocol navigation.
    const shareWindow = window.open('about:blank', '_blank');
    try {
      const body = await buildBody(p);
      let phone = target === 'ambulance' ? '108' : '';
      if (target === 'doctor') phone = p.doctorPhone || '';
      if (target === 'family') phone = p.emergencyContact || '';
      phone = String(phone).replace(/\D/g, '');
      if (phone.length === 10) phone = '91' + phone;
      const recipient = phone === '108' ? phone : `+${phone}`;
      const url = `sms:${recipient}?body=${encodeURIComponent(body)}`;
      if (shareWindow) shareWindow.location.replace(url);
      else window.location.href = url;
      return url;
    } catch (error) {
      shareWindow?.close();
      throw error;
    }
  }

  return { send };
})();
