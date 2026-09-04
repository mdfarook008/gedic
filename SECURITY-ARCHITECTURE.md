# GEDIC cardless emergency access — security architecture

## The answer to “what if the patient has no card?”

An authorised first responder signs in, records the incident and emergency reason, and uses a registered biometric scanner. The scanner performs liveness detection and sends the biometric to a contracted matching service over a protected channel. That service searches enrolled templates (a 1:N identification), then returns a signed, short-lived result containing an opaque GEDIC patient reference. GEDIC releases only the emergency dataset and records a server-side break-glass audit event.

This works only for a patient who enrolled a biometric in advance and consented to the governed identification programme. There must also be a safe exception path for people whose prints or face cannot be captured, people with disabilities or injuries, children, visitors, and anyone who opted out. Biometrics assist identification; they do not prove that a medical record is current or clinically correct.

## Why phone Face ID / fingerprint is not the solution

WebAuthn and phone biometrics authenticate the owner of that phone to an existing account. The biometric stays local and the website receives a signed assertion, not the fingerprint or face. That is excellent for verifying the **responder**, but it cannot identify an unknown unconscious **patient** across GEDIC records.

Unknown-person identification requires a separately governed 1:N biometric system, certified capture hardware, liveness/presentation-attack detection, enrolment quality controls, false-match testing, human review rules, and a lawful basis. GEDIC intentionally does not implement image/template storage in browser JavaScript or Firestore.

## Production flow

1. An administrator verifies the hospital/EMS organisation and provisions a staff account with `staffStatus: "active"` and an `organisationId`. Public self-registration creates only patients.
2. Firebase Authentication verifies the responder. Production should additionally require a passkey or another phishing-resistant second factor.
3. Firebase App Check attests the genuine client before the callable function runs.
4. `createBiometricChallenge` checks the role, validates the emergency reason, rate-limits the responder, and creates a 2-minute random nonce tied to that responder and incident.
5. Registered scanner middleware receives the nonce. It checks liveness and submits the sample directly to the biometric gateway. Raw biometric data never passes through the GEDIC page.
6. The scanner returns a signed capture token. `resolveBiometricEmergency` consumes the challenge once and sends the token plus nonce to an HTTPS gateway.
7. GEDIC accepts only a matching response that echoes the nonce, meets the configured confidence policy, and contains an opaque patient reference.
8. GEDIC resolves the matched patient to their current random emergency token, reads `publicProfiles/{randomToken}`, applies a server-side field allow-list, and creates an `emergencyAccessLogs` record containing who, organisation, why, when, incident, scanner, gateway transaction, outcome, and matched patient.

## Threats and controls

| Threat | Example | Control in this design |
| --- | --- | --- |
| Man in the middle (MITM) | Attacker on public Wi-Fi reads or changes a scan request | HTTPS/TLS, HSTS, hostname validation, CSP, Firebase token validation; production scanner-to-gateway should use mutual TLS or signed requests |
| Replay | A stolen old scan response is submitted again | Random 256-bit nonce, 2-minute expiry, responder binding, exact incident binding, single-use state |
| Privilege escalation | Patient changes their role to responder | Firestore blocks role changes and staff self-registration; Admin SDK provisioning only |
| Registry scraping | Signed-in user downloads every patient | Public collection listing is denied; hospitals are organisation-scoped; doctors are organisation-and-assignment scoped; responder UI has no name search; biometric function returns one allow-listed record |
| Fake fingerprint/photo | Printed image or mould fools sensor | Certified liveness/presentation-attack detection, quality threshold, trained operator, retry limits |
| False match | Wrong patient's record is shown | Validated threshold, show identity cues, human confirmation, “do not treat from biometric alone,” audit and incident review |
| Database breach | Biometric templates are stolen and cannot be changed like passwords | Do not store raw biometrics or templates in GEDIC/Firestore; isolate them in a specialist biometric vault with encryption and retention controls |
| Malicious emergency override | Staff looks up someone without need | Mandatory reason and incident, active staff status, rate limits, immutable audit, patient/security-team notification and review |
| Compromised browser | Injected script steals returned medical data | CSP blocks inline scripts and event attributes, rendered patient values are escaped, security headers are enabled, and production responder devices should be managed |

## What is implemented versus what still needs a vendor

Implemented in this repository:

- honest simulated demo flow, explicitly labelled as simulation;
- invite-only staff trust boundary in the UI and Firestore rules;
- authenticated and App-Check-protected Cloud Functions;
- single-use challenges, expiration, responder/incident binding, and rate limiting;
- HTTPS-only gateway integration contract;
- minimum emergency-field allow-list and server-side audit events;
- anti-clickjacking, HSTS, MIME-sniffing, referrer, permissions, and CSP headers.
- random 192-bit revocable QR tokens, explicit publication consent, and denied public collection listing;
- organisation/care-team scoped Firestore access, atomic patient/public-profile writes, and free Admin SDK provisioning tools.

Required before any real-world or clinical use:

- select and legally contract a certified biometric/liveness provider;
- implement the provider-specific `window.GEDIC_SCANNER` native bridge and a provider-reviewed gateway (GEDIC verifies the configured HMAC response signature as a baseline control);
- use mutual TLS or a managed private service connection between the backend and gateway;
- enable Firebase App Check and passkey/MFA for verified responders;
- create an administrator provisioning workflow and audit-review console;
- run a privacy impact assessment, consent/opt-out design, retention schedule, clinical safety review, penetration test, and jurisdiction-specific legal review;
- define false-accept/false-reject thresholds from representative testing rather than relying on the demonstration threshold;
- add patient/security notifications, audit export (for example FHIR `AuditEvent`), and operational incident response.

## Biometric gateway contract

GEDIC sends JSON over HTTPS:

```json
{
  "challengeId": "server-document-id",
  "nonce": "single-use-base64url-value",
  "signedCaptureToken": "vendor-signed-token",
  "purpose": "emergency-medical-identification"
}
```

The configured gateway must verify the device certificate/signature, nonce, liveness result, capture freshness, device registration, and operator context. Its raw response body must also carry an `x-gedic-signature` HMAC-SHA256 header produced with the separate `BIOMETRIC_GATEWAY_SIGNING_KEY`. It returns:

```json
{
  "decision": "match",
  "nonce": "same-single-use-base64url-value",
  "patientReference": "firebase-patient-uid",
  "confidence": 0.97,
  "scannerId": "registered-device-id",
  "transactionId": "vendor-audit-id"
}
```

Do not put fingerprint images, face images, biometric templates, Aadhaar numbers, or full medical records in either payload.
