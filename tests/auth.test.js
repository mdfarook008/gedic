const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createAuth(passwordResult = { ok: true, uid: 'demo-uid-p1', role: 'patient', name: 'Demo Patient' }) {
  const calls = [];
  const profile = { uid: 'demo-uid-p1', name: 'Demo Patient', role: 'patient' };
  const context = vm.createContext({
    console,
    document: { querySelectorAll: () => [] },
    UI: {
      hideAlert() {}, showAlert: (id, message) => calls.push(['error', message]),
      btnLoad() {}, clearLoginForm: () => calls.push(['clear']), clearRegistrationForm() {},
      val: () => '', firebaseErr: error => error.message, toast: message => calls.push(['toast', message])
    },
    DB: {
      login: () => passwordResult, getPatientByUid: () => profile,
      saveSession: () => calls.push(['session']), clearSession() {}, register() {}
    },
    App: {
      auth: null, firebaseAvailable: true, useDemoMode: () => calls.push(['demo']),
      setUser: () => calls.push(['user']), route: () => calls.push(['route']),
      useFirebaseMode() {}, beginAuthFlow() {}, endAuthFlow() {}, completeFirebaseLogin() {},
      get DEMO() { return false; }
    },
    Phone: { validate: () => ({ ok: true }), clean: value => value },
    Notifications: { send() {} }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'auth.js'), 'utf8'), context);
  return { evaluate: expression => vm.runInContext(expression, context), calls };
}

test('published demo credentials explicitly enter local demo mode', async () => {
  const auth = createAuth();
  await auth.evaluate(`Auth.login('patient@gedic.app', 'demo1234')`);
  assert.ok(auth.calls.some(call => call[0] === 'demo'));
  assert.ok(auth.calls.some(call => call[0] === 'route'));
  assert.ok(auth.calls.some(call => call[0] === 'clear'));
});

test('an invalid demo password stays on login and shows an error', async () => {
  const auth = createAuth({ ok: false, msg: 'Incorrect password.' });
  await auth.evaluate(`Auth.login('patient@gedic.app', 'wrong-password')`);
  assert.ok(auth.calls.some(call => call[0] === 'error'));
  assert.ok(!auth.calls.some(call => call[0] === 'route'));
});
