/**
 * doctor.js
 * ─────────────────────────────────────────
 * GEDIC — Doctor Dashboard Module
 * ─────────────────────────────────────────
 */

const Doctor = (() => {

  async function load() {
    document.getElementById("docGreet").textContent = `Dr. ${App.profile?.name || ""} 🩺`;
    const patients = App.DEMO ? DB.getAllPatients() : await App.fbFetchPatients();
    _renderStats(patients);
    _renderTable(patients);
  }

  function _renderStats(pts) {
    document.getElementById("docStats").innerHTML = `
      <div class="stat"><div class="num">${pts.length}</div><div class="lbl">Patients</div></div>
      <div class="stat"><div class="num">${pts.filter(p=>p.allergies).length}</div><div class="lbl">Allergy Alerts</div></div>
      <div class="stat"><div class="num">${pts.filter(p=>p.diseases).length}</div><div class="lbl">With Conditions</div></div>
      <div class="stat"><div class="num">${pts.filter(p=>p.blood).length}</div><div class="lbl">Blood Typed</div></div>`;
  }

  function _renderTable(pts) {
    const tbody = document.getElementById("docTbody");
    const e = UI.escape;
    if (!pts.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:28px">No patients yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = pts.map(p => `
      <tr>
        <td><div class="td-name">${e(p.name||"—")}</div></td>
        <td><span class="blood-tag" style="font-size:.75rem;padding:1px 10px">${e(p.blood||"—")}</span></td>
        <td>${e(p.age||"—")}</td>
        <td class="col-amber" style="max-width:180px">${e(UI.trunc(p.diseases,45))}</td>
        <td><div>${e(p.emergencyName||"—")}</div><div class="td-sub">${e(p.emergencyContact?"+91 "+p.emergencyContact:"")}</div></td>
        <td style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" data-action="staff-view" data-patient-id="${e(p.id||p.uid)}">👁 View</button>
          <button class="btn btn-green btn-sm" data-action="call-direct" data-phone="${e(p.emergencyContact||"108")}">📞</button>
        </td>
      </tr>`).join("");
  }

  return { load };
})();
