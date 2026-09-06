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
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
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
