/**
 * emergency.js
 * ─────────────────────────────────────────
 * GEDIC — Emergency Public View Module
 * Renders the QR-scan emergency profile.
 * ─────────────────────────────────────────
 */

const Emergency = (() => {
  let _active = null; // currently displayed profile

  function render(p, uid) {
    if (!p) {
      document.getElementById("eN").textContent = "Profile not found";
      return;
    }

    _active = { ...p, uid };

    const fmtPh = n => n ? Phone.format(n) : "—";

    UI.setText("eN",      p.name);
    UI.setText("eB",      p.blood || "—");
    UI.setText("eAg",     p.age   ? p.age + " yrs" : "—");
    UI.setText("eH",      p.hospital);
    UI.setText("eDis",    p.diseases);
    UI.setText("eAll",    p.allergies);
    UI.setText("eMedE",   p.medicines);
    UI.setText("eEName",  p.emergencyName);
    UI.setText("eEPhone", fmtPh(p.emergencyContact));
    UI.setText("eDName",  p.doctorName);
    UI.setText("eDPhone", fmtPh(p.doctorPhone));
    UI.setText("eCallFam",`${p.emergencyName||""} · ${fmtPh(p.emergencyContact)}`);
    UI.setText("eCallDoc",`${p.doctorName||""} · ${fmtPh(p.doctorPhone)}`);

    // WA / SMS modal labels
    const wd = document.getElementById("waDocLbl");
    const wf = document.getElementById("waFamLbl");
    const sd = document.getElementById("smsDocLbl");
    const sf = document.getElementById("smsFamLbl");
    if (wd) wd.textContent = `${p.doctorName||"Doctor"} · ${fmtPh(p.doctorPhone)}`;
    if (wf) wf.textContent = p.emergencyName || "—";
    if (sd) sd.textContent = fmtPh(p.doctorPhone);
    if (sf) sf.textContent = fmtPh(p.emergencyContact);
  }

  return { render, get _active() { return _active; } };
})();
