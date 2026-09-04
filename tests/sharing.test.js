const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const load = file => fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');
const profile = {
  name: 'Demo Patient', blood: 'O+', diseases: 'Asthma', allergies: 'None',
  medicines: 'Inhaler', doctorName: 'Demo Doctor', doctorPhone: '9444455566',
  emergencyName: 'Demo Family', emergencyContact: '9876543210', hospital: 'Demo Hospital',
  emergencyEnabled: true, emergencyToken: 'demo-token'
};

function moduleContext(file) {
  const events = [];
  const popup = { location: { replace: url => events.push(['navigate', url]) }, close: () => events.push(['close']) };
  const context = vm.createContext({
    console,
    Location: { getLink: async () => { events.push(['location']); return 'https://maps.example/location'; } },
    getEmergencyURL: token => `https://gedic.example/?view=${token}`,
    window: {
      open: url => { events.push(['open', url]); return popup; },
      location: { href: '' }
    }
  });
  vm.runInContext(load(file), context);
  return { evaluate: expression => vm.runInContext(expression, context), events };
}

test('WhatsApp reserves a tab before waiting for location', async () => {
  const app = moduleContext('whatsapp.js');
  await app.evaluate(`WA.send(${JSON.stringify(profile)}, 'family')`);
  assert.deepEqual(app.events.map(event => event[0]), ['open', 'location', 'navigate']);
  assert.match(app.events[2][1], /^https:\/\/wa\.me\/919876543210\?text=/);
});

test('SMS reserves a tab before waiting for location', async () => {
  const app = moduleContext('sms.js');
  await app.evaluate(`SMS.send(${JSON.stringify(profile)}, 'doctor')`);
  assert.deepEqual(app.events.map(event => event[0]), ['open', 'location', 'navigate']);
  assert.match(app.events[2][1], /^sms:\+919444455566\?body=/);
});
