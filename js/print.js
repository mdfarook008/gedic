/** Printable medical card, previewed inside the app before opening the print dialog. */
const PrintCard = (() => {
  function getQRDataURL() {
    const el = document.getElementById("qrcode");
    return el?.querySelector("canvas")?.toDataURL("image/png") || el?.querySelector("img")?.src || null;
  }

  function generate(profile) {
    if (!profile.emergencyEnabled || !profile.emergencyToken) {
      UI.toast("Enable emergency QR sharing before printing a card.", "err");
      return;
    }
    const qrData = getQRDataURL();
    if (!qrData) { UI.toast("The QR code is unavailable. Reload your profile and retry.", "err"); return; }
    const target = document.getElementById("printCardContent");
    if (!target) return;
    const e = UI.escape;
    const fields = [
      ["Blood group", profile.blood], ["Conditions", profile.diseases],
      ["Allergies", profile.allergies], ["Medicines", profile.medicines],
      ["Emergency contact", [profile.emergencyName, profile.emergencyContact && Phone.format(profile.emergencyContact)].filter(Boolean).join(" · ")],
      ["Doctor", [profile.doctorName, profile.doctorPhone && Phone.format(profile.doctorPhone)].filter(Boolean).join(" · ")]
    ];
    target.innerHTML = `<article class="medical-print-card">
      <div class="print-record">
        <p class="print-brand">GEDIC · Emergency medical ID</p>
        <h2>${e(profile.name || "Patient")}</h2>
        ${App.DEMO ? '<p class="print-demo">DEMO · Sample data only</p>' : ''}
        <dl>${fields.map(([label, value]) => `<div><dt>${e(label)}</dt><dd>${e(value || "Not provided")}</dd></div>`).join("")}</dl>
        <p class="print-provenance">Patient-provided information. Verify before acting.</p>
      </div>
      <div class="print-qr">
        <img src="${e(qrData)}" alt="Emergency summary QR code" width="160" height="160">
        <strong>Scan for emergency summary</strong>
        <p>${e(getEmergencyURL(profile.emergencyToken))}</p>
        <small>Keep this card private. Replace it after rotating your QR link.</small>
      </div>
    </article>`;
    UI.openModal("modPrint");
  }
  return { generate };
})();
