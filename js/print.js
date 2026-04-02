/**
 * print.js
 * ─────────────────────────────────────────
 * GEDIC — Print as Emergency Card Feature
 * Generates a print-ready A6 wallet card
 * with QR code + critical medical info.
 * ─────────────────────────────────────────
 */

const PrintCard = (() => {

  function getQRDataURL() {
    const el = document.getElementById("qrcode");
    if (!el) return null;
    const canvas = el.querySelector("canvas");
    if (canvas) return canvas.toDataURL("image/png");
    const img = el.querySelector("img");
    if (img) return img.src;
    return null;
  }

  function generate(profile) {
    const uid    = profile.uid || profile.id || "unknown";
    const link = getEmergencyURL(uid);
    const qrData = getQRDataURL();
    const ph     = n => n ? "+91 " + n : "—";

    const win = window.open("", "_blank", "width=700,height=520");
    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>GEDIC Emergency Card — ${profile.name || "Patient"}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Outfit', sans-serif;
    background: #f0f0f0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    min-height: 100vh; padding: 24px;
    gap: 20px;
  }

  .print-controls {
    display: flex; gap: 10px;
    font-family: 'Outfit', sans-serif;
  }
  .print-controls button {
    padding: 10px 24px; border: none; border-radius: 8px;
    cursor: pointer; font-family: 'Outfit', sans-serif;
    font-weight: 700; font-size: .9rem;
  }
  .btn-print  { background: #dc2626; color: #fff; }
  .btn-close  { background: #27272a; color: #fff; }

  .card-wrap {
    display: flex; gap: 0;
    box-shadow: 0 8px 40px rgba(0,0,0,.18);
    border-radius: 14px;
    overflow: hidden;
  }

  /* FRONT SIDE */
  .card-front {
    width: 340px; min-height: 210px;
    background: linear-gradient(145deg, #1a0000, #3b0000);
    color: #fff;
    padding: 20px;
    display: flex; flex-direction: column; justify-content: space-between;
    position: relative; overflow: hidden;
  }
  .card-front::before {
    content: '🆘';
    position: absolute; right: -16px; top: -20px;
    font-size: 90px; opacity: .06;
  }
  .card-front::after {
    content: '';
    position: absolute; bottom: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, #dc2626, #f87171, #dc2626);
  }
  .card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .card-logo {
    width: 28px; height: 28px; background: #dc2626;
    border-radius: 6px; display: grid; place-items: center;
    font-size: 14px;
  }
  .card-title { font-size: .65rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; opacity: .7; }
  .patient-name { font-size: 1.18rem; font-weight: 900; letter-spacing: -.01em; margin-bottom: 4px; }
  .blood-badge {
    display: inline-block;
    background: #dc2626; color: #fff;
    font-family: 'JetBrains Mono', monospace;
    font-size: .9rem; font-weight: 700;
    padding: 2px 12px; border-radius: 6px;
    margin-bottom: 10px;
  }
  .info-row { font-size: .72rem; margin-bottom: 3px; opacity: .85; line-height: 1.5; }
  .info-row strong { opacity: .55; margin-right: 4px; }
  .allergy-warn {
    background: rgba(220,38,38,.25);
    border: 1px solid rgba(220,38,38,.5);
    border-radius: 6px;
    padding: 5px 8px;
    font-size: .7rem;
    color: #fca5a5;
    margin-top: 6px;
  }

  /* BACK SIDE */
  .card-back {
    width: 220px; min-height: 210px;
    background: #ffffff;
    color: #111;
    padding: 16px;
    display: flex; flex-direction: column; align-items: center; justify-content: space-between;
    border-left: 3px solid #dc2626;
  }
  .qr-label { font-size: .6rem; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #dc2626; margin-bottom: 6px; }
  .qr-img { width: 120px; height: 120px; border: 2px solid #dc2626; border-radius: 8px; padding: 4px; }
  .qr-url  { font-size: .48rem; color: #666; word-break: break-all; text-align: center; margin-top: 5px; font-family: 'JetBrains Mono', monospace; }
  .contacts { width: 100%; margin-top: 8px; }
  .contact-row { font-size: .62rem; margin-bottom: 4px; color: #333; }
  .contact-row span { font-weight: 700; color: #dc2626; }
  .scan-hint { font-size: .58rem; color: #999; text-align: center; margin-top: 6px; }

  @media print {
    body { background: white; padding: 0; justify-content: flex-start; margin: 20px; }
    .print-controls { display: none; }
    .card-wrap { box-shadow: none; }
  }
</style>
</head>
<body>

<div class="print-controls">
  <button class="btn-print" onclick="window.print()">🖨️ Print Card</button>
  <button class="btn-close" onclick="window.close()">✕ Close</button>
</div>

<div class="card-wrap">

  <!-- FRONT -->
  <div class="card-front">
    <div>
      <div class="card-header">
        <div class="card-logo">🚑</div>
        <div class="card-title">Global Emergency Digital ID Card</div>
      </div>
      <div class="patient-name">${profile.name || "—"}</div>
      <div class="blood-badge">${profile.blood || "—"}</div>
      <div class="info-row"><strong>Age:</strong>${profile.age || "—"}</div>
      <div class="info-row"><strong>Hospital:</strong>${profile.hospital || "—"}</div>
      <div class="info-row"><strong>Doctor:</strong>${profile.doctorName || "—"}</div>
      <div class="info-row"><strong>Dr. Ph:</strong>${ph(profile.doctorPhone)}</div>
      <div class="info-row"><strong>Emergency:</strong>${profile.emergencyName || "—"}</div>
      <div class="info-row"><strong>Ph:</strong>${ph(profile.emergencyContact)}</div>
      ${profile.medicines ? `<div class="info-row"><strong>Meds:</strong>${profile.medicines}</div>` : ""}
    </div>
    ${profile.allergies ? `<div class="allergy-warn">⚠️ ALLERGIES: ${profile.allergies}</div>` : ""}
  </div>

  <!-- BACK (QR side) -->
  <div class="card-back">
    <div style="width:100%;text-align:center">
      <div class="qr-label">Scan for Full Medical Info</div>
      ${qrData
        ? `<img class="qr-img" src="${qrData}" alt="Emergency QR">`
        : `<div style="width:120px;height:120px;border:2px solid #dc2626;border-radius:8px;display:grid;place-items:center;margin:0 auto;color:#dc2626;font-size:.7rem;text-align:center;padding:10px">QR Code<br>(open QR tab first)</div>`
      }
      <div class="qr-url">${link}</div>
    </div>
    <div class="contacts">
      <div class="contact-row"><span>Condition:</span> ${profile.diseases || "—"}</div>
      <div class="contact-row"><span>Allergy:</span> ${profile.allergies || "None"}</div>
    </div>
    <div class="scan-hint">Powered by GEDIC · gedic.app</div>
  </div>

</div>

<script>
  // Auto-print after 800ms (gives fonts time to load)
  // Comment out if you prefer to click manually
  // setTimeout(() => window.print(), 800);
<\/script>
</body>
</html>`);
    win.document.close();
  }

  return { generate };
})();
