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

test('QR generation is self-hosted and the landing demo does not query production Firebase', () => {
  const html = read('index.html');
  const app = read('js/app.js');
  assert.match(html, /src="js\/vendor\/qrcode\.min\.js"/);
  assert.doesNotMatch(html, /cdn\.jsdelivr\.net\/npm\/qrcodejs/);
  assert.match(app, /function loadDemoEmergencyView\(\)/);
  assert.match(app, /function demoView\(\) \{ App\.loadDemoEmergencyView\(\); \}/);
});

test('a failed emergency lookup clears stale patient state and disables disclosure actions', () => {
  const emergency = read('js/emergency.js');
  assert.match(emergency, /if \(!profile\) \{\s*active = null;/);
  assert.match(emergency, /No patient data was released/);
  assert.match(emergency, /setProfileActionsEnabled\(false\)/);
  assert.match(emergency, /detailIds\.forEach/);
});

test('README links to complete user and free-tier setup manuals', () => {
  const readme = read('README.md');
  for (const document of ['docs/USER-MANUAL.md', 'docs/SETUP-GUIDE.md', 'SECURITY-ARCHITECTURE.md']) {
    assert.ok(fs.existsSync(path.join(root, document)), `Missing ${document}`);
    assert.match(readme, new RegExp(document.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  const firebase = JSON.parse(read('firebase.json'));
  assert.ok(firebase.hosting.ignore.includes('docs/**'), 'Firebase Hosting must not publish internal manuals');
  assert.match(read('.vercelignore'), /^docs$/m);
});

test('Firebase config name is consistent and QR uses random, revocable public tokens', () => {
  assert.match(read('js/firebase-config.js'), /const FIREBASE_CONFIG/);
  assert.match(read('js/app.js'), /collection\("publicProfiles"\)\.doc\(token\)/);
  assert.match(read('js/app.js'), /crypto\.getRandomValues/);
  assert.match(read('firestore.rules'), /match \/publicProfiles\/\{token\}/);
  assert.match(read('firestore.rules'), /allow get: if resource\.data\.enabled == true/);
  assert.match(read('firestore.rules'), /allow list: if false/);
});

test('QR links contain only a patient key, not medical details', () => {
  const app = read('js/app.js');
  assert.match(app, /new URLSearchParams\(\{ view: uid \}\)/);
  assert.match(app, /isPublishedDemo/);
  assert.doesNotMatch(app, /getEmergencyURL\([^)]*(blood|allergies|medicines)/);
});

test('production does not silently substitute local medical demo data', () => {
  const app = read('js/app.js');
  const auth = read('js/auth.js');
  assert.match(app, /Cloud medical records are unavailable; no demo data was substituted/);
  assert.match(auth, /Production registration will not fall back to browser-only storage/);
});

test('patient writes are atomic and security-controlled fields cannot be changed by staff', () => {
  const patient = read('js/patient.js');
  const auth = read('js/auth.js');
  const rules = read('firestore.rules');
  assert.match(patient, /const batch = App\.db\.batch\(\)/);
  assert.match(auth, /const batch = App\.db\.batch\(\)/);
  assert.match(rules, /function onlyClinicalFieldsChanged\(\)/);
  assert.doesNotMatch(rules.match(/function onlyClinicalFieldsChanged\(\)[\s\S]*?\n    }/)[0], /emergencyToken|emergencyEnabled/);
});

test('staff access is active, organisation-scoped, and assignment-scoped for doctors', () => {
  const rules = read('firestore.rules');
  assert.match(rules, /staffStatus == 'active'/);
  assert.match(rules, /sameOrganisation\(resource\.data\)/);
  assert.match(rules, /assignedDoctor\(resource\.data\)/);
  assert.match(read('functions/scripts/provision-staff.js'), /Refusing to convert a patient account/);
  assert.match(read('functions/scripts/assign-patient.js'), /careTeamUids/);
  const indexes = JSON.parse(read('firestore.indexes.json'));
  assert.ok(indexes.indexes.some(index => index.collectionGroup === 'patients'
    && index.fields.some(field => field.fieldPath === 'careTeamUids' && field.arrayConfig === 'CONTAINS')));
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
  assert.match(app, /if \(!fbUser\.emailVerified\)/);
  assert.match(app, /account\.staffStatus !== "active"/);
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

test('cardless biometric access uses a protected backend contract', () => {
  const html = read('index.html');
  const client = read('js/biometric.js');
  const backend = read('functions/index.js');
  const rules = read('firestore.rules');
  assert.match(html, /Cardless Emergency Access/);
  assert.match(html, /It is not real biometric identification/);
  assert.match(client, /window\.GEDIC_SCANNER\.capture/);
  assert.match(client, /createBiometricChallenge/);
  assert.match(client, /resolveBiometricEmergency/);
  assert.doesNotMatch(client, /getUserMedia|camera|fingerprintImage/);
  assert.match(backend, /enforceAppCheck: true/);
  assert.match(read('js/firebase-config.js'), /firebase\.appCheck\(\)\.activate/);
  assert.match(backend, /randomBytes\(32\)/);
  assert.match(backend, /BIOMETRIC_GATEWAY_SIGNING_KEY/);
  assert.match(backend, /publicSnapshot\.data\(\)\?\.enabled !== true/);
  assert.match(backend, /state: "consumed"/);
  assert.match(backend, /minimumEmergencyProfile/);
  assert.match(backend, /emergencyAccessLogs/);
  assert.match(rules, /staffStatus == 'active'/);
  assert.match(rules, /request\.resource\.data\.role == 'patient'/);
  assert.match(rules, /match \/emergencyAccessLogs\/\{id\} \{ allow read, write: if false; \}/);
});

test('hosting sends baseline browser and transport security headers', () => {
  const firebase = JSON.parse(read('firebase.json'));
  const vercel = JSON.parse(read('vercel.json'));
  const firebaseKeys = firebase.hosting.headers[0].headers.map(header => header.key);
  const vercelKeys = vercel.headers[0].headers.map(header => header.key);
  for (const key of ['Strict-Transport-Security', 'Content-Security-Policy', 'X-Content-Type-Options', 'X-Frame-Options']) {
    assert.ok(firebaseKeys.includes(key), `Firebase missing ${key}`);
    assert.ok(vercelKeys.includes(key), `Vercel missing ${key}`);
  }
  const policies = [firebase, vercel].map(config => config.hosting?.headers?.[0]?.headers || config.headers[0].headers)
    .map(headers => headers.find(header => header.key === 'Content-Security-Policy').value);
  policies.forEach(policy => {
    assert.match(policy, /script-src-attr 'none'/);
    assert.doesNotMatch(policy.match(/script-src [^;]+/)[0], /unsafe-inline/);
  });
  assert.doesNotMatch(read('index.html'), /\son(?:click|input|keydown)=/);
  assert.ok(firebase.hosting.ignore.includes('functions/**'));
  assert.match(read('.vercelignore'), /functions/);
});
