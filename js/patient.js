/**
 * patient.js
 * ─────────────────────────────────────────
 * GEDIC — Patient Dashboard Module
 * ─────────────────────────────────────────
 */

const Patient = (() => {

  function load() {
    const p = App.profile;
    if (!p) return;

    // Greeting & action labels
    document.getElementById("patGreet").textContent = `Hello, ${p.name || "Patient"} 👋`;
    document.getElementById("aFamLbl").textContent  = p.emergencyName  || p.emergencyContact || "—";
    document.getElementById("aDocLbl").textContent  = p.doctorName     || p.doctorPhone      || "—";

    // WA / SMS modal labels
    document.getElementById("waDocLbl").textContent  = `${p.doctorName||"Doctor"} · ${p.doctorPhone ? "+91 "+p.doctorPhone : "—"}`;
    document.getElementById("waFamLbl").textContent  = p.emergencyName || "—";
    document.getElementById("smsDocLbl").textContent = p.doctorPhone   ? "+91 "+p.doctorPhone        : "—";
    document.getElementById("smsFamLbl").textContent = p.emergencyContact ? "+91 "+p.emergencyContact : "—";

    renderProfile(p);
    renderQR(p);
    prefillEdit(p);
  }

  function renderProfile(p) {
    const fmtPh = n => n ? Phone.format(n) : "—";
    const fields = [
      { k: "👤 Name",       v: p.name },
      { k: "🩸 Blood",      v: p.blood, blood: true },
      { k: "🎂 Age",        v: p.age ? p.age + " yrs" : null },
      { k: "🏥 Hospital",   v: p.hospital },
      { k: "🫀 Conditions", v: p.diseases },
      { k: "⚠️ Allergies",  v: p.allergies, danger: true },
      { k: "💊 Medicines",  v: p.medicines },
      { k: "👨‍👩‍👧 Family",    v: `${p.emergencyName||""} ${p.emergencyContact ? "· "+fmtPh(p.emergencyContact) : ""}`.trim() },
      { k: "🩺 Doctor",     v: `${p.doctorName||""} ${p.doctorPhone ? "· "+fmtPh(p.doctorPhone) : ""}`.trim() },
    ];
    const grid = document.getElementById("profDisplay");
    if (!grid) return;
    grid.innerHTML = fields.map(f => `
      <div class="pfield">
        <div class="pk">${f.k}</div>
        <div class="pv ${f.danger ? "col-red" : ""}">
          ${f.blood
            ? `<span class="blood-tag">${f.v || "—"}</span>`
            : (f.v || `<span class="muted">—</span>`)
          }
        </div>
      </div>`).join("");
  }

  function renderQR(p) {
    const uid    = p.uid || "unknown";
    const qrUrl  = getEmergencyURL(uid);
    const qrEl   = document.getElementById("qrcode");
    const urlEl  = document.getElementById("qrUrl");
    if (qrEl) {
      qrEl.innerHTML = "";
      try {
        new QRCode(qrEl, { text: qrUrl, width: 200, height: 200, colorDark: "#0a0a0a", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
      } catch (e) { qrEl.innerHTML = `<p style="color:red;font-size:.8rem">QR error: ${e.message}</p>`; }
    }
    if (urlEl) urlEl.textContent = qrUrl;
  }

  function prefillEdit(p) {
    const map = {
      eName: "name", eAge: "age", eBlood: "blood", eHosp: "hospital",
      eDis: "diseases", eAll: "allergies", eMed: "medicines",
      eEName: "emergencyName", eEPhone: "emergencyContact",
      eDName: "doctorName",    eDPhone: "doctorPhone"
    };
    Object.entries(map).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = p[key] || "";
    });
  }

  async function saveProfile() {
    const ep = UI.val("eEPhone");
    const dp = UI.val("eDPhone");
    if (ep) { const r = Phone.validate(ep); if (!r.ok) { UI.toast("Emergency Phone: " + r.msg, "err"); return; } }
    if (dp) { const r = Phone.validate(dp); if (!r.ok) { UI.toast("Doctor Phone: "    + r.msg, "err"); return; } }

    const updates = {
      name:             UI.val("eName"),
      age:              UI.val("eAge"),
      blood:            UI.val("eBlood"),
      hospital:         UI.val("eHosp"),
      diseases:         UI.val("eDis"),
      allergies:        UI.val("eAll"),
      medicines:        UI.val("eMed"),
      emergencyName:    UI.val("eEName"),
      emergencyContact: ep ? Phone.clean(ep) : (App.profile?.emergencyContact || ""),
      doctorName:       UI.val("eDName"),
      doctorPhone:      dp ? Phone.clean(dp) : (App.profile?.doctorPhone || ""),
      updatedAt: Date.now()
    };

    UI.btnLoad("saveBtn", true);

    if (App.DEMO) {
      DB.updatePatient(App.user.uid, updates);
      const updated = { ...App.profile, ...updates };
      App.setUser(App.user, App.role, updated);
      const sess = DB.loadSession();
      if (sess) { sess.profile = updated; DB.saveSession(sess.user, sess.role, updated); }
      renderProfile(updated);
      load(); // refresh labels
      UI.btnLoad("saveBtn", false);
      UI.toast("✅ Profile saved!", "ok");
      return;
    }

    try {
      const uid = App.user.uid;
      await App.db.collection("users").doc(uid).update(updates);
      const sn = await App.db.collection("patients").where("uid","==",uid).get();
      sn.forEach(d => d.ref.update(updates));
      App.setUser(App.user, App.role, { ...App.profile, ...updates });
      renderProfile(App.profile);
      load();
      UI.toast("✅ Saved to Firebase!", "ok");
    } catch (e) { UI.toast("Save error: " + e.message, "err"); }

    UI.btnLoad("saveBtn", false);
  }

  function dlQR() {
    const el = document.getElementById("qrcode");
    if (!el) return;
    const canvas = el.querySelector("canvas");
    const a = document.createElement("a");
    a.download = "gedic-emergency-qr.png";
    a.href = canvas ? canvas.toDataURL("image/png") : (el.querySelector("img")?.src || "");
    if (a.href) { a.click(); UI.toast("⬇ QR downloaded!", "ok"); }
  }

  async function copyQR() {
    const url = document.getElementById("qrUrl")?.textContent || "";
    try { await navigator.clipboard.writeText(url); UI.toast("🔗 Link copied!", "ok"); }
    catch { prompt("Copy your emergency QR link:", url); }
  }

  return { load, renderProfile, saveProfile, dlQR, copyQR };
})();

// Global wrappers
function saveProfile() { Patient.saveProfile(); }
function dlQR()        { Patient.dlQR(); }
function copyQR()      { Patient.copyQR(); }
