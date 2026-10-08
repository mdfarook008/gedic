const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function offline(cached = {}) {
  const events = {};
  const context = vm.createContext({ URL, Response,
    self: { location: { origin: 'https://gedic.example' }, addEventListener: (name, handler) => events[name] = handler },
    fetch: async () => { throw new Error('Offline'); },
    caches: { match: async key => cached[typeof key === 'string' ? key : key.url] }
  });
  vm.runInContext(fs.readFileSync('sw.js', 'utf8'), context);
  return request => {
    let result;
    events.fetch({ request, respondWith: promise => result = promise });
    return result;
  };
}

test('offline shell supports navigation but never substitutes HTML for missing scripts', async () => {
  const shell = new Response('<html>App shell</html>');
  const handle = offline({ './index.html': shell });
  const page = await handle({ method: 'GET', url: 'https://gedic.example/', mode: 'navigate' });
  assert.equal(page, shell);
  const script = await handle({ method: 'GET', url: 'https://gedic.example/missing.js', mode: 'cors' });
  assert.equal(script.status, 503);
  assert.match(await script.text(), /offline/);
});

test('offline handler uses cached assets and never intercepts QR URLs or remote APIs', async () => {
  const asset = new Response('cached code');
  const handle = offline({ 'https://gedic.example/js/app.js': asset });
  assert.equal(await handle({ method: 'GET', url: 'https://gedic.example/js/app.js', mode: 'cors' }), asset);
  assert.equal(handle({ method: 'GET', url: 'https://gedic.example/?view=secret', mode: 'navigate' }), undefined);
  assert.equal(handle({ method: 'GET', url: 'https://firestore.googleapis.com/data' }), undefined);
  assert.equal(handle({ method: 'POST', url: 'https://gedic.example/' }), undefined);
});
