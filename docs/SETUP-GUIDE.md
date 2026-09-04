# GEDIC Free-Tier Setup Guide

This guide sets up the safe, QR-based GEDIC deployment using Firebase Authentication, Firestore, indexes, and Hosting on the Spark plan. It does not enable real biometric matching, Cloud Functions, automatic SMS, or other paid services.

## 1. Prerequisites

- Node.js 18 or newer
- A modern browser
- A Google account
- A Firebase project on the Spark plan
- Firebase CLI
- Java only if you want to run the Firestore emulator

Install and verify the Firebase CLI:

```powershell
npm install -g firebase-tools
firebase --version
firebase login
```

You can use `npx firebase-tools` instead of a global installation. Use one form consistently.

## 2. Run GEDIC locally

Open PowerShell in the repository:

```powershell
cd D:\gedic-main
npm run dev
```

Open the address printed by the command, normally `http://127.0.0.1:4173`.

Localhost starts in demo mode. Use one of these URLs:

- `http://127.0.0.1:4173/?demo=1` for explicit demo mode
- `http://127.0.0.1:4173/?live=1` to test the configured Firebase project

Demo accounts use password `demo1234`:

| Role | Email |
| --- | --- |
| Patient | `patient@gedic.app` |
| Doctor | `doctor@gedic.app` |
| Hospital | `hospital@gedic.app` |
| Responder | `responder@gedic.app` |

Demo records and passwords exist only in browser `localStorage`. Never use demo mode for real medical information.

## 3. Create the Firebase project

1. Open the Firebase Console.
2. Select **Create a project**.
3. Keep the project on the no-cost Spark plan.
4. Analytics is optional and is not required by GEDIC.
5. Under **Project settings → Your apps**, add a Web app.
6. Copy the Firebase Web App configuration.

The Firebase Web API key identifies the project but is not an administrator credential. Service-account JSON files and provider secrets are sensitive and must never be copied into frontend files.

## 4. Configure Authentication

1. Open **Build → Authentication**.
2. Select **Get started**.
3. Under **Sign-in method**, enable **Email/Password**.
4. Under **Settings → Authorised domains**, confirm the Firebase Hosting domain and every production domain you intend to use.
5. Review **Templates → Email address verification** and set a recognisable sender name and subject.

GEDIC rejects unverified Firebase sessions. Public registration creates patient accounts only.

## 5. Configure Firestore

1. Open **Build → Firestore Database**.
2. Create the database in production mode.
3. Choose a region appropriate for the intended users and legal requirements. Moving regions later is difficult.
4. Do not create permissive test rules.

The repository contains:

- `firestore.rules` for patient, staff, organisation, QR, and backend collection access;
- `firestore.indexes.json` for the doctor care-team query.

## 6. Connect the web app

Open `js/firebase-config.js` and replace `FIREBASE_CONFIG` with the values from **Project settings → Your apps**:

```javascript
const FIREBASE_CONFIG = Object.freeze({
  apiKey: "YOUR_WEB_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
});
```

Keep the free feature defaults:

```javascript
const GEDIC_FEATURES = Object.freeze({
  cloudNotifications: false,
  biometricEmergencyAccess: false,
  appCheckRecaptchaSiteKey: "",
  appsScriptNotificationUrl: ""
});
```

An Apps Script notification endpoint is optional. Remove any example or previous endpoint if you do not operate and trust it.

## 7. Select the Firebase project

From the repository root:

```powershell
firebase use --add
```

Select the project and assign an alias such as `default`. Verify it before deployment:

```powershell
firebase use
firebase projects:list
```

## 8. Run validation

```powershell
npm test
npm run check
```

Expected result:

- all tests pass;
- JavaScript syntax validation passes;
- JSON configurations parse successfully.

To compile the rules in a local Firestore emulator:

```powershell
firebase emulators:exec --only firestore 'node -e "console.log(123)"'
```

Java is required for this optional check.

## 9. Deploy the free Firebase components

Deploy rules, indexes, and Hosting together:

```powershell
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

Do not deploy `functions` on the Spark plan. The default `firebase.json` intentionally has no Functions deployment section.

After deployment, record the HTTPS Hosting URL and add any custom production domain to Firebase Authentication's authorised domains.

## 10. Create the first patient

1. Open the deployed HTTPS site.
2. Register as Patient.
3. Use a passphrase of at least 12 characters.
4. Open the email verification link.
5. Sign in and complete the profile.
6. Enable emergency sharing only after reading the consent text.
7. Save and open the QR tab.
8. Scan the QR in a private browser window to confirm anonymous direct access.
9. Disable sharing and confirm the old link stops working.
10. Re-enable, rotate the token, and confirm the previous link remains invalid.

## 11. Provision free staff accounts

Staff roles cannot be selected during public registration. Use the Admin SDK scripts only from a trusted administrator computer.

### 11.1 Create and verify the Auth user

1. In **Firebase Authentication → Users**, create the professional's email/password account.
2. Have the professional attempt a GEDIC sign-in once to receive the verification email.
3. The professional opens the verification link.
4. Do not share permanent passwords through email or chat.

### 11.2 Obtain administrator credentials

1. Open **Project settings → Service accounts**.
2. Generate a new private key for a dedicated administrative environment.
3. Save it outside the repository in a restricted folder.
4. Never commit, upload, or send this JSON file.

Install the administrator script dependencies:

```powershell
cd D:\gedic-main\functions
npm install
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\secure\gedic-admin.json"
```

Activate an existing verified staff user:

```powershell
npm run provision-staff -- clinician@example.org doctor hospital_001 "Dr Example"
```

Allowed roles are `doctor`, `hospital`, and `responder`. Use a stable organisation ID containing letters, numbers, `_`, or `-`.

The script refuses to convert a patient into staff. Professionals should use a separate work account.

### 11.3 Assign a patient to an organisation and doctors

The patient must already have a GEDIC patient account. Then run:

```powershell
npm run assign-patient -- patient@example.org hospital_001 clinician@example.org
```

You may include multiple verified doctor emails after the organisation ID. The script verifies that every doctor is active in the same organisation.

Clear the credential variable when administration is complete:

```powershell
Remove-Item Env:GOOGLE_APPLICATION_CREDENTIALS
```

Store or destroy the key according to the organisation's credential policy.

## 12. Optional free App Check

The client can activate Firebase App Check when `appCheckRecaptchaSiteKey` is configured. Before enforcing App Check:

1. Register the web app in Firebase App Check.
2. Configure the supported reCAPTCHA provider and production domains.
3. Put only the public site key in `js/firebase-config.js`.
4. Test from the production domain.
5. Review App Check metrics.
6. Enable enforcement for Firestore only after legitimate requests are receiving valid tokens.

Check current Firebase and reCAPTCHA quotas before enabling enforcement. Do not put a secret key in the browser configuration.

## 13. Optional Gmail notification relay

The repository contains `apps-script/Code.gs` for a no-billing, quota-limited Gmail notification relay. It is not required for GEDIC and is not suitable as a guaranteed emergency notification channel.

If you use it:

1. Review the complete script yourself.
2. Create a Google Apps Script project under an organisation-controlled account.
3. Add `FIREBASE_API_KEY` as a Script Property.
4. Deploy the script as a Web app executing as the owner.
5. Put the `/exec` URL in `appsScriptNotificationUrl`.
6. Test token rejection, quota exhaustion, and delivery failure.

The app's WhatsApp and SMS buttons remain user-initiated device composer actions and require no paid messaging integration.

## 14. Vercel alternative

Vercel can host the static web files, but Firestore rules and indexes must still be deployed through Firebase:

```powershell
firebase deploy --only firestore:rules,firestore:indexes
```

Deploy the repository as a static Vercel project. The included `vercel.json` supplies security headers and SPA routing, and `.vercelignore` excludes backend and development files.

## 15. Production verification checklist

- HTTPS site loads without browser errors.
- Registration permits only Patient.
- Email verification is mandatory.
- QR sharing is off until selected by the patient.
- Public QR works in a signed-out private browser.
- Public collection enumeration is denied.
- Disabling sharing revokes access.
- Rotating the token invalidates the old card.
- Hospital sees only its organisation.
- Doctor sees only assigned patients in that organisation.
- Inactive staff cannot enter a staff dashboard.
- Production Firebase failure does not show demo data.
- Real biometric matching remains disabled.
- Security headers are present on deployed responses.
- No service-account JSON, email password, API secret, or biometric data exists in the deployed files.

## 16. Troubleshooting

### Firebase CLI is not recognised

Open a new terminal after global installation or use `npx firebase-tools`.

### Permission denied from Firestore

- Deploy `firestore.rules`.
- Verify the signed-in user's document.
- For staff, check `staffStatus` and `organisationId`.
- For doctors, check `careTeamUids`.

### Firestore requests an index

Deploy `firestore.indexes.json` using the command in section 9.

### Account is valid but profile is missing

Confirm that `users/{uid}` exists. Patient registration creates `patients/{uid}` atomically. Staff documents must be created using the provisioning script.

### Firebase works in production but localhost shows demo data

Use `http://127.0.0.1:4173/?live=1`.

### QR profile is unavailable

Confirm sharing is enabled, rules are deployed, and the QR contains the current token. Older links stop working after rotation.

### CSP blocks a new dependency

Do not weaken the policy with unrestricted sources or inline scripts. Add only a pinned, trusted source to the CSP in `firebase.json`, `firebase.blaze.json`, and `vercel.json`, then retest.

## 17. Backups and operations

The Spark plan is suitable for prototypes and limited deployments, not a complete regulated healthcare operating model. Before handling real medical information, establish:

- a lawful basis and privacy notice;
- patient consent and withdrawal procedures;
- access and staff-offboarding reviews;
- backup, restore, retention, and deletion procedures;
- incident response and breach notification;
- clinical safety review and penetration testing;
- usage monitoring and a plan for quota exhaustion;
- jurisdiction-specific legal approval.

See `SECURITY-ARCHITECTURE.md` for the biometric threat model and non-code requirements.

