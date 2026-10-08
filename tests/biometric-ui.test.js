const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function workflow(demo, enabled = false) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', checked: false, hidden: true, textContent: '', disabled: false, focus() {} });
    return nodes.get(id);
  };
  const audits = [];
  const renders = [];
  const routes = [];
  const context = vm.createContext({
    document: { getElementById: node },
    App: { DEMO: demo, user: { uid: 'responder-demo' }, role: 'responder', go: page => routes.push(page) },
    GEDIC_FEATURES: { biometricEmergencyAccess: enabled },
    DB: {
      getAllPatients: () => [{ uid: 'sample-patient', name: 'Sample patient' }],
      recordEmergencyAccess: event => { audits.push(event); return { id: 'demo-audit' }; }
    },
    Emergency: { render: (...args) => renders.push(args) },
    window: {},
    setTimeout: callback => { callback(); return 1; }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/biometric.js'), 'utf8'), context);
  return { ui: vm.runInContext('BiometricEmergency', context), node, audits, renders, routes };
}

test('demo access explains simulation and never pre-confirms the request', () => {
  const { ui, node } = workflow(true);
  ui.configure();
  assert.equal(node('bioDemoHelp').hidden, false);
  assert.match(node('bioStart').textContent, /Open demo profile/);
  assert.match(node('bioMatchHelp').textContent, /No device or biometric information/);
  ui.fillDemo();
  assert.equal(node('bioIncident').value, 'DEMO-001');
  assert.equal(node('bioAttest').checked, false);
});

test('sample autofill cannot alter a production request and unavailable access stays disabled', () => {
  const { ui, node } = workflow(false);
  node('bioIncident').value = 'REAL-123';
  ui.configure();
  ui.fillDemo();
  assert.equal(node('bioDemoHelp').hidden, true);
  assert.equal(node('bioStart').disabled, true);
  assert.equal(node('bioIncident').value, 'REAL-123');
});

test('demo request requires explicit confirmation before releasing a sample profile', async () => {
  const { ui, node, audits, renders } = workflow(true);
  ui.fillDemo();
  await ui.start();
  assert.match(node('bioStatus').textContent, /Tick the confirmation box/);
  assert.equal(audits.length, 0);
  assert.equal(renders.length, 0);
});

test('confirmed demo opens only the sample workflow and records simulated access', async () => {
  const { ui, node, audits, renders, routes } = workflow(true);
  ui.fillDemo();
  node('bioAttest').checked = true;
  await ui.start();
  assert.equal(audits.length, 1);
  assert.equal(audits[0].method, 'simulated-biometric');
  assert.equal(audits[0].incidentRef, 'DEMO-001');
  assert.equal(renders[0][0].uid, 'sample-patient');
  assert.equal(renders[0][2].mode, 'demo');
  assert.deepEqual(routes, ['pg-emergency']);
  assert.equal(node('bioStart').disabled, false);
});

test('production access without hardware fails without releasing a patient', async () => {
  const { ui, node, audits, renders } = workflow(false, true);
  node('bioIncident').value = 'CASE-123';
  node('bioReason').value = 'Emergency request for immediate care.';
  node('bioAttest').checked = true;
  await ui.start();
  assert.match(node('bioStatus').textContent, /No approved scanner bridge/);
  assert.equal(audits.length, 0);
  assert.equal(renders.length, 0);
  assert.equal(node('bioStart').disabled, false);
});
