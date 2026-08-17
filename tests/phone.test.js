const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'phone.js'), 'utf8');
const context = vm.createContext({ console });
vm.runInContext(source, context);
const call = expression => vm.runInContext(expression, context);

test('normalizes supported Indian mobile formats', () => {
  assert.equal(call(`Phone.clean('+91 98765 43210')`), '9876543210');
  assert.equal(call(`Phone.clean('09876543210')`), '9876543210');
});

test('validates mobile length and prefix', () => {
  assert.equal(call(`Phone.validate('9876543210').ok`), true);
  assert.equal(call(`Phone.validate('12345').ok`), false);
  assert.equal(call(`Phone.validate('5876543210').ok`), false);
});

test('formats a normalized number for emergency display', () => {
  assert.equal(call(`Phone.format('9876543210')`), '+91 98765 43210');
});
