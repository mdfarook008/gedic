const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('HTML IDs are unique', () => {
  const ids = [...read('index.html').matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});

test('every local stylesheet and script referenced by index exists', () => {
  const html = read('index.html');
  const assets = [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"?#]+)"/g)].map(match => match[1]);
  assert.ok(assets.length > 10);
  assets.forEach(asset => assert.ok(fs.existsSync(path.join(root, asset)), `Missing ${asset}`));
});

test('Firebase config name is consistent and QR reads the public schema', () => {
  assert.match(read('js/firebase-config.js'), /const FIREBASE_CONFIG/);
  assert.match(read('js/app.js'), /collection\("publicProfiles"\)\.doc\(uid\)/);
  assert.match(read('firestore.rules'), /match \/publicProfiles\/\{uid\}/);
  assert.match(read('firestore.rules'), /allow read: if true/);
});

test('QR links contain only a patient key, not medical details', () => {
  const app = read('js/app.js');
  assert.match(app, /encodeURIComponent\(uid\)/);
  assert.doesNotMatch(app, /getEmergencyURL\([^)]*(blood|allergies|medicines)/);
});

test('theme selector provides light, dark, and system choices', () => {
  const html = read('index.html');
  const theme = read('js/theme.js');
  for (const choice of ['light', 'dark', 'system']) {
    assert.match(html, new RegExp(`data-theme-choice="${choice}"`));
  }
  assert.match(theme, /gedic_theme/);
  assert.match(theme, /prefers-color-scheme: dark/);
  assert.match(read('css/main.css'), /html\[data-theme="dark"\]/);
});

test('development server recovers when its preferred port is occupied', () => {
  const server = read('scripts/dev-server.js');
  assert.match(server, /EADDRINUSE/);
  assert.match(server, /activePort \+= 1/);
});

test('authentication clears credentials and guards Firebase auth transitions', () => {
  const app = read('js/app.js');
  const auth = read('js/auth.js');
  assert.match(app, /authFlowActive/);
  assert.match(app, /UI\.clearAuthForms\(\)/);
  assert.match(auth, /DEMO_EMAILS\.has\(email\)/);
  assert.match(auth, /UI\.clearLoginForm\(\)/);
  assert.match(auth, /if \(!credential\.user\.emailVerified\)/);
  assert.match(auth, /sendEmailVerification\(\)/);
  assert.match(auth, /await App\.auth\.signOut\(\)/);
});

test('notifications use an authenticated backend rather than browser secrets', () => {
  const client = read('js/notifications.js');
  const backend = read('functions/index.js');
  assert.match(client, /httpsCallable\("sendAuthNotification"\)/);
  assert.match(backend, /if \(!request\.auth\)/);
  assert.match(backend, /defineSecret\("GMAIL_APP_PASSWORD"\)/);
  assert.match(backend, /defineSecret\("TWILIO_AUTH_TOKEN"\)/);
  assert.doesNotMatch(client, /GMAIL_APP_PASSWORD|TWILIO_AUTH_TOKEN/);
});

test('free Apps Script relay verifies Firebase token and fixes the recipient', () => {
  const client = read('js/notifications.js');
  const relay = read('apps-script/Code.gs');
  assert.match(client, /user\.getIdToken\(\)/);
  assert.match(client, /mode: "no-cors"/);
  assert.match(relay, /accounts:lookup/);
  assert.match(relay, /verifyFirebaseUser\(payload\.idToken\)/);
  assert.match(relay, /to: user\.email/);
  assert.doesNotMatch(relay, /to: payload\.email/);
  assert.doesNotMatch(client, /password/);
});

test('default Firebase deployment remains compatible with the free Spark plan', () => {
  const firebase = JSON.parse(read('firebase.json'));
  const blaze = JSON.parse(read('firebase.blaze.json'));
  assert.equal(firebase.functions, undefined);
  assert.equal(blaze.functions.source, 'functions');
  assert.match(read('js/firebase-config.js'), /cloudNotifications: false/);
  assert.match(read('js/firebase-config.js'), /appsScriptNotificationUrl: "https:\/\/script\.google\.com\/macros\/s\/.+\/exec"/);
});

test('location uses fresh high-accuracy readings and precise Maps coordinates', () => {
  const location = read('js/location.js');
  assert.match(location, /enableHighAccuracy: true/);
  assert.match(location, /maximumAge: 0/);
  assert.match(location, /watchPosition/);
  assert.match(location, /maps\/search\/\?api=1&query=/);
});
