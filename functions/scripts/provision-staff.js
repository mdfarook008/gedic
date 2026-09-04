/** Free administrator CLI: activate an existing verified Firebase Auth user as staff. */
const { applicationDefault, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const [email, role, organisationId, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ").trim();
const allowedRoles = new Set(["doctor", "hospital", "responder"]);

if (!/^\S+@\S+\.\S+$/.test(email || "") || !allowedRoles.has(role)
  || !/^[A-Za-z0-9_-]{4,64}$/.test(organisationId || "") || name.length < 2) {
  console.error("Usage: npm run provision-staff -- <email> <doctor|hospital|responder> <organisation-id> <display name>");
  process.exitCode = 1;
} else {
  initializeApp({ credential: applicationDefault() });
  run().catch(error => { console.error(error.message); process.exitCode = 1; });
}

async function run() {
  const authUser = await getAuth().getUserByEmail(email.toLowerCase());
  if (!authUser.emailVerified) throw new Error("Refusing activation: verify the staff email in Firebase Authentication first.");
  const ref = getFirestore().collection("users").doc(authUser.uid);
  const existing = await ref.get();
  if (existing.exists && existing.data().role === "patient") {
    throw new Error("Refusing to convert a patient account. Use a separate professional staff account.");
  }
  await ref.set({
    uid: authUser.uid,
    email: authUser.email,
    name,
    role,
    organisationId,
    staffStatus: "active",
    provisionedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  console.log(`Activated ${role} ${authUser.email} in organisation ${organisationId}.`);
}
