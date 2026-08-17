const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createLocation(reading) {
  const context = vm.createContext({
    console, setTimeout, clearTimeout,
    navigator: {
      geolocation: {
        watchPosition: success => {
          setTimeout(() => success({ coords: reading }), 0);
          return 7;
        },
        clearWatch() {}
      },
      clipboard: { writeText: async () => {} }
    },
    window: { open: () => null, location: {} },
    UI: { toast() {} },
    prompt() {}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'location.js'), 'utf8'), context);
  return expression => vm.runInContext(expression, context);
}

test('captures a fresh high-accuracy GPS reading', async () => {
  const evaluate = createLocation({ latitude: 13.0826802, longitude: 80.2707184, accuracy: 12 });
  const result = await evaluate('Location.get()');
  assert.equal(result.lat, 13.0826802);
  assert.equal(result.lng, 80.2707184);
  assert.equal(result.accuracy, 12);
});

test('creates a precise Google Maps coordinate link', () => {
  const evaluate = createLocation({ latitude: 0, longitude: 0, accuracy: 10 });
  assert.equal(
    evaluate('Location.mapsUrl(13.0826802, 80.2707184)'),
    'https://www.google.com/maps/search/?api=1&query=13.082680,80.270718'
  );
});
