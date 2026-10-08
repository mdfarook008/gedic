const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../js', name), 'utf8');

function patient() {
  const values = { eName: 'Sample Patient', eDob: '' };
  const messages = [];
  const context = vm.createContext({
    UI: { val: id => values[id] || '', toast: message => messages.push(message) },
    App: { profile: { emergencyEnabled: false } },
    document: { getElementById() { throw new Error('Should stop before accessing QR DOM'); } }
  });
  vm.runInContext(read('patient.js'), context);
  return { values, messages, run: expression => vm.runInContext(expression, context) };
}

test('patient save rejects a blank name before changing any record', async () => {
  const p = patient(); p.values.eName = '';
  await p.run('Patient.saveProfile()');
  assert.match(p.messages[0], /full name/);
});

test('patient save rejects future or implausibly old birth dates', async () => {
  for (const value of ['2999-01-01', '1800-01-01']) {
    const p = patient(); p.values.eDob = value;
    await p.run('Patient.saveProfile()');
    assert.match(p.messages[0], /valid date of birth/);
  }
});

test('disabled emergency sharing cannot download a false QR image', () => {
  const p = patient(); p.run('Patient.dlQR()');
  assert.match(p.messages[0], /Enable emergency QR sharing/);
});

test('missing QR blocks print preview with an actionable error', () => {
  const messages = [];
  const context = vm.createContext({
    document: { getElementById: () => null },
    UI: { escape: String, toast: message => messages.push(message) },
    getEmergencyURL: () => 'http://localhost/?view=sample',
    window: { open: () => null }
  });
  vm.runInContext(read('print.js'), context);
  vm.runInContext('PrintCard.generate({emergencyEnabled: true, emergencyToken: "sample"})', context);
  assert.match(messages[0], /QR code is unavailable/);
});

test('print preview includes current contacts and QR without opening a popup', () => {
  const target = { innerHTML: '' };
  const opened = [];
  const context = vm.createContext({
    document: { getElementById: id => id === 'qrcode' ? { querySelector: tag => tag === 'canvas' ? { toDataURL: () => 'data:image/png;base64,sample' } : null } : target },
    UI: { escape: value => String(value).replace(/</g, '&lt;'), openModal: id => opened.push(id) },
    Phone: { format: value => value }, App: { DEMO: true },
    getEmergencyURL: () => 'http://localhost/?view=sample'
  });
  vm.runInContext(read('print.js'), context);
  vm.runInContext('PrintCard.generate({name: "<Sample>", emergencyEnabled: true, emergencyToken: "sample", emergencyContact: "9876543210"})', context);
  assert.deepEqual(opened, ['modPrint']);
  assert.match(target.innerHTML, /&lt;Sample>/);
  assert.match(target.innerHTML, /9876543210/);
  assert.match(target.innerHTML, /data:image\/png/);
  assert.match(target.innerHTML, /Sample data only/);
});

test('hospital save rejects negative, decimal, and out-of-range ages before writing', async () => {
  for (const age of ['-1', '2.5', '126']) {
    const messages = [];
    const context = vm.createContext({ UI: {
      val: id => id === 'apName' ? 'Sample Patient' : id === 'apAge' ? age : '',
      toast: message => messages.push(message)
    } });
    vm.runInContext(read('hospital.js'), context);
    await vm.runInContext('Hospital.save()', context);
    assert.match(messages[0], /between 0 and 125/);
  }
});

test('contact actions use the visible profile rather than a stale emergency record', () => {
  let page = 'pg-patient';
  const context = vm.createContext({
    document: { querySelector: () => ({ id: page }) },
    Emergency: { _active: { name: 'Previously viewed patient' }, render() {} }
  });
  vm.runInContext(read('app.js'), context);
  vm.runInContext('App.setUser({}, "patient", { name: "Current patient" })', context);
  assert.equal(vm.runInContext('communicationProfile().name', context), 'Current patient');
  page = 'pg-emergency';
  assert.equal(vm.runInContext('communicationProfile().name', context), 'Previously viewed patient');
  context.Emergency._active = null;
  assert.equal(vm.runInContext('communicationProfile()', context), null);
});

function controller(patients = []) {
  const renders = [];
  const emergency = { _active: null, render(profile) { this._active = profile; renders.push(profile); } };
  const context = vm.createContext({
    document: {
      querySelector: () => ({ id: 'pg-land' }), querySelectorAll: () => [],
      getElementById: () => ({ classList: { add() {} }, querySelector: () => null })
    },
    URLSearchParams, history: { replaceState() {}, pushState() {} }, location: { search: '' },
    Emergency: emergency, DB: { getAllPatients: () => patients }
  });
  vm.runInContext(read('app.js'), context);
  return { renders, emergency, run: expression => vm.runInContext(expression, context) };
}

test('public demo lookup honors sharing and rejects patient IDs and revoked tokens', async () => {
  const c = controller([{ uid: 'patient-1', emergencyToken: 'current-token', emergencyEnabled: true }]);
  c.run('App.useDemoMode()');
  await c.run('App.loadEmergencyView("current-token")');
  assert.equal(c.renders.at(-1).uid, 'patient-1');
  for (const key of ['patient-1', 'revoked-token']) {
    await c.run(`App.loadEmergencyView("${key}")`);
    assert.equal(c.renders.at(-1), undefined);
  }
  const disabled = controller([{ uid: 'patient-1', emergencyToken: 'current-token', emergencyEnabled: false }]);
  disabled.run('App.useDemoMode()');
  await disabled.run('App.loadEmergencyView("current-token")');
  assert.equal(disabled.renders.at(-1), undefined);
});

test('changing or logging out of an account clears the previously opened emergency record', () => {
  const c = controller();
  c.run('App.setUser({uid: "one"}, "doctor", {})');
  c.emergency._active = { name: 'Private clinical record' };
  c.run('App.setUser({uid: "two"}, "patient", {})');
  assert.equal(c.emergency._active, null);
  c.emergency._active = { name: 'Private clinical record' };
  c.run('App.setUser(null, null, null)');
  assert.equal(c.emergency._active, null);
});

test('registration rejects malformed email before account creation', async () => {
  const messages = [];
  const context = vm.createContext({ UI: {
    val: id => id === 'regEmail' ? 'invalid-email' : 'sample-passphrase',
    hideAlert() {}, showAlert: (id, message) => messages.push(message)
  } });
  vm.runInContext(read('auth.js'), context);
  await vm.runInContext('Auth.register()', context);
  assert.match(messages[0], /valid email address/);
});

test('staff fetch errors have Retry and do not show false zero-patient counts', async () => {
  for (const [file, module, stats, table] of [
    ['doctor.js', 'Doctor', 'docStats', 'docTbody'], ['hospital.js', 'Hospital', 'hospStats', 'hospTbody']
  ]) {
    const nodes = new Map();
    const context = vm.createContext({
      document: { getElementById: id => { if (!nodes.has(id)) nodes.set(id, {}); return nodes.get(id); } },
      UI: { escape: String }, App: { DEMO: false, profile: {}, fbFetchPatients: async () => { throw new Error('Connection unavailable'); } }
    });
    vm.runInContext(read(file), context);
    await vm.runInContext(`${module}.load()`, context);
    assert.match(nodes.get(stats).textContent, /counts unavailable/);
    assert.match(nodes.get(table).innerHTML, /Connection unavailable/);
    assert.match(nodes.get(table).innerHTML, /Retry/);
    assert.doesNotMatch(nodes.get(table).innerHTML, /No patients assigned/);
  }
});
