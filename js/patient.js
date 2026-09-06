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
    Location.refreshStatus();
  }

  function renderProfile(p) {
    const fmtPh = n => n ? Phone.format(n) : "—";
    const calculatedAge = ageFromDateOfBirth(p.dateOfBirth) || p.age;
    const fields = [
      { k: "👤 Name",       v: p.name },
      { k: "🩸 Blood",      v: p.blood, blood: true },
      { k: "🎂 Age",        v: calculatedAge ? calculatedAge + " yrs" : null },
      { k: "📅 Date of birth", v: p.dateOfBirth || null },
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
        <div class="pk">${UI.escape(f.k)}</div>
        <div class="pv ${f.danger ? "col-red" : ""}">
          ${f.blood
            ? `<span class="blood-tag">${UI.escape(f.v || "—")}</span>`
            : (f.v ? UI.escape(f.v) : `<span class="muted">—</span>`)
          }
        </div>
      </div>`).join("");
  }

  function renderQR(p) {
    const token  = p.emergencyToken || "";
    const qrUrl  = token ? getEmergencyURL(token) : "";
    const qrEl   = document.getElementById("qrcode");
    const urlEl  = document.getElementById("qrUrl");
    if (qrEl) {
      qrEl.innerHTML = "";
      if (!p.emergencyEnabled) {
        qrEl.textContent = "Emergency QR sharing is disabled. Enable it in Edit Profile when you want to publish an emergency summary.";
        if (urlEl) urlEl.textContent = "No public emergency link";
        return;
      }
      try {
        new QRCode(qrEl, { text: qrUrl, width: 200, height: 200, colorDark: "#0a0a0a", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
      } catch (error) { qrEl.textContent = `QR error: ${error.message}`; }
    }
    if (urlEl) urlEl.textContent = qrUrl;
  }

  function prefillEdit(p) {
    const map = {
      eName: "name", eDob: "dateOfBirth", eBlood: "blood", eHosp: "hospital",
      eDis: "diseases", eAll: "allergies", eMed: "medicines",
      eEName: "emergencyName", eEPhone: "emergencyContact",
      eDName: "doctorName",    eDPhone: "doctorPhone"
    };
    Object.entries(map).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = p[key] || "";
    });
    const sharing = document.getElementById("eEmergencyEnabled");
    if (sharing) sharing.checked = p.emergencyEnabled === true;
  }

  function ageFromDateOfBirth(value) {
    if (!value) return "";
    const born = new Date(`${value}T00:00:00`);
    if (Number.isNaN(born.getTime()) || born > new Date()) return "";
    const today = new Date();
    let age = today.getFullYear() - born.getFullYear();
    const beforeBirthday = today.getMonth() < born.getMonth()
      || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate());
    if (beforeBirthday) age--;
    return age >= 0 && age <= 125 ? String(age) : "";
  }

  async function saveProfile() {
    const ep = UI.val("eEPhone");
    const dp = UI.val("eDPhone");
    if (ep) { const r = Phone.validate(ep); if (!r.ok) { UI.toast("Emergency Phone: " + r.msg, "err"); return; } }
    if (dp) { const r = Phone.validate(dp); if (!r.ok) { UI.toast("Doctor Phone: "    + r.msg, "err"); return; } }

    const updates = {
      name:             UI.val("eName"),
      dateOfBirth:      UI.val("eDob"),
      age:              ageFromDateOfBirth(UI.val("eDob")) || App.profile?.age || "",
      blood:            UI.val("eBlood"),
      hospital:         UI.val("eHosp"),
      diseases:         UI.val("eDis"),
      allergies:        UI.val("eAll"),
      medicines:        UI.val("eMed"),
      emergencyName:    UI.val("eEName"),
      emergencyContact: ep ? Phone.clean(ep) : "",
      doctorName:       UI.val("eDName"),
      doctorPhone:      dp ? Phone.clean(dp) : "",
      updatedAt: Date.now(),
      dataStatus: "self-reported",
      emergencyEnabled: Boolean(document.getElementById("eEmergencyEnabled")?.checked)
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
      const updated = { ...App.profile, ...updates };
      const patientRef = App.db.collection("patients").doc(App.profile.patientDocId || uid);
      const publicRef = App.db.collection("publicProfiles").doc(updated.emergencyToken);
      const batch = App.db.batch();
      batch.update(App.db.collection("users").doc(uid), { name: updated.name, emergencyToken: updated.emergencyToken });
      batch.update(patientRef, App.patientRecord(updated));
      if (updated.emergencyEnabled) batch.set(publicRef, App.publicProfile(updated, uid));
      else batch.delete(publicRef);
      await batch.commit();
      App.setUser(App.user, App.role, updated);
      renderProfile(App.profile);
      load();
      UI.toast("✅ Saved to Firebase!", "ok");
    } catch (e) {
      prefillEdit(App.profile);
      const message = e?.code === "permission-denied"
        ? "Firebase rejected the update. The administrator must deploy the current Firestore rules and indexes."
        : "Save error: " + e.message;
      UI.toast(message, "err");
    }

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
    if (!App.profile?.emergencyEnabled || !url.startsWith("http")) { UI.toast("Enable emergency QR sharing first.", "err"); return; }
    try { await navigator.clipboard.writeText(url); UI.toast("🔗 Link copied!", "ok"); }
    catch { prompt("Copy your emergency QR link:", url); }
  }

  async function rotateEmergencyToken() {
    const oldToken = App.profile?.emergencyToken;
    if (!oldToken || !App.user?.uid) return;
    if (!confirm("Rotate the emergency QR? Existing printed and shared QR codes will immediately stop working.")) return;
    const token = App.createEmergencyToken();
    const updated = { ...App.profile, emergencyToken: token, updatedAt: Date.now() };
    if (App.DEMO) {
      DB.updatePatient(App.user.uid, updated);
      App.setUser(App.user, App.role, updated);
      DB.saveSession(App.user, App.role, updated);
    } else {
      const batch = App.db.batch();
      batch.update(App.db.collection("users").doc(App.user.uid), { emergencyToken: token });
      batch.update(App.db.collection("patients").doc(App.profile.patientDocId || App.user.uid), { emergencyToken: token, updatedAt: updated.updatedAt });
      batch.delete(App.db.collection("publicProfiles").doc(oldToken));
      if (updated.emergencyEnabled) batch.set(App.db.collection("publicProfiles").doc(token), App.publicProfile(updated, App.user.uid));
      await batch.commit();
      App.setUser(App.user, App.role, updated);
    }
    load();
    UI.toast("Emergency QR rotated. Old links are revoked.", "ok");
  }

  return { load, renderProfile, saveProfile, dlQR, copyQR, rotateEmergencyToken };
})();

// Global wrappers
function saveProfile() { Patient.saveProfile(); }
function dlQR()        { Patient.dlQR(); }
function copyQR()      { Patient.copyQR(); }
function rotateEmergencyToken() { Patient.rotateEmergencyToken(); }
