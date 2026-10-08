const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function authFlow(verified = true, commitFails = false) {
  const events = [];
  const user = { uid: 'synthetic-user', emailVerified: verified,
    sendEmailVerification: async () => events.push('verify-email'),
    delete: async () => events.push('rollback-account') };
  const fields = { regEmail: 'synthetic@example.test', regPwd: 'synthetic-passphrase', rName: 'Synthetic Patient' };
  const context = vm.createContext({ console,
    document: { getElementById: () => ({ checked: false }) },
    UI: { hideAlert() {}, btnLoad() {}, toast() {},
      val: id => fields[id] || '', firebaseErr: error => error.message,
      showAlert: (id, text) => events.push([id, text]),
      clearLoginForm: () => events.push('clear-login'), clearRegistrationForm() {} },
    App: { firebaseAvailable: true, useFirebaseMode() {}, beginAuthFlow() {}, endAuthFlow() {},
      auth: { signInWithEmailAndPassword: async () => ({ user }), createUserWithEmailAndPassword: async () => ({ user }), signOut: async () => events.push('sign-out') },
      completeFirebaseLogin: async () => { events.push('complete-login'); return true; },
      createEmergencyToken: () => 'synthetic-token', patientRecord: p => p,
      setUser() {}, go: page => events.push(page),
      db: { collection: () => ({ doc: () => ({}) }), batch: () => ({ set() {}, commit: async () => { if (commitFails) throw new Error('Profile write failed'); events.push('commit-profile'); } }) } },
    Phone: {}, Notifications: { send: async () => events.push('notification') }
  });
  vm.runInContext(fs.readFileSync('js/auth.js', 'utf8'), context);
  return { events, run: expression => vm.runInContext(expression, context) };
}

test('verified Firebase login completes the authenticated profile flow', async () => {
  const a = authFlow(); await a.run('Auth.login("synthetic@example.test", "synthetic-passphrase")');
  assert.ok(a.events.includes('complete-login'));
  assert.ok(a.events.includes('notification'));
});

test('unverified Firebase user is signed out and receives verification instructions', async () => {
  const a = authFlow(false); await a.run('Auth.login("synthetic@example.test", "synthetic-passphrase")');
  assert.ok(a.events.includes('verify-email'));
  assert.ok(a.events.includes('sign-out'));
  assert.ok(a.events.includes('clear-login'));
  assert.ok(!a.events.includes('complete-login'));
  assert.ok(!a.events.includes('notification'));
  assert.ok(a.events.some(e => Array.isArray(e) && /Verify your email/.test(e[1])));
});

test('failed Firebase patient setup rolls back the newly created authentication account', async () => {
  const a = authFlow(true, true); await a.run('Auth.register()');
  assert.ok(a.events.includes('rollback-account'));
  assert.ok(!a.events.includes('notification'));
  assert.ok(a.events.some(e => Array.isArray(e) && e[1] === 'Profile write failed'));
});

test('successful Firebase setup commits a private profile before email verification', async () => {
  const a = authFlow(); await a.run('Auth.register()');
  assert.ok(a.events.indexOf('commit-profile') < a.events.indexOf('verify-email'));
  assert.ok(a.events.includes('sign-out'));
  assert.ok(a.events.includes('pg-login'));
  assert.ok(!a.events.includes('rollback-account'));
});
