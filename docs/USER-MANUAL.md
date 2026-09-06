# GEDIC User Manual

This manual explains how patients, doctors, hospitals, responders, and administrators use GEDIC. It describes the free production configuration included in this repository.

## 1. What GEDIC does

GEDIC stores a private patient record and can publish a patient-approved emergency summary through a random, revocable QR link. A person scanning that QR does not need a GEDIC account.

GEDIC is an emergency information aid, not a clinical record system or medical device. Always confirm the person's identity and clinically verify important information before treatment.

## 2. Access methods

| Situation | Supported method |
| --- | --- |
| Patient has their phone or printed card | Scan the emergency QR |
| Patient can communicate | Ask the patient or emergency contact to open their QR |
| Patient has no card and cannot communicate | Follow normal emergency identification procedures |
| Cardless biometric demonstration | Available only in local demo mode |
| Real cardless biometric identification | Requires prior patient enrolment, certified hardware, liveness detection, a governed 1:N provider, and a trusted paid backend |

A phone fingerprint reader or Face ID can authenticate the owner of that phone. It cannot search all patients and identify an unknown unconscious person.

## 3. Open the app

Use the HTTPS address supplied by the GEDIC administrator. Do not use an unofficial copy of the page.

The theme control at the bottom of the screen offers:

- Light mode
- Dark mode
- Auto, which follows the device setting

## 4. Patient guide

### 4.1 Create an account

1. Select **Register Free**.
2. Keep **Patient** selected. Doctor, hospital, and responder accounts are administrator-provisioned.
3. Enter an email address, a passphrase of at least 12 characters, and an optional account phone number.
4. Enter the medical information you want GEDIC to store.
5. Read the emergency-sharing consent carefully.
6. Select the sharing checkbox only if you want an unauthenticated QR holder to see the emergency summary.
7. Select **Create GEDIC Account**.
8. Open the Firebase verification email and verify the address.
9. Return to GEDIC and sign in.

If the verification email is missing, check spam and verify that the address was entered correctly. Signing in before verification requests another verification message.

### 4.2 Understand the patient dashboard

The dashboard contains four tabs:

- **Profile** shows the stored medical identity.
- **QR Card** displays and manages public emergency access.
- **Emergency** provides call, message, location, and print actions.
- **Edit** updates the profile and public-sharing choice.

### 4.3 Update medical information

1. Open **Edit**.
2. Review the name, date of birth, blood group, conditions, allergies, medicines, emergency contact, and doctor.
3. Confirm whether emergency QR sharing should remain enabled.
4. Select **Save to Database**.

Patient edits are labelled **patient-reported**. Empty phone fields remove the old phone number. Age is calculated from date of birth.

### 4.4 Enable or disable emergency sharing

1. Open **Edit**.
2. Select or clear **Enable public emergency QR sharing**.
3. Save the profile.

When sharing is disabled, GEDIC removes the public emergency document. The private patient record remains available to the patient and authorised care team.

### 4.5 Use the QR card

When sharing is enabled, open **QR Card**. You can:

- show the QR on the phone;
- download the QR image;
- copy the emergency link;
- print a wallet card;
- select **Revoke & Rotate** to invalidate the old link and create a new one.

Treat the QR link like sensitive information. Anyone holding the current link can read the published emergency summary. Rotate it if a card, screenshot, or link is lost or shared with the wrong person.

### 4.6 Emergency actions

The Emergency tab can:

- call the saved emergency contact;
- call the saved doctor;
- call India's 108 emergency number;
- open a WhatsApp or SMS composer;
- request a fresh device location and open or copy a Google Maps link;
- print the emergency card.

WhatsApp and SMS are not sent automatically. Review the recipient and message in the device composer. Messages may contain medical details, the public link, and precise location and cannot be recalled by GEDIC.

## 5. Public emergency QR guide

1. Scan the QR with the device camera.
2. Confirm that the URL is the official GEDIC HTTPS domain.
3. Review **Safety and provenance**, including record status and last-updated time.
4. Confirm the patient's identity using available evidence.
5. Treat allergies, medicines, conditions, and blood group as unverified until checked through appropriate clinical procedures.
6. Use the displayed contact and emergency actions only when needed.

If the page says the profile is unavailable, the link may have been disabled, rotated, typed incorrectly, or removed.

## 6. Doctor guide

Doctors cannot self-register. An administrator must verify the account, activate it, assign an organisation, and add the doctor's UID to each patient's care team.

After signing in:

1. The dashboard lists only patients assigned to that doctor within the same organisation.
2. Select **View** to open the authenticated clinical view.
3. Use the phone button only for a legitimate care purpose.
4. Confirm provenance and identity before relying on any value.

Doctors cannot change patient ownership, organisation assignment, care-team assignment, QR consent, or the QR token through the app.

## 7. Hospital guide

Hospital accounts are also administrator-provisioned. The hospital dashboard lists patients linked to that verified organisation.

Hospital staff can:

- review organisation-linked patient records;
- open the authenticated clinical view;
- update permitted clinical fields.

Hospital staff cannot create a patient identity on the patient's behalf, delete a patient's account, move a patient between organisations, change the care team, or enable public QR sharing. Patient onboarding and consent must remain patient-controlled.

## 8. Responder and biometric guide

The free production build disables real biometric matching. Local demo mode contains a clearly labelled simulation for explaining the proposed workflow.

A legitimate production biometric attempt would require the responder to:

1. Sign in with an active, verified responder account.
2. Enter a unique incident reference.
3. record a specific emergency reason.
4. Confirm that the access is necessary and audited.
5. Use a registered scanner that performs liveness detection.
6. Review the minimum emergency record returned by the governed matching service.

Never upload fingerprint photographs, face photographs, biometric templates, Aadhaar data, or scanner output directly to this webpage or Firestore.

## 9. Administrator operations

Administrators should follow the separate [Setup Guide](SETUP-GUIDE.md).

Important recurring tasks include:

- verifying professional identity and organisation membership before activating staff;
- using separate professional and patient accounts;
- assigning only the minimum required care team;
- disabling staff access immediately when employment or duties end;
- reviewing Firebase usage and authentication activity;
- testing QR enable, disable, and rotation behaviour after deployments;
- maintaining a privacy notice, incident-response process, retention policy, and access-review schedule.

## 10. Privacy and safety checklist

- Collect only information needed for emergency care.
- Do not place private notes in public emergency fields.
- Obtain informed consent before enabling QR sharing.
- Rotate a compromised emergency link immediately.
- Do not cache or photograph emergency records unless policy and law permit it.
- Never make transfusion, prescribing, or treatment-withholding decisions from GEDIC alone.
- Report incorrect data to the patient or responsible organisation.
- Use the official HTTPS site to reduce man-in-the-middle risk.

## 11. Troubleshooting

### Sign-in fails

- Confirm the email and password.
- Verify the email address.
- Ask an administrator whether the staff account is active.
- Confirm internet connectivity; production does not fall back to local demo records.

### No patients appear for a doctor

- Confirm the doctor and patient share the same `organisationId`.
- Confirm the doctor's UID is present in the patient's `careTeamUids`.
- Confirm `firestore.indexes.json` was deployed.

### QR is not shown

- Open Edit and enable emergency sharing.
- Save the profile.
- Reload the QR tab.

### A previously printed QR no longer works

The patient probably disabled sharing or rotated the token. Use the newest card or link.

### Location fails

- Use HTTPS or localhost.
- Enable device location services.
- Grant precise location permission to the official GEDIC site.
- Read the persistent GPS status shown above the location buttons. It reports permission, capture progress, coordinates, accuracy radius, and capture time.
- If it says **Location blocked**, open the browser's site settings for GEDIC, change Location to **Allow**, and reload the page.
- If it times out, move near a window or outdoors and retry. Indoors, laptops and desktops may provide only Wi-Fi-based positioning.
- Treat an accuracy value above `±100 m` as a low-accuracy estimate and confirm the pin before sharing it.
- GEDIC does not silently substitute an estimated address.

### Biometric button is disabled

That is expected in the free production build. The button becomes a simulation only in explicit local demo mode. Real biometric identification requires the external infrastructure described in `SECURITY-ARCHITECTURE.md`.
