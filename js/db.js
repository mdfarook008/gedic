/**
 * db.js
 * ─────────────────────────────────────────
 * GEDIC — Demo localStorage Database
 * Used when Firebase config is not set up.
 * ─────────────────────────────────────────
 */

const DB = (() => {
  const KEY = "gedic_db_v3";

  function read()        { return JSON.parse(localStorage.getItem(KEY) || '{"users":{},"patients":[]}'); }
  function write(data)   { localStorage.setItem(KEY, JSON.stringify(data)); }

  function seed() {
    const d = read();
    d.seeded = true;
    d.patients = Array.isArray(d.patients) ? d.patients : [];
    if (!d.patients.some(patient => patient.uid === "demo-uid-p1")) d.patients.push({
      id: "demo-p1", uid: "demo-uid-p1", role: "patient",
      email: "patient@gedic.app",
      name: "Arjun Suresh Kumar", age: "34", blood: "B+",
      diseases: "Type 2 Diabetes, Hypertension",
      allergies: "Penicillin, Sulfa drugs",
      medicines: "Metformin 500mg, Amlodipine 5mg, Aspirin 75mg",
      emergencyName: "Priya Kumar (Wife)",
      emergencyContact: "9876543210",
      doctorName: "Dr. Meena Krishnan",
      doctorPhone: "9444455566",
      hospital: "Apollo Hospitals, Chennai",
      emergencyToken: "demo-emergency-token-p1",
      emergencyEnabled: true,
      dataStatus: "self-reported",
      createdAt: Date.now()
    });
    const demoPatient = d.patients.find(patient => patient.uid === "demo-uid-p1");
    if (demoPatient) {
      if (!demoPatient.emergencyToken) demoPatient.emergencyToken = "demo-emergency-token-p1";
      if (demoPatient.emergencyEnabled === undefined) demoPatient.emergencyEnabled = true;
      if (!demoPatient.dataStatus) demoPatient.dataStatus = "self-reported";
    }
    d.users = { ...d.users,
      "patient@gedic.app":  { uid:"demo-uid-p1",  role:"patient",   pwd:"demo1234", name:"Arjun Suresh Kumar" },
      "doctor@gedic.app":   { uid:"demo-uid-d1",  role:"doctor",    pwd:"demo1234", name:"Dr. Meena Krishnan" },
      "hospital@gedic.app": { uid:"demo-uid-h1",  role:"hospital",  pwd:"demo1234", name:"Apollo Hospitals" },
      "responder@gedic.app": { uid:"demo-uid-r1", role:"responder", pwd:"demo1234", name:"Kavya Nair, EMT" }
    };
    write(d);
  }

  function login(email, pwd) {
    const d = read();
    const u = d.users[email];
    if (!u)        return { ok: false, msg: "No account found with this email." };
    if (u.pwd !== pwd) return { ok: false, msg: "Incorrect password." };
    return { ok: true, uid: u.uid, role: u.role, name: u.name };
  }

  function register(email, pwd, role, profile) {
    const d = read();
    if (d.users[email]) return { ok: false, msg: "Email already registered." };
    const uid = "uid-" + Date.now();
    d.users[email] = { uid, role, pwd, name: profile.name };
    if (role === "patient") {
      profile.uid = uid;
      profile.id  = "p-" + Date.now();
      profile.createdAt = Date.now();
      d.patients.push(profile);
    }
    write(d);
    return { ok: true, uid };
  }

  function getPatientByUid(uid) {
    return read().patients.find(p => (p.uid || p.id) === uid || p.emergencyToken === uid) || null;
  }

  function getAllPatients() {
    return read().patients;
  }

  function updatePatient(uid, updates) {
    const d = read();
    const idx = d.patients.findIndex(p => (p.uid || p.id) === uid);
    if (idx > -1) { d.patients[idx] = { ...d.patients[idx], ...updates }; write(d); return true; }
    return false;
  }

  function addPatient(data) {
    const d = read();
    data.id  = "p-" + Date.now();
    data.uid = data.id;
    data.createdAt = Date.now();
    data.role = "patient";
    d.patients.push(data);
    write(d);
    return data.id;
  }

  function editPatient(id, data) {
    const d = read();
    const idx = d.patients.findIndex(p => (p.id || p.uid) === id);
    if (idx > -1) { d.patients[idx] = { ...d.patients[idx], ...data }; write(d); return true; }
    return false;
  }

  function deletePatient(id) {
    const d = read();
    d.patients = d.patients.filter(p => (p.id || p.uid) !== id);
    write(d);
  }

  // Session helpers
  function saveSession(user, role, profile) {
    localStorage.setItem("gedic_sess", JSON.stringify({ user, role, profile }));
  }
  function loadSession() {
    try { return JSON.parse(localStorage.getItem("gedic_sess") || "null"); } catch { return null; }
  }
  function clearSession() { localStorage.removeItem("gedic_sess"); }

  function recordEmergencyAccess(event) {
    const d = read();
    d.emergencyAccessLogs = Array.isArray(d.emergencyAccessLogs) ? d.emergencyAccessLogs : [];
    const entry = {
      id: `demo-audit-${Date.now()}`,
      outcome: "success",
      recordedAt: new Date().toISOString(),
      ...event
    };
    d.emergencyAccessLogs.push(entry);
    write(d);
    return entry;
  }

  return { seed, login, register, getPatientByUid, getAllPatients, updatePatient, addPatient, editPatient, deletePatient, saveSession, loadSession, clearSession, recordEmergencyAccess };
})();
