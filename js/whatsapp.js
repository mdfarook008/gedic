/**
 * whatsapp.js
 * ─────────────────────────────────────────
 * GEDIC — WhatsApp Emergency Alert Module
 * ─────────────────────────────────────────
 */

const WA = (() => {

  async function buildMsg(p) {
    let ml = "Location unavailable";
    try { ml = await Location.getLink(); } catch (error) { console.warn("WhatsApp location:", error.message); }
    const token = p.emergencyToken || p.uid;
    const link = (p.emergencyEnabled || p.enabled) && token ? getEmergencyURL(token) : 'Not publicly shared';
    const ph   = n => n ? '+91 ' + n : '—';
    return `🚑 *EMERGENCY ALERT*\n━━━━━━━━━━━━━━━━━\n👤 Patient: ${p.name||'—'}\n🩸 Blood Group: ${p.blood||'—'}\n🏥 Condition: ${p.diseases||'—'}\n⚠️ Allergies: ${p.allergies||'—'}\n💊 Medicines: ${p.medicines||'N/A'}\n🩺 Doctor: ${p.doctorName||'—'} (${ph(p.doctorPhone)})\n🏨 Hospital: ${p.hospital||'—'}\n📞 Emergency: ${p.emergencyName||'—'} – ${ph(p.emergencyContact)}\n━━━━━━━━━━━━━━━━━\n🔗 Full Profile: ${link}\n📍 Location: ${ml}\n━━━━━━━━━━━━━━━━━\n⏰ ${new Date().toLocaleString('en-IN')}`;
  }

  async function send(p, target) {
    // Reserve the tab during the click. Waiting for GPS otherwise causes
    // mobile/desktop popup blockers to discard the eventual WhatsApp window.
    const shareWindow = window.open('about:blank', '_blank');
    try {
      const msg = await buildMsg(p);
      let phone = '';
      if (target === 'doctor') phone = p.doctorPhone || '';
      if (target === 'family') phone = p.emergencyContact || '';
      phone = String(phone).replace(/\D/g, '');
      if (phone.length === 10) phone = '91' + phone;
      const url = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
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
