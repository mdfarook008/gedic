# GEDIC — Global Emergency Digital Identity Card

GEDIC is a responsive healthcare web application that gives patients a QR-linked emergency medical profile. A patient manages their record while a first responder can scan the QR and read the intentionally public emergency fields without signing in.

## Requirements

Install these before starting:

- Node.js 18 or newer: <https://nodejs.org/>
- A modern browser such as Chrome, Edge, Firefox, or Safari
- A Firebase project for real authentication and cloud data
- Firebase CLI only when deploying Firestore rules or Firebase Hosting

No `npm install` is needed. The application has no local package dependencies.

## Run locally

Open PowerShell or a terminal in the `gedic-main` directory:

```powershell
cd D:\gedic\gedic-main
npm run dev
```

The terminal prints an address similar to:

```text
GEDIC is running at http://127.0.0.1:4173
```

Open the exact address printed in your terminal. Keep the terminal running while using GEDIC. Press `Ctrl+C` to stop the server.

If port `4173` is already occupied, the server automatically tries `4174`, `4175`, and subsequent ports instead of crashing. For example:

```text
Port 4173 is already in use; trying 4174…
GEDIC is running at http://127.0.0.1:4174
```

Do not open `index.html` by double-clicking it for normal development. Running the local server gives Firebase, clipboard, URL routing, and QR links a proper HTTP origin.

## Demo accounts

If Firebase is unavailable, GEDIC automatically uses local demonstration data. All demo accounts use `demo1234`:

| Role | Email |
| --- | --- |
| Patient | `patient@gedic.app` |
| Doctor | `doctor@gedic.app` |
| Hospital | `hospital@gedic.app` |

Demo data is stored only in that browser's `localStorage`. It is not shared with other devices.

## Theme selector

The appearance selector is fixed near the bottom of the screen:

- **Light** uses the clean indigo healthcare interface.
- **Dark** uses the low-glare navy interface.
- **Auto** follows the operating-system theme and reacts when the system theme changes.

The choice is saved in `localStorage` and restored on the next visit.

## Run the checks

From `gedic-main`:

```powershell
npm test
npm run check
```

`npm test` verifies phone formatting, demonstration authentication and patient CRUD, unique HTML IDs, local assets, theme integration, QR privacy, and the Firestore public-profile contract. `npm run check` validates JavaScript syntax and JSON configuration.

## Connect Firebase

The project configuration is in `js/firebase-config.js`. If using a different Firebase project, replace every value in `FIREBASE_CONFIG` with the Web App configuration shown under **Firebase Console → Project settings → Your apps**.

### Install the Firebase CLI on Windows

The `firebase` command is not included with this project or with Node.js. Install it once from PowerShell:

```powershell
npm install -g firebase-tools
firebase --version
```

If PowerShell still says `firebase is not recognized`, close PowerShell, open a new PowerShell window, return to the project, and retry `firebase --version`. You can also use the CLI without a global installation by prefixing every command with `npx firebase-tools`, for example:

```powershell
npx firebase-tools --version
npx firebase-tools login
npx firebase-tools projects:list
npx firebase-tools use gedic-webapp
```

Do not run both forms of the same command. Choose either the globally installed `firebase ...` commands or the `npx firebase-tools ...` commands.

In Firebase Console:

1. Open **Build → Authentication → Sign-in method**.
2. Enable **Email/Password**.
3. Open **Build → Firestore Database** and create the database.
4. If you have not already done so, install the Firebase CLI:

   ```powershell
   npm install -g firebase-tools
   ```

5. Authenticate and select the project:

   ```powershell
   firebase login
   firebase use gedic-webapp
   ```

6. Deploy the included security rules:

   ```powershell
   firebase deploy --only firestore:rules
   ```

The current QR architecture uses three collections:

| Collection | Purpose | Public? |
| --- | --- | --- |
| `users/{uid}` | Account, role, and private profile data | No |
| `patients/{documentId}` | Authenticated clinical dashboard record | No |
| `publicProfiles/{uid}` | Limited emergency fields opened by a QR scan | Read-only to anonymous scanners |

The QR contains only `index.html?view=<patient-uid>`. It does not embed medical information. Existing patient accounts created with an older GEDIC version should sign in once; sign-in automatically creates the new public emergency document.

## Free Spark-plan deployment

GEDIC defaults to the no-cost Firebase Spark plan. The free configuration provides:

- Email/password signup and login
- Firebase address-verification emails after signup
- Firestore patient and public QR profiles within the free quota
- Firebase static Hosting within the free quota
- On-screen login confirmations
- User-initiated WhatsApp and SMS composer actions

Deploy only the free components:

```powershell
npx firebase-tools deploy --only firestore:rules,hosting
```

If you deploy the website with Vercel, deploy only the Firestore rules through Firebase:

```powershell
npx firebase-tools deploy --only firestore:rules
```

Do not include `functions` in a Spark-plan deployment. The default `firebase.json` intentionally excludes Cloud Functions so a normal Firebase deployment remains compatible with Spark.

Automatic custom emails after every login and automatic SMS cannot run securely in a browser-only Spark application. They require a trusted backend and an SMS provider. Firebase's standard signup verification email remains enabled in free mode.

## Free Gmail login notifications with Google Apps Script

GEDIC includes an optional no-billing Gmail relay in `apps-script/Code.gs`. Google Apps Script verifies the current Firebase ID token, obtains the recipient from Firebase Authentication, and sends only to that authenticated account. The browser cannot choose an arbitrary recipient, and no password is transmitted.

Google currently documents a MailApp limit of 100 email recipients per day for personal Gmail accounts and 1,500 per day for Google Workspace accounts. Quotas can change and are not a delivery guarantee.

### 1. Create the Apps Script

1. Open <https://script.google.com/> while signed into the Gmail account that will send GEDIC notifications.
2. Select **New project** and name it `GEDIC Login Notifications`.
3. Replace the editor contents with the complete contents of `apps-script/Code.gs`.
4. Open **Project Settings → Script properties**.
5. Add a property named `FIREBASE_API_KEY`.
6. Copy the `apiKey` value from `js/firebase-config.js` into that property.

The Firebase web API key identifies the Firebase project; the Firebase ID token proves which authenticated user is requesting the message.

### 2. Deploy the Apps Script web app

1. Select **Deploy → New deployment**.
2. Choose **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone**.
5. Select **Deploy** and authorize MailApp and external-request access.
6. Copy the deployed URL ending in `/exec`.

For a new personal Apps Script project, Google may show **Google hasn't verified this app** because MailApp and external requests use sensitive OAuth scopes. If the developer email shown is your own Google account and you created/reviewed this exact script, select **Advanced → Go to GEDIC Login Notifications (unsafe) → Allow**. Only the script owner performs this authorization when the web app executes as **Me**; GEDIC visitors do not authorize access to your Gmail account. Do not continue if the developer email or project name is unfamiliar.

### 3. Connect it to GEDIC

Open `js/firebase-config.js` and paste the `/exec` URL:

```js
const GEDIC_FEATURES = Object.freeze({
  cloudNotifications: false,
  appsScriptNotificationUrl: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
});
```

Commit and push this change to GitHub so Vercel redeploys it. The Apps Script URL is an endpoint, not a Gmail credential. The relay still rejects requests without a valid Firebase ID token.

The relay sends:

- A welcome notification after a real Firebase signup
- A security notification after a verified Firebase login
- At most one login notification per user every five minutes

Because the browser uses a cross-origin fire-and-forget request, GEDIC can confirm that the request was queued but cannot prove inbox delivery. Check **Apps Script → Executions** to diagnose rejected tokens, exhausted quotas, or MailApp errors.

## Improve verification-email visibility

Inbox or spam placement is controlled by the recipient's email provider and cannot be guaranteed by JavaScript or Firebase. Improve recognition using these steps:

1. Open **Firebase Console → Authentication → Templates → Email address verification**.
2. Change the sender name to `GEDIC Security`.
3. Use a clear subject such as `Verify your GEDIC emergency identity`.
4. Set a monitored reply-to address if Firebase offers that field in your console.
5. Mention the `GEDIC` name, why verification is required, and that the user initiated the signup.
6. During testing, open the message, select **Not spam**, and add the sender to contacts.
7. Avoid excessive resend attempts; repeated identical mail can harm sender reputation.

Using a custom domain for the verification action link can also make the message more recognizable. Firebase supports custom email action handlers, but it still cannot guarantee inbox placement.

## Optional Blaze Gmail/SMS backend

The optional backend is retained in `functions/index.js` and `firebase.blaze.json` for a future upgrade. Provider credentials stay in Firebase Secret Manager and are never placed in browser JavaScript. It is disabled by default through `GEDIC_FEATURES.cloudNotifications` in `js/firebase-config.js`.

You need:

- A Gmail account with two-step verification enabled
- A Gmail App Password (do not use the normal Gmail password)
- A Twilio account and SMS-capable Twilio phone number
- Firebase Cloud Functions enabled on the Blaze billing plan

Set the five secrets one at a time:

```powershell
firebase functions:secrets:set GMAIL_USER
firebase functions:secrets:set GMAIL_APP_PASSWORD
firebase functions:secrets:set TWILIO_ACCOUNT_SID
firebase functions:secrets:set TWILIO_AUTH_TOKEN
firebase functions:secrets:set TWILIO_FROM_NUMBER
```

Enter values in these formats:

```text
GMAIL_USER: your-address@gmail.com
GMAIL_APP_PASSWORD: the 16-character Google App Password
TWILIO_ACCOUNT_SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN: your Twilio auth token
TWILIO_FROM_NUMBER: +1xxxxxxxxxx (or another SMS-capable Twilio number)
```

Install and deploy the backend:

```powershell
cd D:\gedic\gedic-main\functions
npm install
cd ..
npx firebase-tools deploy --config firebase.blaze.json --only functions,firestore:rules
```

After the optional function is deployed, change this setting in `js/firebase-config.js`:

```js
const GEDIC_FEATURES = Object.freeze({ cloudNotifications: true });
```

New Firebase accounts receive the standard Firebase verification email plus the custom GEDIC welcome notification. Successful logins request a security notification. Login notifications have a five-minute server-side cooldown. SMS is sent only when the user supplies a valid **Account mobile for GEDIC alerts** during registration.

Twilio trial accounts may send only to recipient numbers verified in Twilio. Gmail or Twilio provider failure does not block login; open the browser console and Firebase Function logs when diagnosing notification delivery.

## Authentication troubleshooting

- Returning to the landing page clears login and registration credentials.
- Published demo emails always use the local demonstration database, even while Firebase is online.
- Real Firebase accounts must open the email-verification link before GEDIC permits dashboard access. An unverified login sends a fresh link and signs the account out.
- The account mobile field is format-validated only in free Spark mode. It is not proof that the user owns that number. Genuine SMS OTP verification requires a billed phone-verification/backend provider and is intentionally not represented as active.
- If Firebase accepts the password but GEDIC says the profile is missing, deploy `firestore.rules` and confirm `users/{uid}` exists.
- If an older patient can sign in but QR synchronization is pending, deploy the rules and save the patient profile again.
- Browser password managers can independently offer saved credentials. GEDIC clears its input values and disables normal field autocomplete, but removing credentials saved in the browser must be done in the browser's password manager.

## Precise location sharing

GEDIC requests a new high-accuracy GPS reading whenever a map link is opened or copied. It samples readings for up to 12 seconds, selects the reading with the smallest reported accuracy radius, and opens this form of Google Maps URL:

```text
https://www.google.com/maps/search/?api=1&query=<latitude>,<longitude>
```

For the best result:

1. Use the deployed HTTPS Vercel URL or localhost; browser geolocation does not work on ordinary insecure HTTP pages.
2. Enable the device's GPS/location service.
3. Grant GEDIC location permission and choose **Precise location** when the operating system offers that choice.
4. Test outdoors or near a window if the reported accuracy is poor.

The app displays the browser/device accuracy estimate, such as `approximately ±15 m`. No website can guarantee an exact physical address: GPS accuracy depends on the handset, satellite visibility, operating-system privacy settings, and whether the browser falls back to Wi-Fi or network positioning. GEDIC shares the coordinate pin rather than guessing an address through a third-party geocoder.

## Verify a real QR code

1. Sign in as a patient using the deployed website.
2. Complete and save the medical profile.
3. Open the QR tab and download or display the QR.
4. Use a second phone or a private browser window where nobody is signed in.
5. Scan the QR and confirm that the emergency profile appears.
6. Edit the patient record, scan again, and confirm the updated information appears.

If the emergency page reports that the profile cannot load, inspect the browser console. A `403` response means `firestore.rules` has not been deployed to the Firebase project. A profile-not-found result usually means the patient has not signed in since the public-profile migration was added.

## Deploy

### Firebase Hosting

```powershell
npx firebase-tools deploy --only hosting,firestore:rules
```

### Vercel

Deploy `gedic-main` as a static site. The included `vercel.json` sends application routes back to `index.html`. Firestore rules are not deployed by Vercel, so run the Firebase rules command separately.

## Healthcare and privacy notice

The public emergency document can contain health and contact information because unauthenticated QR scanning is the purpose of GEDIC. Obtain explicit patient consent, minimize collected data, publish a privacy policy, and review the healthcare and privacy laws that apply to the deployment location. GEDIC is not a substitute for clinical records, medical advice, or local emergency services.
