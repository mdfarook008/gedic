/** Free administrator CLI: link a consenting patient to an organisation/care team. */
const { applicationDefault, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const [patientEmail, organisationId, ...doctorEmails] = process.argv.slice(2);
if (!/^\S+@\S+\.\S+$/.test(patientEmail || "") || !/^[A-Za-z0-9_-]{4,64}$/.test(organisationId || "")) {
  console.error("Usage: npm run assign-patient -- <patient-email> <organisation-id> [doctor-email ...]");
  process.exitCode = 1;
} else {
  initializeApp({ credential: applicationDefault() });
  run().catch(error => { console.error(error.message); process.exitCode = 1; });
}

async function run() {
  const auth = getAuth();
  const patient = await auth.getUserByEmail(patientEmail.toLowerCase());
  const db = getFirestore();
  const patientAccount = await db.collection("users").doc(patient.uid).get();
  if (!patientAccount.exists || patientAccount.data().role !== "patient") throw new Error("Patient account not found.");

  const doctorUids = [];
  for (const email of doctorEmails) {
    const doctor = await auth.getUserByEmail(email.toLowerCase());
    const staff = await db.collection("users").doc(doctor.uid).get();
    const data = staff.data();
    if (!staff.exists || data.role !== "doctor" || data.staffStatus !== "active" || data.organisationId !== organisationId) {
      throw new Error(`${email} is not an active doctor in ${organisationId}.`);
    }
    doctorUids.push(doctor.uid);
  }

  await db.collection("patients").doc(patient.uid).update({
    organisationId,
    careTeamUids: doctorUids,
    assignmentUpdatedAt: FieldValue.serverTimestamp()
  });
  console.log(`Assigned ${patient.email} to ${organisationId} with ${doctorUids.length} doctor(s).`);
}
