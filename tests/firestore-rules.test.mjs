import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";

const projectId = "gedic-rules-test";
const ownerUid = "patient-1";
const strangerUid = "patient-2";
const token = "8f3a1c9e7b2d4f6a0c8e1b3d5f7a9c2e4b6d8f0a1c3e5b7d";
let env;

const account = {
  role: "patient",
  email: "patient@example.test",
  name: "Test Patient",
  accountPhone: "9876543210",
  createdAt: 1,
  emergencyToken: token
};

const patient = {
  uid: ownerUid,
  name: "Test Patient",
  blood: "B+",
  allergies: "Penicillin",
  emergencyEnabled: true,
  emergencyToken: token,
  careTeamUids: [],
  dataStatus: "self-reported",
  createdAt: 1,
  updatedAt: 1
};

const publicProfile = {
  ownerUid,
  enabled: true,
  name: "Test Patient",
  blood: "B+",
  allergies: "Penicillin",
  dataStatus: "self-reported",
  updatedAt: 1
};

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8") }
  });
});

beforeEach(async () => env.clearFirestore());
after(async () => env.cleanup());

test("patient registration can atomically create account, private record, and enabled QR profile", async () => {
  const db = env.authenticatedContext(ownerUid).firestore();
  const batch = writeBatch(db);
  batch.set(doc(db, "users", ownerUid), account);
  batch.set(doc(db, "patients", ownerUid), patient);
  batch.set(doc(db, "publicProfiles", token), publicProfile);
  await assertSucceeds(batch.commit());
});

test("enabled QR token supports direct emergency read but cannot be enumerated", async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, "publicProfiles", token), publicProfile);
  });
  const db = env.unauthenticatedContext().firestore();
  const snapshot = await assertSucceeds(getDoc(doc(db, "publicProfiles", token)));
  assert.equal(snapshot.data().blood, "B+");
  await assertFails(getDocs(collection(db, "publicProfiles")));
});

test("disabled QR profile and private patient record are not publicly readable", async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, "publicProfiles", token), { ...publicProfile, enabled: false });
    await setDoc(doc(db, "patients", ownerUid), patient);
  });
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "publicProfiles", token)));
  await assertFails(getDoc(doc(db, "patients", ownerUid)));
});

test("owner can update medical data but cannot self-assign an organisation", async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, "users", ownerUid), account);
    await setDoc(doc(db, "patients", ownerUid), patient);
  });
  const db = env.authenticatedContext(ownerUid).firestore();
  await assertSucceeds(updateDoc(doc(db, "patients", ownerUid), {
    allergies: "Latex",
    updatedAt: 2
  }));
  await assertFails(updateDoc(doc(db, "patients", ownerUid), {
    organisationId: "attacker-controlled"
  }));
});

test("another signed-in patient cannot read or overwrite a private record", async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), "patients", ownerUid), patient);
  });
  const db = env.authenticatedContext(strangerUid).firestore();
  await assertFails(getDoc(doc(db, "patients", ownerUid)));
  await assertFails(updateDoc(doc(db, "patients", ownerUid), { blood: "O-" }));
});

async function seedStaff() {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'patients', ownerUid), { ...patient, organisationId: 'hospital-one', careTeamUids: ['doctor-one'] });
    for (const [uid, role, organisationId, staffStatus] of [
      ['doctor-one', 'doctor', 'hospital-one', 'active'],
      ['doctor-unassigned', 'doctor', 'hospital-one', 'active'],
      ['doctor-other', 'doctor', 'hospital-two', 'active'],
      ['hospital-one', 'hospital', 'hospital-one', 'active'],
      ['hospital-other', 'hospital', 'hospital-two', 'active'],
      ['doctor-inactive', 'doctor', 'hospital-one', 'inactive']
    ]) await setDoc(doc(db, 'users', uid), { role, organisationId, staffStatus });
  });
}

test('only active assigned doctors and same-organisation hospitals can read or edit a patient', async () => {
  await seedStaff();
  for (const uid of ['doctor-one', 'hospital-one']) {
    const db = env.authenticatedContext(uid).firestore();
    await assertSucceeds(getDoc(doc(db, 'patients', ownerUid)));
    await assertSucceeds(updateDoc(doc(db, 'patients', ownerUid), { medicines: 'Test medicine', updatedAt: 2 }));
    await assertFails(updateDoc(doc(db, 'patients', ownerUid), { emergencyEnabled: false }));
    await assertFails(updateDoc(doc(db, 'patients', ownerUid), { careTeamUids: [] }));
  }
  for (const uid of ['doctor-unassigned', 'doctor-other', 'hospital-other', 'doctor-inactive']) {
    const db = env.authenticatedContext(uid).firestore();
    await assertFails(getDoc(doc(db, 'patients', ownerUid)));
    await assertFails(updateDoc(doc(db, 'patients', ownerUid), { medicines: 'Unauthorized edit' }));
  }
});

test('staff table queries require organisation and doctor assignment constraints', async () => {
  await seedStaff();
  const hospital = env.authenticatedContext('hospital-one').firestore();
  await assertSucceeds(getDocs(query(collection(hospital, 'patients'), where('organisationId', '==', 'hospital-one')))).catch(error => { throw new Error('Hospital scoped query failed', { cause: error }); });
  await assertFails(getDocs(collection(hospital, 'patients')));
  const doctor = env.authenticatedContext('doctor-one').firestore();
  await assertSucceeds(getDocs(query(collection(doctor, 'patients'), where('organisationId', '==', 'hospital-one'), where('careTeamUids', 'array-contains', 'doctor-one')))).catch(error => { throw new Error('Doctor assigned query failed', { cause: error }); });
  await assertFails(getDocs(query(collection(doctor, 'patients'), where('organisationId', '==', 'hospital-one'))));
});

test('public sharing can be revoked and atomically rotated to a new token', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', ownerUid), account);
    await setDoc(doc(db, 'patients', ownerUid), patient);
    await setDoc(doc(db, 'publicProfiles', token), publicProfile);
  });
  const db = env.authenticatedContext(ownerUid).firestore();
  const anonymous = env.unauthenticatedContext().firestore();
  await assertSucceeds(deleteDoc(doc(db, 'publicProfiles', token)));
  await assertFails(getDoc(doc(anonymous, 'publicProfiles', token)));
  const nextToken = 'a'.repeat(48);
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', ownerUid), { emergencyToken: nextToken });
  batch.update(doc(db, 'patients', ownerUid), { emergencyToken: nextToken });
  batch.set(doc(db, 'publicProfiles', nextToken), publicProfile);
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(anonymous, 'publicProfiles', nextToken)));
  await assertFails(setDoc(doc(db, 'publicProfiles', token), publicProfile));
});

test('patients cannot promote themselves or write backend access logs', async () => {
  const db = env.authenticatedContext(ownerUid).firestore();
  await assertFails(setDoc(doc(db, 'users', ownerUid), { ...account, role: 'doctor', staffStatus: 'active', organisationId: 'hospital-one' }));
  await assertSucceeds(setDoc(doc(db, 'users', ownerUid), account));
  await assertFails(updateDoc(doc(db, 'users', ownerUid), { role: 'hospital' }));
  await assertFails(setDoc(doc(db, 'emergencyAccessLogs', 'forged'), { patientUid: ownerUid }));
});
