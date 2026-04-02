/**
 * hospital.js
 * ─────────────────────────────────────────
 * GEDIC — Hospital Admin Dashboard Module
 * Add / Edit / Delete patients
 * ─────────────────────────────────────────
 */

const Hospital = (() => {
  let _editId = null;

  async function load() {
    document.getElementById("hospGreet").textContent = `${App.profile?.name || "Hospital"} Admin 🏥`;
    const pts = App.DEMO ? DB.getAllPatients() : await App.fbFetchPatients();
    _renderStats(pts);
    _renderTable(pts);
  }

  function _renderStats(pts) {
    const counts = {};
    pts.forEach(p => { if (p.blood) counts[p.blood] = (counts[p.blood]||0)+1; });
    const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    document.getElementById("hospStats").innerHTML = `
      <div class="stat"><div class="num">${pts.length}</div><div class="lbl">Patients</div></div>
      <div class="stat"><div class="num">${pts.filter(p=>p.allergies).length}</div><div class="lbl">Allergy Alerts</div></div>
      <div class="stat"><div class="num">${top?top[0]:"—"}</div><div class="lbl">Top Blood Type</div></div>
      <div class="stat"><div class="num">${pts.filter(p=>p.medicines).length}</div><div class="lbl">On Medication</div></div>`;
  }

  function _renderTable(pts) {
    const tbody = document.getElementById("hospTbody");
    if (!pts.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:28px">No patients yet. Add one above.</td></tr>`;
      return;
    }
    tbody.innerHTML = pts.map(p => `
      <tr>
        <td><div class="td-name">${p.name||"—"}</div></td>
        <td><span class="blood-tag" style="font-size:.72rem;padding:1px 8px">${p.blood||"—"}</span></td>
        <td>${p.age||"—"}</td>
        <td class="col-amber" style="max-width:140px">${UI.trunc(p.diseases,32)}</td>
        <td class="col-red"   style="max-width:130px">${UI.trunc(p.allergies,28)}</td>
        <td>${p.doctorName||"—"}</td>
        <td style="display:flex;gap:5px;flex-wrap:wrap">
          <button class="btn btn-ghost   btn-sm" onclick="App.loadEmergencyView('${p.uid||p.id}')">👁</button>
          <button class="btn btn-outline btn-sm" onclick="Hospital.openEdit('${p.id||p.uid}')">✏️</button>
          <button class="btn btn-danger  btn-sm" onclick="Hospital.confirmDelete('${p.id||p.uid}','${(p.name||"patient").replace(/'/g,"\\'")}')">🗑</button>
        </td>
      </tr>`).join("");
  }

  // ── Add Patient ──────────────────────
  function openAdd() {
    _editId = null;
    document.getElementById("patModalTitle").textContent = "+ Add Patient Record";
    ["apName","apAge","apBlood","apHosp","apDis","apAll","apMed","apEName","apEPhone","apDName","apDPhone"].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = "";
    });
    UI.openModal("modPat");
  }

  // ── Edit Patient ─────────────────────
  async function openEdit(id) {
    const pts = App.DEMO ? DB.getAllPatients() : await App.fbFetchPatients();
    const p   = pts.find(x => (x.id||x.uid) === id);
    if (!p) return;
    _editId = id;
    document.getElementById("patModalTitle").textContent = "✏️ Edit Patient";
    const map = { apName:"name",apAge:"age",apBlood:"blood",apHosp:"hospital",apDis:"diseases",apAll:"allergies",apMed:"medicines",apEName:"emergencyName",apEPhone:"emergencyContact",apDName:"doctorName",apDPhone:"doctorPhone" };
    Object.entries(map).forEach(([eid,k]) => { const el=document.getElementById(eid); if(el) el.value=p[k]||""; });
    UI.openModal("modPat");
  }

  // ── Save Patient ─────────────────────
  async function save() {
    const name = UI.val("apName");
    if (!name) { UI.toast("Patient name is required.", "err"); return; }

    const ep = UI.val("apEPhone"), dp = UI.val("apDPhone");
    if (ep) { const r = Phone.validate(ep); if (!r.ok) { UI.toast("Emergency Phone: "+r.msg,"err"); return; } }
    if (dp) { const r = Phone.validate(dp); if (!r.ok) { UI.toast("Doctor Phone: "   +r.msg,"err"); return; } }

    const data = {
      name, age: UI.val("apAge"), blood: UI.val("apBlood"), hospital: UI.val("apHosp"),
      diseases: UI.val("apDis"), allergies: UI.val("apAll"), medicines: UI.val("apMed"),
      emergencyName: UI.val("apEName"),
      emergencyContact: ep ? Phone.clean(ep) : "",
      doctorName: UI.val("apDName"),
      doctorPhone: dp ? Phone.clean(dp) : "",
      updatedAt: Date.now()
    };

    UI.btnLoad("apSaveBtn", true);

    if (App.DEMO) {
      if (_editId) { DB.editPatient(_editId, data); UI.toast("✅ Patient updated!", "ok"); }
      else         { DB.addPatient(data);            UI.toast("✅ Patient added!",   "ok"); }
      UI.closeModal("modPat"); UI.btnLoad("apSaveBtn", false); load(); return;
    }

    try {
      if (_editId) {
        await App.db.collection("patients").doc(_editId).update(data);
        UI.toast("✅ Patient updated!", "ok");
      } else {
        data.createdAt = Date.now(); data.role = "patient";
        await App.db.collection("patients").add(data);
        UI.toast("✅ Patient added!", "ok");
      }
      UI.closeModal("modPat"); load();
    } catch(e) { UI.toast("Error: "+e.message, "err"); }

    UI.btnLoad("apSaveBtn", false);
  }

  // ── Delete Patient ───────────────────
  let _delId = null;
  function confirmDelete(id, name) {
    _delId = id;
    document.getElementById("confirmMsg").textContent = `Delete patient "${name}"? This cannot be undone.`;
    document.getElementById("confirmBtn").onclick = _doDelete;
    UI.openModal("modConfirm");
  }
  async function _doDelete() {
    if (!_delId) return;
    UI.closeModal("modConfirm");
    if (App.DEMO) { DB.deletePatient(_delId); UI.toast("🗑 Deleted.", "info"); load(); return; }
    try { await App.db.collection("patients").doc(_delId).delete(); UI.toast("🗑 Deleted.", "info"); load(); }
    catch(e) { UI.toast("Error: "+e.message, "err"); }
  }

  return { load, openAdd, openEdit, save, confirmDelete };
})();

// Global wrappers
function openAddPat()      { Hospital.openAdd(); }
function savePatRecord()   { Hospital.save(); }
