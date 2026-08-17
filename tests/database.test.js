const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createDatabase() {
  const values = new Map();
  const localStorage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
  const context = vm.createContext({ localStorage, console, Date, JSON });
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'db.js'), 'utf8');
  vm.runInContext(source, context);
  return expression => vm.runInContext(expression, context);
}

test('seeds and authenticates the demonstration patient', () => {
  const db = createDatabase();
  db('DB.seed()');
  assert.equal(db(`DB.login('patient@gedic.app', 'demo1234').ok`), true);
  assert.equal(db(`DB.getPatientByUid('demo-uid-p1').blood`), 'B+');
});

test('creates, updates, and deletes a patient record', () => {
  const db = createDatabase();
  db('DB.seed()');
  const id = db(`DB.addPatient({name:'Test Patient', blood:'O+'})`);
  assert.equal(db(`DB.getPatientByUid('${id}').name`), 'Test Patient');
  assert.equal(db(`DB.updatePatient('${id}', {allergies:'Latex'})`), true);
  assert.equal(db(`DB.getPatientByUid('${id}').allergies`), 'Latex');
  db(`DB.deletePatient('${id}')`);
  assert.equal(db(`DB.getPatientByUid('${id}')`), null);
});
