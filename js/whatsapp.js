/**
 * whatsapp.js
 * ─────────────────────────────────────────
 * GEDIC — WhatsApp Emergency Alert Module
 * ─────────────────────────────────────────
 */

const WA = (() => {

  async function buildMsg(p) {
    const ml   = await Location.getLink();
    const link = getEmergencyURL(p.uid || p.id || 'unknown');
    const ph   = n => n ? '+91 ' + n : '—';
    return `🚑 *EMERGENCY ALERT*\n━━━━━━━━━━━━━━━━━\n👤 Patient: ${p.name||'—'}\n🩸 Blood Group: ${p.blood||'—'}\n🏥 Condition: ${p.diseases||'—'}\n⚠️ Allergies: ${p.allergies||'—'}\n💊 Medicines: ${p.medicines||'N/A'}\n🩺 Doctor: ${p.doctorName||'—'} (${ph(p.doctorPhone)})\n🏨 Hospital: ${p.hospital||'—'}\n📞 Emergency: ${p.emergencyName||'—'} – ${ph(p.emergencyContact)}\n━━━━━━━━━━━━━━━━━\n🔗 Full Profile: ${link}\n📍 Location: ${ml}\n━━━━━━━━━━━━━━━━━\n⏰ ${new Date().toLocaleString('en-IN')}`;
  }

  async function send(p, target) {
    const msg   = await buildMsg(p);
    let   phone = '';
    if (target === 'doctor') phone = p.doctorPhone || '';
    if (target === 'family') phone = p.emergencyContact || '';
    if (phone.length === 10) phone = '91' + phone;
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  return { send };
})();
