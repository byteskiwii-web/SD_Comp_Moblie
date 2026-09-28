# App Store Submission Audit — Zob Connect (SD_Comp_Moblie)

> **Single source of truth** for everything that must be done before Zob Connect is submitted to Google Play and the Apple App Store. Update the per-item status block as work lands. Do not delete items; mark them 🟢 Completed with the verification evidence.

| | |
|---|---|
| App | Zob Connect (`slug: zip-hrms-mobile`) |
| Android package / iOS bundle ID | `com.sdcomputronix.ziphrmsmobile` |
| Version audited | `app.json` version `1.0.0`, versionCode `1`, buildNumber `1` |
| Code audited | `SD_Comp_Moblie` branch `uat` at `0e0876b` (local; **1 commit ahead of `origin/uat` `452a829`, not pushed**). Working tree clean. |
| Cross-checked | `SD_Computer` (`uat` `22003e0`) and `SD_Comp_Web` (`uat` `026ddca`), both in sync with origin on 2026-09-28 |
| Stack | Expo SDK 57, React Native 0.86.3, React 19.2, TypeScript (strict). Local native module `modules/shift-timer` (Android only). |
| EAS project | owner `contactkiwis-team`, projectId `1b235d14-6d40-40d8-a047-4a43cc965ccd` |
| Audit date | 2026-09-28 |
| Policy sources checked | 2026-09-28 (see [Sources](#l-sources)) |

## Status legend

| Status | Meaning |
|---|---|
| 🔴 Pending | Not started |
| 🟡 In Progress | Work has started |
| 🟢 Completed | Fixed **and** verified (fill in Date Fixed + Verification) |
| ⚪ Needs Verification | Cannot be decided from the code; someone must check a build, a device, a console or a person |
| ❌ Blocked | Waiting on another item or on a decision (say which) |

| Finding type | Meaning |
|---|---|
| **Confirmed** | Seen directly in code/config/backend. The problem exists. |
| **Potential** | The code creates a real risk, but whether it causes a rejection or failure depends on reviewer judgement or device behaviour. |
| **Needs Verification** | Cannot be verified from the codebase (console state, build artifact, production server, legal position). |
| **Recommendation** | Not a defect; an improvement that lowers risk. |

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low. "Critical" means it can reasonably block approval, break the reviewer's path, or ship a broken production app. No item here is claimed to *definitely* cause rejection unless the policy text says so.

## Contents

- [A. Executive summary](#a-executive-summary)
- [B. Scope, method and limits](#b-scope-method-and-limits)
- [C. What the app does (reviewer's view)](#c-what-the-app-does-reviewers-view)
- [D. Detailed findings](#d-detailed-findings)
- [E. Master pending checklist](#e-master-pending-checklist)
- [F. Point-by-point remediation plan](#f-point-by-point-remediation-plan)
- [G. Dependencies between fixes](#g-dependencies-between-fixes)
- [H. Implementation order](#h-implementation-order)
- [I. Final pre-submission checklist](#i-final-pre-submission-checklist)
- [J. Verified / no action required](#j-verified--no-action-required)
- [K. Draft store declarations](#k-draft-store-declarations)
- [L. Sources](#l-sources)
- [M. Change log](#m-change-log)

---

## A. Executive summary

### Submission readiness: 🔴 **NOT READY**

The app is further along than most first submissions. It already has in-app account deletion, a public privacy policy, a prominent background-location disclosure, an employer-monitoring manifest flag, stripped dev-launcher permissions, an app-level iOS privacy manifest, and no ads or trackers. What blocks submission is a small number of things that decide the review outcome:

1. **A store build today would talk to `http://localhost:3000`** (STORE-001). The EAS `production` environment was recorded as empty on 28 Sep, and the code falls back to localhost.
2. **Apple may refuse public listing of an employee-only app** (Guideline 3.2 — STORE-002). A distribution decision is needed before App Store Connect is set up.
3. **A reviewer cannot currently get through the app** (STORE-003). Onboarding, KYC, HR approval, a face match against someone else's enrolled face, the geofence, the shift window and a one-session-per-account rule all stand in the way.
4. **Google Play's monitoring-app and background-location rules** (STORE-004, 005, 008, 012). The monitoring flag uses a different manifest key from the one Google documents. Background location may be judged unnecessary because a foreground service would do the job. Declining the disclosure blocks the punch. The monitoring notification is generic and can be invisible.
5. **In-app privacy statements contradict what the backend does** (STORE-006, 007). "We do not keep a trail of where you go" sits beside a table that stores GPS coordinates every ~12 minutes, and "never the photo itself" sits beside a flow that uploads the enrolment photo to Google Drive.

### Counts

| | Count |
|---|---|
| **Total issues** | **39** |
| 🔴 Critical | 7 |
| 🟠 High | 14 |
| 🟡 Medium | 9 |
| 🟢 Low | 9 |
| Confirmed / Potential / Needs Verification / Recommendation | 27 / 4 / 6 / 2 |

| Platform | Count | IDs |
|---|---|---|
| Android only | 13 | 004, 005, 006, 008, 010, 012, 015, 017, 024, 025, 030, 032, 038 |
| iOS only | 10 | 002, 014, 016, 018, 023, 026, 031, 033, 034, 039 |
| Both | 16 | 001, 003, 007, 009, 011, 013, 019, 020, 021, 022, 027, 028, 029, 035, 036, 037 |

| Work outside the app code | Count | IDs |
|---|---|---|
| Needs Google Play Console work | 7 | 003, 005, 010, 015, 017, 019, 020 |
| Needs App Store Connect work | 7 | 002, 003, 016, 018, 019, 020, 026 |
| Needs other external work (EAS, backend, web, legal, accounts) | 15 | 001, 002, 003, 009, 010, 015, 016, 017, 018, 019, 020, 021, 027, 028, 029 |

### Decisions needed from the product owner (before code work on those items)

| Decision | Item | Options (recommendation first) |
|---|---|---|
| iOS distribution model | STORE-002 | Unlisted App Store distribution · Apple Business Manager Custom App · public listing as a multi-employer SaaS |
| Background location on Android | STORE-005 | Drop `ACCESS_BACKGROUND_LOCATION` and rely on the location foreground service · keep it and file the declaration |
| Which developer accounts publish | STORE-019 | Client's organisation accounts · Kiwi Bytes accounts |
| Location/selfie/face retention periods | STORE-021, 029 | Counsel to set |
| How the reviewer gets past the face check | STORE-003 | Reviewer re-enrols own face · server-side bypass flag on the review account |

### Review of this audit (28 Sep 2026)

The audit was checked against the code, the backend and Google's own help page before anything was changed.

**Accuracy.** Every claim that was spot-checked held: 001, 004 (confirmed on the raw Play Console page), 006, 007, 008, 011, 013, 014, 023, 024, 025 and 039. No finding was wrong.

**Gaps in the audit, now recorded:**
- STORE-040: the profile *camera* also fails on Android ≤9. STORE-024 missed it.
- STORE-041: face-consent withdrawal leaves the Drive enrolment photo. STORE-013 only asked to "confirm".
- STORE-042: the backend blocks deletion for a session with a pending password change. STORE-022 assumed the app could add it.
- STORE-011's open question is answered: push delivery already skips revoked sessions, so no backend change is needed.
- STORE-001's evidence cited a private team note. It now cites the `eas env:list` result.

**Fixed in code the same day** (details under each item): 001, 004, 014, 023, 026, 032, 038 and 039 are completed and verified at config level. 006, 007, 008, 011, 012, 013, 024, 025, 031 and 035 have the code done and need a device or build check. 022, 027 and 036 are partly done.

**Not touched, because they need a person, a decision or another repo:** 002, 003, 005, 009, 010, 015–021, 028, 029, 030, 033, 034, 037, and 040–042.

**Consistency note.** "Must fix before submission" (section E) holds 16 items, including two Medium ones (022, 023), while the summary counts 7 Critical. The bucket reflects blocking risk, not severity. Read them separately.

---

## B. Scope, method and limits

**Read in full:** `app.json`, `app.config.js`, `eas.json`, `package.json`, `.gitignore`, `.env.example`, both config plugins, both scripts, `index.ts`, `App.tsx`, every file under `src/api`, `src/stores`, `src/hooks`, `src/tasks`, `src/utils`, `src/native`, `src/navigation`, all auth/onboarding/KYC/face/attendance-clock/profile/account/legal screens and camera variants, `modules/shift-timer` (Kotlin + manifest + gradle). Skimmed for store-relevant behaviour: home, leave, team, regularisation, notifications sheet, policy reader, documents, tour and map pages. The English catalogue was read where it carries disclosures; all 10 locales were checked for key coverage (complete).

**Tools run (read-only):**
- `npx tsc --noEmit` → exit 0 (no type errors).
- `EAS_BUILD_PROFILE=production EXPO_UPDATES_TARGET=build npx expo config --type introspect` → generated Info.plist / entitlements / Android manifest (app-level; library manifests merge later at build).
- Scan of dependency `AndroidManifest.xml` files and iOS `PrivacyInfo.xcprivacy` presence in `node_modules`.
- `curl` of `https://web.zobconnect.com/privacy`, `/terms`, `https://api.zobconnect.com/health` → all HTTP 200.
- Backend (`SD_Computer`) and web (`SD_Comp_Web`) code read to verify claims the app makes.

**Could not be verified (marked ⚪ where it matters):**
- No AAB/IPA was built or inspected. The final merged Android manifest and final Info.plist are therefore inferred, not observed.
- No device testing.
- EAS environment variables, EAS credentials, Play Console and App Store Connect were not accessed.
- Production backend (`api.zobconnect.com`) configuration was not inspected: which optional modules are on (`VERIFICATION_ENABLED`, Drive, face), which database it uses and in which region.
- Legal positions (DPDP, Aadhaar) need counsel.

---

## C. What the app does (reviewer's view)

| Area | What exists | Notes for review |
|---|---|---|
| Audience | Field employees (plus team leads) of one employer. Accounts are created by HR. **No self sign-up.** | Drives STORE-002 (Apple 3.2) and STORE-003 (demo account). |
| Sign-in | Employee ID or work email + password. Forgot-password via email OTP. Forced password change for admin-issued passwords. "Remember me" toggle. One active session per account (server). | Guideline 4.8 enterprise exception applies. There is no social login, so Sign in with Apple is not required. |
| Onboarding gate | Profile → PAN (+Aadhaar) → bank → face enrolment → HR approval, all server-driven (`/auth/me/onboarding`). Then mandatory policy acknowledgement. | Reviewer cannot pass HR approval themselves. |
| Attendance | Clock in/out with live selfie + on-device liveness (ML Kit via VisionCamera) + server face match + geofence. Breaks. History, day detail, monthly summary, regularisation requests. | Shift window gate (client + server). |
| Mid-shift monitoring (Android) | Native foreground service (`type=location`) + AlarmManager, ~12 min: GPS fix → `POST /attendance/location-check`; Developer Mode check via `jail-monkey` → `POST /attendance-alerts`. | Monitoring-app policy, background location, FGS declaration. |
| Mid-shift monitoring (iOS) | None. iOS does not request "Always" location. | Receipts say so (STORE-039). |
| KYC | PAN (+ Aadhaar number in combined mode), Aadhaar OTP (dormant), bank account verification (penniless / ₹1 penny-drop) via Sandbox or SurePass. Consent checkboxes. | Government ID + financial data. |
| Documents | **Read-only** status/view of documents uploaded on the web. The app no longer captures or uploads identity documents. | iOS purpose strings still say it does (STORE-014). |
| Other | Leave, notifications inbox + Expo push, policies library, kudos, profile photo (camera/library), team view for team leads, 10 languages, dark mode, in-app tour, OTA updates (EAS Update) with a "tap to update" build stamp. | |
| Account | Privacy policy + terms links (login + Profile → Account & privacy), in-app deletion request with email OTP. | See STORE-010, 022. |
| Payments / IAP / subscriptions | **None.** | N/A. |
| Ads / analytics / tracking | **None.** No ATT needed. | |
| Third parties contacted by the app | api.zobconnect.com, web.zobconnect.com, Expo (updates u.expo.dev, push), FCM / APNs, Google ML Kit (on-device, diagnostics), OpenFreeMap tiles + jsDelivr/unpkg/cdnjs (Android map), OS maps (Apple Maps on iOS). Backend-side: Sandbox/SurePass, Google Drive, SMTP provider, database host. | Privacy policy and Data Safety must match (STORE-009, 015, 016). |

**Android permissions (app-level, from introspection):** `INTERNET`, `VIBRATE`, `READ_EXTERNAL_STORAGE`, `CAMERA`, `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`. Blocked: `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`, `RECORD_AUDIO`. Merged from libraries at build (not in introspection): `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` (expo-notifications), `WAKE_LOCK` (shift-timer), `ACCESS_NETWORK_STATE` (expo-updates). ⚪ Confirm the final list from the built AAB.

**iOS Info.plist (from introspection):** `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSLocationWhenInUseUsageDescription`, `ITSAppUsesNonExemptEncryption=false`, `UIBackgroundModes=[fetch]`, iPad all orientations, `UIRequiresFullScreen=false`. Entitlements: `aps-environment=development` (EAS normally switches this for App Store signing — ⚪).

---
## D. Detailed findings

Each item has a status block. Keep it current. The step-by-step fix for each item is in [section F](#f-point-by-point-remediation-plan).

---

### STORE-001 — Store builds fall back to `http://localhost:3000` for the API

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both | Configuration / Build | 🔴 Critical | Confirmed (EAS env state as recorded 28 Sep — re-check) | 🟢 Completed | Unassigned | 2026-09-28 | 2026-09-28 | EAS env listed; config guard tested |

> **Review & fix, 28 Sep 2026.** EAS `production` now holds `EXPO_PUBLIC_API_URL=https://api.zobconnect.com` and `EXPO_PUBLIC_WEB_URL=https://web.zobconnect.com` (`eas env:list --environment production`). `eas.json` names the environment of every profile. `app.config.js` throws when `EAS_BUILD_PROFILE` is `production` or `preview` and the URL is not public https. Tested by evaluating the config: `http://localhost:3000`, `https://10.0.0.5` and `https://192.168.1.66:3000` are refused; `https://api.zobconnect.com` and `https://api110.example.com` are accepted. **Still to see:** the first production build log. The `config.ts` localhost fallback was left for development builds, since the guard makes it unreachable in store builds.

**Current state.** `API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'`. `EXPO_PUBLIC_*` values are inlined at build time. The `production` build profile in `eas.json` sets only `EXPO_UPDATES_TARGET` and names no EAS environment. The team's notes of 28 Sep 2026 record that the EAS `production` and `development` environments are **empty** (only `preview` holds `EXPO_PUBLIC_API_URL=https://api.zobconnect.com`). The local `.env` holds a LAN address and is not uploaded to EAS.

**Why this matters.** A production build made today would call `http://localhost:3000`. On a phone that address is the phone itself. Every request fails, so the reviewer sees a login that never succeeds (Guideline 2.1: app completeness; Play: broken functionality). iOS ATS would block plain http anyway. `scripts/check-api-url.js` guards `eas update` only, not `eas build`.

**Evidence.**
- [src/constants/config.ts:1](src/constants/config.ts#L1) — localhost fallback.
- [eas.json](eas.json) — `build.production` has no `environment` and no API variable.
- [scripts/check-api-url.js](scripts/check-api-url.js) — only wired to `update:*` scripts in [package.json](package.json).
- `npx eas env:list --environment production` on 28 Sep 2026 returned "No variables found for this environment" (re-checked in the review).

**Required change.** A store build must be impossible to produce without a public https API URL.

**Recommended fix.** Set `EXPO_PUBLIC_API_URL=https://api.zobconnect.com` and `EXPO_PUBLIC_WEB_URL=https://web.zobconnect.com` in the EAS `production` environment. Add `"environment": "production"` to the production profile. Add an `eas-build-pre-install` hook (or an `app.config.js` guard when `EAS_BUILD_PROFILE=production`) that runs `check-api-url.js` and fails the build. Replace the localhost fallback with a thrown error outside `__DEV__`.

**Platform console action.** Neither. **External action.** EAS environment variables (expo.dev).

**Verification.** `eas env:list --environment production` shows both variables. The production build log shows the pre-install check passing. The installed store build signs in against `api.zobconnect.com`. A deliberately unset variable makes the build fail.

---

### STORE-002 — Apple may reject public listing of a single-employer, employee-only app (Guideline 3.2)

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| iOS | Policy / Distribution | 🔴 Critical | Potential (common rejection pattern) | ❌ Blocked — needs decision | Unassigned | 2026-09-28 | — | — |

**Current state.** The app is for one employer's staff. Accounts are created by HR, there is no sign-up, and the app, privacy policy and terms all say so ("The app is not open to the public and you cannot register yourself"). The config comments mention a possible later SaaS offering, but nothing in the product or on the website offers it to other employers today.

**Why this matters.** Apple regularly rejects apps under **Guideline 3.2 — Business** with the message that the app "was designed for a specific business or organization, including its partners, clients or employees, and not for general distribution on the App Store". Apple directs such apps to **Unlisted App Distribution** or **Custom Apps via Apple Business Manager**. This is the single most likely iOS rejection reason for this app. Google Play has no equivalent rule, so the public Play listing is acceptable (subject to the monitoring rules).

**Evidence.**
- Terms/Privacy text in [../SD_Comp_Web/src/legal/content.js](../SD_Comp_Web/src/legal/content.js) ("Accounts are created by your employer's HR team. The app is not open to the public").
- Login copy `auth.intro` in [src/i18n/locales/en.ts:95](src/i18n/locales/en.ts#L95).
- [src/navigation/AppTabs.tsx](src/navigation/AppTabs.tsx) — "There is no sign-up in this product — HR creates employees".

**Required change.** Choose an iOS distribution model before creating the App Store Connect listing and writing review notes.

**Recommended fix.** Request **Unlisted App Distribution**: it keeps normal App Store review and delivery, and the app is reachable only by direct link, which suits employee-only apps. If the client already uses Apple Business Manager, a **Custom App** is the alternative. Only choose a public listing if the product is genuinely offered to other employers (website with a business sign-up or contact path, multi-tenant onboarding) and the review notes can show that.

**Platform console action.** App Store Connect (distribution method, Unlisted request form). **External action.** Product decision. The client's Apple Business Manager enrolment if the Custom App route is chosen.

**Verification.** Written decision recorded in this item. The App Store Connect app record is created with the chosen distribution. The Unlisted request is approved (or the Custom App is assigned to the client's ABM organisation ID).

---

### STORE-003 — No reviewer path: demo account, onboarding, face match, geofence, shift window, single session

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both | Reviewer Flow | 🔴 Critical | Confirmed gap | 🔴 Pending | Unassigned | 2026-09-28 | — | — |

**Current state.** Everything past the login screen depends on server state a reviewer cannot create:
1. **Onboarding gate:** profile, PAN/Aadhaar, bank, face and **HR approval** must all be complete before the tabs appear ([src/navigation/RootNavigator.tsx](src/navigation/RootNavigator.tsx) `GatedApp`). KYC calls hit paid third-party vendors.
2. **Policy gate:** any outstanding `requires_ack` policy blocks the app until signed.
3. **Face match:** every clock-in/out is compared server-side with the account's enrolled face. A demo account enrolled by a team member will reject the reviewer's face (`FACE_NOT_RECOGNISED`), and several mismatches lock the check.
4. **Geofence:** a reviewer in the USA is far outside any store. The punch is still recorded but goes "pending HR approval".
5. **Shift window:** clock-in is refused outside the rostered window, which the client computes in device-local time and the server in IST ([src/utils/attendanceDay.ts](src/utils/attendanceDay.ts) `clockInWindow`, [../SD_Computer/src/modules/attendance/attendance.window.js](../SD_Computer/src/modules/attendance/attendance.window.js)). An employee with **no shift template** is allowed at any hour (both sides return "no window").
6. **One session per account:** a second sign-in ends the first (`SIGNED_IN_ELSEWHERE`, [../SD_Computer/src/modules/auth/auth.service.js:677](../SD_Computer/src/modules/auth/auth.service.js#L677)). Apple and Google reviewers, and our own testers, would sign each other out.
7. **Forced password change:** an admin-issued password sends the reviewer to the set-password screen first.

**Why this matters.** Apple 2.1(a) requires "demo account info (and turn on your back-end service!)". Play's **App access** declaration requires working credentials and instructions. A reviewer who cannot reach clock-in rejects the app for incomplete information or broken functionality.

**Evidence.** As listed above, plus [src/hooks/useOnboardingGate.ts](src/hooks/useOnboardingGate.ts), [src/hooks/usePolicyAcceptanceGate.ts](src/hooks/usePolicyAcceptanceGate.ts), [src/screens/attendance/ClockPanel.tsx:434-466](src/screens/attendance/ClockPanel.tsx#L434-L466) (face refusal handling).

**Required change.** A dedicated, fully onboarded review account per store (Apple, Google), usable any time of day from anywhere, with clear review notes.

**Recommended fix.** On **production** (`api.zobconnect.com`): create `EMP-REVIEW-A` (Apple) and `EMP-REVIEW-G` (Google) with fake but valid-looking data, all onboarding steps marked complete, HR-approved, no shift template, assigned to a demo store that is geofence-exempt (or has a very large radius), no outstanding policies, and a permanent (not admin-issued) password. For the face step, either (a) tell the reviewer to re-register their face under Profile → Identity → Face verification before punching (first check that re-enrolment does not reset HR approval), or (b) add an auditable server flag that skips the face comparison for these two accounts only. Write review notes (template in section F).

**Platform console action.** Both (Play "App access"; App Store Connect "App Review Information").

**External action.** Production backend data setup; a named contact person for the reviewer.

**Verification.** On a clean install of the release build, from outside the geofence and outside Indian business hours: sign in → tabs appear → clock in → clock out → break → leave → Profile → Account & privacy → deletion flow reachable (do **not** confirm on the review account). Repeat on the second account from another device at the same time: neither session is displaced.

---

### STORE-004 — Monitoring flag uses a different manifest key from the one Google documents

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Android | Policy | 🔴 Critical | Confirmed (mismatch with Play documentation) | 🟢 Completed | Unassigned | 2026-09-28 | 2026-09-28 | Introspected manifest |

> **Review & fix, 28 Sep 2026.** Verified against the raw Play Console help page (answer 12955211): its example is `android:name="isMonitoringTool"`, and `android.content.isMonitoringTool` does not appear on it. `plugins/withMonitoringTool.js` now writes `isMonitoringTool` and removes the old key. Introspection shows `isMonitoringTool=enterprise_management`. **Still to see:** `bundletool dump manifest` on the first AAB.

**Current state.** `plugins/withMonitoringTool.js` writes `<meta-data android:name="android.content.isMonitoringTool" android:value="enterprise_management"/>`. Introspection confirms that key in the generated manifest.

**Why this matters.** Google's Play Console help page for the flag shows the declaration as `<meta-data android:name="isMonitoringTool" android:value="…"/>`. Play policy requires monitoring apps to carry this flag in every version code on every track, and apps that monitor employees without it are rejected under the Stalkerware/Spyware policy. A key Google does not look for is the same as having no flag.

**Evidence.**
- [plugins/withMonitoringTool.js:37](plugins/withMonitoringTool.js#L37) — `const FLAG = 'android.content.isMonitoringTool'`.
- Introspection output: `meta android.content.isMonitoringTool enterprise_management`.
- Play Console Help "Use of the isMonitoringTool flag" (answer 12955211) — example uses `android:name="isMonitoringTool"`.

**Required change.** Emit `isMonitoringTool` exactly as documented.

**Recommended fix.** Change `FLAG` to `'isMonitoringTool'`. Keep the plugin idempotent and remove any stale `android.content.isMonitoringTool` entry. Keeping both keys is harmless if the team wants belt-and-braces.

**Platform console action.** Google Play Console: the store listing must disclose monitoring (see STORE-020).

**External action.** None.

**Verification.** `npx expo config --type introspect` shows `isMonitoringTool`. `aapt2 dump xmltree` / `bundletool dump manifest` on the built AAB shows `<meta-data android:name="isMonitoringTool" android:value="enterprise_management">` inside `<application>`.

---

### STORE-005 — Background location may be judged unnecessary; declaration and video still to be filed

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Android | Permissions / Policy | 🔴 Critical | Potential | ❌ Blocked — needs decision | Unassigned | 2026-09-28 | — | — |

**Current state.** `ACCESS_BACKGROUND_LOCATION` is declared. Mid-shift tracking starts only if **background** permission is granted ([src/hooks/useLocationPollingEffect.ts:88](src/hooks/useLocationPollingEffect.ts#L88)). The tracking itself runs inside a **foreground service of type `location`** that is started while the app is in the foreground at clock-in, shows a persistent notification, and stops at clock-out or break. iOS does the same job with no background location at all.

**Why this matters.** Play's background-location policy asks whether the feature "could work with foreground access". A foreground service "initiated as a continuation of an in-app, user-initiated action" is named as the alternative. Approval also weighs user benefit (safety, health, fitness), and employer attendance monitoring benefits the employer more than the user. Because the app already runs a location-typed FGS started from the foreground, a reviewer may conclude background permission is not needed and reject the declaration. Separately, the declaration form and a ≤30 s video (disclosure → runtime prompt → feature) must be filed whatever happens.

**Evidence.**
- [app.json:34](app.json#L34) — `ACCESS_BACKGROUND_LOCATION`.
- [modules/shift-timer/android/src/main/AndroidManifest.xml](modules/shift-timer/android/src/main/AndroidManifest.xml) — `foregroundServiceType="location"`.
- [src/hooks/useLocationPollingEffect.ts:83-90](src/hooks/useLocationPollingEffect.ts#L83-L90).
- [src/screens/attendance/ClockPanel.tsx:593-661](src/screens/attendance/ClockPanel.tsx#L593-L661).

**Required change.** Decide between:
- **A (recommended):** remove `ACCESS_BACKGROUND_LOCATION`. Start the FGS when foreground ("while in use") permission is granted, and rely on Android's rule that a location FGS started from the foreground keeps location access while it runs.
- **B:** keep background location and file a strong declaration.

**Recommended fix.** Prototype A on Android 12–16 devices (including an aggressive OEM, e.g. OnePlus/Xiaomi). The known weak point: if the OS kills and later restarts the service from the background (`START_REDELIVER_INTENT`), while-in-use access is not restored, so ticks will not get a fix. The tick must then report "unknown", not "location off", so the employee is not penalised (see STORE-025). If A holds up, drop the permission and simplify the disclosure (it still describes collection "when the app is closed", which remains true). If not, choose B and film the declaration video on the final build.

**Platform console action.** Google Play Console → App content → Sensitive permissions → Location permissions (option B), and Foreground service permissions (both options — STORE-017).

**External action.** Record the demo video(s). Update the privacy policy (STORE-009) and Data Safety (STORE-015) for whichever option ships.

**Verification.** Option A: the merged manifest has no `ACCESS_BACKGROUND_LOCATION`, and on a device with "Allow only while using the app" a full shift produces a location check every ~12 min with the app swiped away and the screen off. Option B: the Play declaration is approved.

---

### STORE-006 — Background-location disclosure says "We do not keep a trail of where you go", but every check is stored with coordinates

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Android (disclosure shown on Android only; string exists in all 10 locales) | Privacy | 🔴 Critical | Confirmed | 🟡 In Progress | Unassigned | 2026-09-28 | — | Code done; needs native-speaker review |

> **Review & fix, 28 Sep 2026.** The false line is removed from all 10 locales, and "What we check" gains `loc.discloseDoKept` ("Each check is saved with your attendance record"). No retention period is stated yet; add it once STORE-029 / STORE-021 set one. Translations were written without a native-speaker review.

**Current state.** The prominent disclosure lists under "What we never do": *"We do not keep a trail of where you go"*. The backend inserts the raw latitude, longitude, accuracy, distance and timestamp of **every** ~12-minute check into `geo_fence_events`. No retention job for that table was found (STORE-029).

**Why this matters.** A sequence of timestamped GPS points every 12 minutes for the whole shift is a location trail. A prominent disclosure that understates collection breaches Play's User Data / Deceptive Behavior policies. The disclosure is exactly what the declaration video shows the reviewer. Under DPDP the notice must be accurate.

**Evidence.**
- [src/i18n/locales/en.ts:489](src/i18n/locales/en.ts#L489) `loc.discloseNotTrack` (+ 9 translations).
- [../SD_Computer/src/modules/attendance/attendance.punch.js:635-650](../SD_Computer/src/modules/attendance/attendance.punch.js#L635-L650) — `INSERT INTO geo_fence_events (… latitude, longitude, accuracy_m …)`.
- Privacy policy (web) is more careful: "we do not build a movement history beyond the attendance record".

**Required change.** The disclosure must describe what is stored, accurately.

**Recommended fix.** Replace the line with something true, e.g. *"Your location is recorded only at these checks, only while you are clocked in, and it is kept with your attendance record for [N] days/months."* Remove it from "What we never do". Keep "We do not check your location when you are off shift" (true). Update all 10 locales. Align with the retention decision (STORE-029) and the privacy policy.

**Platform console action.** None directly (feeds the Play declaration video). **External action.** Translation review for 9 languages.

**Verification.** On-device disclosure text matches the policy and the backend behaviour. Grep shows no remaining "trail" claim in `src/i18n/locales/*`.

---

### STORE-007 — Face enrolment screen says "never the photo itself", but the enrolment photo and every punch selfie are stored

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both | Privacy | 🔴 Critical | Confirmed (enrolment photo stored whenever Drive is enabled on the server — ⚪ confirm production setting) | 🟡 In Progress | Unassigned | 2026-09-28 | — | Code done; needs native-speaker review |

> **Review & fix, 28 Sep 2026.** `face.intro` now says the summary **and the set-up photo** are kept (the photo for HR's review), that punch photos are kept for a limited time, and that consent can be withdrawn from Profile. All 10 locales are updated. It stays true whether or not Drive is enabled. Needs a native-speaker review of the translations.

**Current state.** The consent screen for biometric enrolment reads: *"Only a mathematical summary of your face is stored — never the photo itself."* The backend uploads the enrolment photo to Google Drive (`face-enrolment/<employeeId>`) when Drive is configured, "for HR's approval review". Every clock-in/out selfie is also uploaded and kept for `ATTENDANCE_PHOTO_RETENTION_DAYS` (default 60). The published privacy policy correctly says the set-up photo **is** kept.

**Why this matters.** This is the consent text for biometric processing. It contradicts both the backend and the published privacy policy. Apple 5.1.1(ii) and Play's User Data policy require accurate disclosure, and a DPDP consent given on a false statement is not informed consent.

**Evidence.**
- [src/i18n/locales/en.ts:393](src/i18n/locales/en.ts#L393) `face.intro` (+ 9 translations).
- [../SD_Computer/src/face/face.service.js:65-84](../SD_Computer/src/face/face.service.js#L65-L84) — `drive.uploadFile(photoBuffer …)`.
- [../SD_Comp_Web/src/legal/content.js](../SD_Comp_Web/src/legal/content.js) — "The set-up photo itself is also kept".
- [../SD_Computer/src/config/env.js:818](../SD_Computer/src/config/env.js#L818) — selfie retention 60 days default.

**Required change.** The enrolment copy must match the policy and the backend.

**Recommended fix.** Rewrite `face.intro` along the lines of: *"We'll compare a live photo with this one at every clock-in and clock-out. We store a mathematical summary of your face, and this set-up photo is kept so HR can review it. You can withdraw consent in Profile → Identity."* Mention that punch selfies are stored for a limited period. Update all locales. Pair with STORE-013 so that the withdrawal it mentions exists.

**Platform console action.** None. **External action.** Translation review.

**Verification.** On-device copy matches section "Photographs, liveness and face verification" of the privacy policy word-for-word in meaning.

---

### STORE-008 — Declining the location disclosure cancels the punch (including clock-out) and discards the selfie

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Android | Permissions / UX / Policy | 🟠 High | Confirmed | 🟡 In Progress | Unassigned | 2026-09-28 | — | Code done; needs device test |

> **Review & fix, 28 Sep 2026.** The background disclosure and request moved into `openPunch('clock-in')`, **before** the camera (`askBackgroundLocation` in `ClockPanel.tsx`). "Not now" or a denial now records the punch and shows the existing "Periodic checks are off" alert. Clock-out never asks. `loc.discloseDecline` is rewritten in all 10 locales to match; the comment in `BackgroundLocationDisclosure.tsx` already described this behaviour. **Needs a device test** of the three scenarios on Android 13 and 14.

**Current state.** After the selfie is captured (clock-in **or** clock-out), if background permission is not already granted the disclosure appears. **"Not now"** → `setPendingAction(null); return;` → no punch, selfie thrown away. **"Continue" then denying the system prompt** → the punch goes through with a "periodic checks are off" alert. The code comment at L630-652 says "the mark goes in either way", but that is only true for the second path. The copy `loc.discloseDecline` tells the user they "will not be able to start or end a shift".

**Why this matters.**
- The Play reviewer's test is to decline the disclosure. That currently blocks the app's core function, and blocks **ending** a shift, which is worse.
- Making a non-essential background permission (tracking still works without it: the punch goes through when the OS prompt is denied) a condition for core use is what the policy discourages. The inconsistency also confuses users.
- The disclosure appears after the camera and liveness steps, so the user has already spent effort before being asked.

**Evidence.**
- [src/screens/attendance/ClockPanel.tsx:593-661](src/screens/attendance/ClockPanel.tsx#L593-L661) (decline at L618-621, submit at L653).
- [src/i18n/locales/en.ts:490](src/i18n/locales/en.ts#L490) `loc.discloseDecline`.
- [src/components/BackgroundLocationDisclosure.tsx:30-32](src/components/BackgroundLocationDisclosure.tsx#L30-L32) — comment states the opposite of the behaviour.

**Required change.** Declining the disclosure must behave like denying the OS prompt: record the punch, skip background tracking, explain the consequence. Never gate clock-out on it.

**Recommended fix.** In `handleCaptured`, treat `agreed === false` as `granted = false` and fall through to `punchMutation.mutate`. Show the disclosure only on **clock-in**, and ideally **before** opening the camera (move `askDisclosure` + request into `openPunch('clock-in')`). Rewrite `loc.discloseDecline` in all locales ("Your clock-in will still be recorded, but we won't be able to confirm you stay at the store during your shift"). If STORE-005 option A ships, the request changes but the decline rule stays.

**Platform console action.** None (the Play declaration video must show the fixed flow). **External action.** Translation review.

**Verification.** Fresh install → clock-in → "Not now" → punch recorded, alert shown, no tracking notification. Clock-out never shows the disclosure. Accept → OS prompt → deny → punch recorded (unchanged).

---

### STORE-009 — Privacy policy is marked draft and does not match the app in several places

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both | Legal / Privacy | 🟠 High | Confirmed | 🔴 Pending | Unassigned | 2026-09-28 | — | — |

**Current state.** The policy at `https://web.zobconnect.com/privacy` (source `SD_Comp_Web/src/legal/content.js`) is detailed and mostly accurate, but:
1. It is marked **"STATUS: DRAFT FOR LEGAL REVIEW"**, and `legalName: 'Zob Connect' // TODO confirm registered legal name`. The data fiduciary must be a real legal entity.
2. **Recipients table is incomplete/wrong for store builds:** it lists jsDelivr + storage.googleapis.com as liveness hosts. In store builds liveness uses on-device ML Kit, and those hosts are used only by the Expo Go dev path. It omits **OpenFreeMap** (map tiles), **unpkg.com** and **cdnjs.cloudflare.com** (map library mirrors), **Google ML Kit** (diagnostics sent to Google), **Expo push service** and **Apple Push Notification service**, the **SMTP/email provider** sending OTPs, and the **hosting / database providers**.
3. "Data is stored on servers located in India." The shared dev/staging database is **Neon, AWS `us-east-2` (USA)**. The production database and region behind `api.zobconnect.com` are undocumented. ⚪
4. Permissions table says the camera is used for "photographing documents you upload". The app no longer does that (documents are uploaded on the web).
5. Deletion path is given as "Profile → Request deletion of my data". In the app it is **Profile → Account & privacy → Request deletion of my data**, and no web deletion route exists yet (STORE-010).
6. "You may withdraw [face verification consent] at any time, as easily as you gave it". There is no in-app withdrawal (STORE-013).
7. Location section implies background collection on every platform. iOS never collects in the background (over-disclosure is safer than under-disclosure, but should be stated).
8. Retention for location-check records is "Attendance record retention" with no job enforcing it (STORE-029).
9. The page is a client-rendered SPA. Automated policy checkers that do not run JavaScript may see an empty page. ⚪

**Why this matters.** Both stores require a privacy policy that accurately describes collection, use and sharing, and reviewers compare it with the app and the Data Safety / App Privacy answers. A policy marked draft with a placeholder controller name is not a finished document (Apple 2.1 "placeholder text", 5.1.1(i)). DPDP s.5 requires the notice to identify the data fiduciary.

**Evidence.** [../SD_Comp_Web/src/legal/content.js](../SD_Comp_Web/src/legal/content.js) (lines 19-24, 33, 159, 172-196, 255-258, 284); [src/components/libreMapPage.ts:49-64](src/components/libreMapPage.ts#L49-L64); [src/screens/profile/sections/AccountScreen.tsx](src/screens/profile/sections/AccountScreen.tsx); `SD_Computer/.env` DB host `*.us-east-2.aws.neon.tech`.

**Required change.** Publish a final, counsel-approved policy whose facts match the release build.

**Recommended fix.** See section F. Edit `content.js` (one source for web + app), deploy the web app, and re-check the rendered page.

**Platform console action.** Both (privacy policy URL fields). **External action.** Legal review (STORE-021), web deploy, confirm production hosting/DB region.

**Verification.** `https://web.zobconnect.com/privacy` shows no "draft"/TODO. Every host in the "third parties" table of [section C](#c-what-the-app-does-reviewers-view) appears in the policy. The deletion path matches the app. Also check the page with JavaScript disabled or with `curl` (or provide a static fallback).

---

### STORE-010 — No web page for requesting account deletion (Play requirement)

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Android (Play requirement; useful for both) | Legal / Metadata | 🟠 High | Confirmed | 🔴 Pending | Unassigned | 2026-09-28 | — | — |

**Current state.** In-app deletion exists (Profile → Account & privacy). The privacy policy also offers an email route. There is no dedicated deletion URL.

**Why this matters.** Play requires a **web link resource where users can request account and data deletion without reinstalling the app**. It must load without error, prominently feature the deletion steps, and name the app/developer, and the URL is entered in the Data Safety form. A link to the full privacy policy, where deletion is one section among many, risks failing "prominently featured".

**Evidence.** Routes in [../SD_Comp_Web/src/App.jsx:80-81](../SD_Comp_Web/src/App.jsx#L80-L81) (only `/privacy`, `/terms`). Play Console Help answer 13327111.

**Required change.** A public page, e.g. `https://web.zobconnect.com/delete-account`.

**Recommended fix.** A static public route naming "Zob Connect" and the developer, with steps (in-app path; email the grievance officer with employee ID from the registered address), what is deleted, what is retained and why, and the timeframe. Optional: a form that triggers the existing OTP deletion flow through a new unauthenticated endpoint (employee ID + email OTP, rate-limited). Link it from the privacy policy.

**Platform console action.** Google Play Console → Data safety → "Delete account URL". **External action.** Web deploy.

**Verification.** The URL loads logged-out on mobile and desktop and shows the steps above the fold. The URL is saved in the Data Safety form.

---

### STORE-011 — Sign-out leaves the server session, push registration and the previous user's data on the device

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both | Security / Privacy | 🟠 High | Confirmed | 🟡 In Progress | Unassigned | 2026-09-28 | — | Code done; needs A→B device test |

> **Review & fix, 28 Sep 2026.** `authStore.signOut` now revokes the server session through a plain `fetch` (`POST /auth/logout`, 5 s timeout, never awaited). It deliberately bypasses the API client, whose 401 handling would call sign-out again. It then runs `wipeUserData()` in `src/utils/signOutCleanup.ts`: `queryClient.clear()` (the client moved to `src/api/queryClient.ts`), shift state, local alert history, the disclosure consent, **all scheduled local notifications**, and downloaded files in the cache (top-level files plus `avatars/`). Step 4 is answered with no backend change needed: `device.service.js` only pushes to tokens whose session has `revoked_at IS NULL`, so revoking the session stops pushes.

**Current state.** `signOut` stops the shift timer, clears the keychain entry and resets auth state. It does **not**:
- call `POST /auth/logout` (the route exists). The refresh token stays valid server-side until expiry, and the push token stays registered to that live session. The comment in `devices.api.ts` assumes "signing out revokes the session", but the app never does that.
- clear the React Query cache. Several keys are not scoped by employee (`['policies-outstanding']`, `['deletion-status']`, `['notifications']`, `['leave-summary', month]`, `['kyc-capabilities']`), so the next person to sign in on a shared store phone can briefly see the previous user's data.
- clear `notificationsStore` (local alert history), `consentStore` (its own comment says it is cleared on sign-out), `shiftStore`, the cached profile photos/documents in `Paths.cache`, or **scheduled local reminders** (a clock-out reminder for user A can fire for user B).

**Why this matters.** Shared devices are expected (the code says so repeatedly). HR notifications, leave reasons and policy status leaking to the next user is a privacy incident. A reviewer who signs out and back in with a second account sees stale data. Apple 5.1.1 / Play User Data both require appropriate handling of personal data.

**Evidence.** [src/stores/authStore.ts:225-235](src/stores/authStore.ts#L225-L235); [../SD_Computer/src/modules/auth/auth.routes.js:183](../SD_Computer/src/modules/auth/auth.routes.js#L183); [src/api/devices.api.ts](src/api/devices.api.ts) comment; [src/stores/consentStore.ts](src/stores/consentStore.ts) (`clearConsents` never called); no `queryClient.clear()` anywhere.

**Required change.** Sign-out (manual, forced by 401, and after deletion) must revoke the session server-side and wipe per-user local state.

**Recommended fix.** See section F.

**Platform console action.** Neither. **External action.** None.

**Verification.** Sign in as A, view Leave/Policies/Notifications, schedule a reminder (clock in), sign out, sign in as B: no A data visible at any point, and there are no pending scheduled notifications. The server session for A is revoked (a refresh with A's old token returns 401). No push for A arrives on the device.

---

### STORE-012 — Monitoring notification is generic, uses the full-colour app icon, and can be invisible

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Android | Policy / UX | 🟠 High | Confirmed (text/icon); Potential (visibility) | 🟡 In Progress | Unassigned | 2026-09-28 | — | Needs an Android build (Kotlin not compiled locally) |

> **Review & fix, 28 Sep 2026.** New `ShiftTimer.setNotificationText(title, text, channel)` native function. It is persisted in SharedPreferences for system restarts, and called from `useLocationPollingEffect` with `shiftNotif.*` strings in all 10 languages: "On shift · location checks on" / "…checks your location about every 12 minutes until you clock out." / channel "Shift location checks". It is a **separate** function, and the JS checks it exists before calling, so an OTA update to an older binary cannot break its `start()`. The small icon is now `notification_icon`, generated by expo-notifications from the new `assets/notification-icon.png` (the brand glyph, white on transparent, 96×96), with the launcher icon as fallback. On Android 13+ the app now asks for notification permission at clock-in, before tracking starts. **This laptop has no Android toolchain**, so the Kotlin was not compiled; the next EAS Android build is the compile check.

**Current state.** The foreground-service notification reads **"Clocked in / Checking your shift status periodically"** (English only, and it never mentions location). Its small icon is `applicationInfo.icon`, the full-colour launcher icon, which Android renders as a solid white shape in the status bar. `expo-notifications` has no `icon` configured either, so reminders and pushes get the same blob. On Android 13+ the app never asks for `POST_NOTIFICATIONS` before starting tracking (it asks later, from the push hook). If the user denies it, the FGS notification is hidden from the shade while tracking continues.

**Why this matters.** Play's monitoring rules require "a persistent notification at all times" while monitoring and "a unique icon that clearly identifies the app". The app "must not hide or cloak tracking". A generic line that does not say location is being checked, with an unidentifiable icon, invites a Stalkerware-policy finding. Tracking with no visible notification is exactly what the policy prohibits.

**Evidence.** [modules/shift-timer/.../ShiftTimerService.kt:240-247](modules/shift-timer/android/src/main/java/expo/modules/shifttimer/ShiftTimerService.kt#L240-L247); [app.json](app.json) `expo-notifications` plugin (no `icon`); [src/hooks/usePushNotifications.ts:76](src/hooks/usePushNotifications.ts#L76); `assets/android-icon-monochrome.png` exists and is unused for notifications.

**Required change.** A clear, localised, identifiable notification that is shown whenever tracking runs.

**Recommended fix.** Pass title/text from JS to `ShiftTimerModule.start()` (localised), e.g. "Zob Connect · On shift — your location is checked about every 12 minutes until you clock out". Add a monochrome notification icon (`expo-notifications` `icon` + a drawable used by the service). Name the channel "Shift location checks". Before starting tracking on Android 13+, request `POST_NOTIFICATIONS`. If denied, show a persistent in-app banner on Home/Attendance ("Location checks are running — notifications are off") and explain in the disclosure.

**Platform console action.** None (screenshots/video for STORE-017 should show it). **External action.** None.

**Verification.** Clock in on Android 14: the status bar shows a recognisable Zob Connect glyph, and the notification text names location checks in the chosen language. Deny notifications → tracking either does not start without explanation, or the in-app indicator is visible. Pick one behaviour and document it.

---

### STORE-013 — Face-verification consent cannot be withdrawn in the app

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both | Privacy / Legal | 🟠 High | Confirmed | 🟡 In Progress | Unassigned | 2026-09-28 | — | Code done; backend gap STORE-041 |

> **Review & fix, 28 Sep 2026.** Profile → Identity verification → Face now has "Withdraw face verification consent", with a danger `ConfirmDialog` stating the consequence. It calls `DELETE /face/consent` and invalidates the KYC, face and onboarding-gate queries. Strings are in all 10 locales. **Step 5 was checked:** the backend does **not** delete the Drive enrolment photo on withdrawal, while the policy says it does. Raised as STORE-041.

**Current state.** `withdrawFaceConsent()` (`DELETE /face/consent`) is implemented in the API layer but **no screen calls it**. The privacy policy promises withdrawal "at any time, as easily as you gave it" and describes its effect.

**Why this matters.** Biometric processing is consent-based here. DPDP requires withdrawal to be as easy as giving consent. The policy describes a control that does not exist, and reviewers check that described controls exist (the team already hit this once with deletion).

**Evidence.** [src/api/face.api.ts:73-76](src/api/face.api.ts#L73-L76); no usages under `src/screens`; privacy policy "Withdrawing consent".

**Required change.** An in-app withdrawal control.

**Recommended fix.** In Profile → Identity (KycCard face row), add "Withdraw face verification consent" with a confirm dialog stating the consequence (cannot clock in/out until re-enrolled). Call the API, then invalidate `['face-status']`, `['profile-kyc-status']` and the onboarding gate. Localise.

**Platform console action.** None. **External action.** Confirm with counsel that "cannot punch without face verification" is acceptable, or that an alternative punch method exists (STORE-021).

**Verification.** Withdraw on a test account → the server template is deleted (face status `pending`). Clock-in is refused with a clear message. Re-enrol restores it.

---
### STORE-014 — iOS camera and photo-library purpose strings describe a feature the app no longer has

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| iOS | Permissions / Privacy | 🟠 High | Confirmed | 🟢 Completed | Unassigned | 2026-09-28 | 2026-09-28 | Introspected Info.plist |

> **Review & fix, 28 Sep 2026.** One camera string in all three places: "Zob Connect uses your camera to take a live photo when you clock in or out, to set up face verification, and to take your profile picture." Photo library: "…choose an existing photo as your profile picture." The photo string was **kept, not removed**: expo-image-picker links Photos APIs, and a missing string risks an ITMS-90683 upload rejection even though PHPicker never prompts.

**Current state.** The generated Info.plist carries:
- `NSCameraUsageDescription`: "…uses your camera to **photograph your identity documents** and to take a live photo when you clock in or out." (the `expo-camera` / `expo-image-picker` plugin strings override the shorter, accurate one in `ios.infoPlist`)
- `NSPhotoLibraryUsageDescription`: "…choose an existing photo when you **upload an identity document** or set your profile picture."

The app no longer captures or uploads identity documents ([src/screens/profile/DocumentsCard.tsx:27-40](src/screens/profile/DocumentsCard.tsx#L27-L40) — read-only). The camera **is** used for the profile picture, which the camera string does not mention.

**Why this matters.** Guideline 5.1.1(ii): "Ensure your purpose strings clearly and completely describe your use of the data." Reviewers read these prompts on device and look for the described feature.

**Evidence.** [app.json:15-16](app.json#L15-L16), the plugin blocks for `expo-image-picker` and `expo-camera` in [app.json](app.json), and the introspection output.

**Required change.** Accurate, consistent strings.

**Recommended fix.** Use one camera string in all three places (`ios.infoPlist`, `expo-image-picker.cameraPermission`, `expo-camera.cameraPermission`): "Zob Connect uses your camera to take a live photo when you clock in or out, to set up face verification, and to take your profile picture." Photo library: "Zob Connect lets you choose an existing photo as your profile picture." If STORE-031 removes the library permission request entirely, the library string can be removed too. Consider localised `InfoPlist.strings` for the 10 languages via `ios.infoPlist` locales (optional).

**Platform console action.** None. **External action.** None.

**Verification.** Introspection / built `Info.plist` shows the new strings. The on-device prompts read correctly.

---

### STORE-015 — Google Play Data Safety form not prepared

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Android | Metadata / Privacy | 🟠 High | Confirmed gap | 🔴 Pending | Unassigned | 2026-09-28 | — | — |

**Current state.** Nothing in the repo records Data Safety answers. The app collects precise location (foreground and background), name, email, phone, address, employee ID, DOB, gender, PAN, Aadhaar number (sent to KYC vendor), bank account + IFSC, selfies, a face template, profile photo, leave/regularisation free text, push token, and device integrity (Developer Mode) signals. ML Kit sends diagnostics/per-installation identifiers to Google.

**Why this matters.** Mandatory for publishing. A mismatch between the form, the privacy policy and actual behaviour is a common policy strike (Play User Data policy).

**Evidence.** Section C; [K. Draft store declarations](#k-draft-store-declarations); ML Kit data disclosure page.

**Required change.** Complete, accurate Data Safety declaration for the release build.

**Recommended fix.** Use the draft in section K, adjusted for STORE-005 (background location), STORE-029 (retention) and STORE-037 (crash reporting, if added).

**Platform console action.** Google Play Console → App content → Data safety. **External action.** Must match the final privacy policy (STORE-009).

**Verification.** Second-person review of the form against section K and the release build's merged manifest. The Play Console shows "Data safety: completed".

---

### STORE-016 — App Store Connect App Privacy ("nutrition label") not prepared

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| iOS | Metadata / Privacy | 🟠 High | Confirmed gap | 🔴 Pending | Unassigned | 2026-09-28 | — | — |

**Current state.** No App Privacy answers exist. `NSPrivacyCollectedDataTypes` is deliberately omitted from the app's privacy manifest ([app.config.js](app.config.js) F3 comment), so App Store Connect is the only place collection is declared.

**Why this matters.** Required before submission. It must be consistent with the privacy policy and the SDKs' own privacy manifests (ML Kit declares its own collected data types, and Apple aggregates them in the privacy report).

**Evidence.** [app.config.js](app.config.js) `privacyManifests`; section K.

**Required change.** Complete App Privacy answers.

**Recommended fix.** Use the draft in section K. After the first TestFlight upload, generate the **Privacy Report** in Xcode (Organizer → Archive → Generate Privacy Report) or from the EAS `.xcarchive`, and reconcile it with the answers.

**Platform console action.** App Store Connect → App Privacy. **External action.** None.

**Verification.** The Privacy Report's collected types ⊆ the declared types. The ASC App Privacy section is published.

---

### STORE-017 — Play Console declarations for a monitoring app with a location foreground service

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Android | Metadata / Policy | 🟠 High | Confirmed gap | 🔴 Pending | Unassigned | 2026-09-28 | — | — |

**Current state.** No console work recorded. The app targets API 36 and uses `FOREGROUND_SERVICE_LOCATION` (declaration + video required on the App content page), background location (STORE-005), camera, and employer monitoring.

**Why this matters.** Each missing declaration blocks the release on the Play side, or leads to rejection after review.

**Evidence.** Introspected permissions (section C); Play Console Help 13392821 (FGS), 9799150 (background location), 12955211 (monitoring flag).

**Required change / recommended fix.** Complete in Play Console → App content:
1. **App access** — credentials + instructions (STORE-003).
2. **Ads** — "No, my app does not contain ads".
3. **Content rating** (IARC questionnaire). Answer "shares user location with others" honestly: managers/HR see attendance location outcomes.
4. **Target audience and content** — 18+ only.
5. **Data safety** (STORE-015) incl. deletion URL (STORE-010).
6. **Foreground service permissions** — type `location`, use case "mid-shift presence check at assigned store while clocked in", video.
7. **Location permissions** declaration (if STORE-005 option B).
8. **Financial features** declaration — state none (the ₹1 penny-drop is account verification by a vendor, not a financial service). ⚪ Confirm wording.
9. **Government apps / News / Health / COVID** — No.
10. **Advertising ID** — "No". ⚪ Confirm the merged manifest has no `com.google.android.gms.permission.AD_ID`.

**Platform console action.** Google Play Console. **External action.** Record videos on the final build.

**Verification.** App content page shows every section complete with no warnings. The internal testing release passes pre-review checks.

---

### STORE-018 — App Store Connect app record, review information and compliance answers

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| iOS | Metadata | 🟠 High | Confirmed gap | 🔴 Pending | Unassigned | 2026-09-28 | — | — |

**Current state.** No ASC configuration recorded; `eas.json` `submit.production` is empty.

**Why this matters.** Review needs the app record, a support URL, review contact details, demo credentials and notes, age rating (the updated questionnaire), export compliance and availability.

**Required change / recommended fix.**
1. Create the app (bundle ID `com.sdcomputronix.ziphrmsmobile`, SKU, primary language English (India) or English (U.S.)).
2. Category **Business**. Price Free.
3. **Availability: India only.** This also keeps the app out of the EU, so no DSA trader-status requirement.
4. Age rating questionnaire (no objectionable content → expected 4+; the app is for adults, and the policy says 18+).
5. App Privacy (STORE-016). Privacy Policy URL. **Support URL** (a real page — see STORE-020).
6. Export compliance: `ITSAppUsesNonExemptEncryption=false` is already set (HTTPS only).
7. App Review Information: contact name/phone/email, demo account, notes (template in section F, STORE-003).
8. Distribution method per STORE-002.
9. Fill `submit.production.ios` (`ascAppId`, `appleTeamId`) in `eas.json`.

**Platform console action.** App Store Connect. **External action.** Apple Developer Program membership (STORE-019).

**Verification.** The ASC version page shows no missing required fields. A TestFlight build is attached.

---

### STORE-019 — Developer accounts, publisher identity and signing credentials not settled

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both | External / Build | 🟠 High | Needs Verification | ⚪ Needs Verification | Unassigned | 2026-09-28 | — | — |

**Current state.** Unknown from the repo which Apple/Google accounts will publish. The EAS project was moved to `contactkiwis-team` (commit `c0fcdda`), and earlier internal APKs were built under a different EAS project (`kiwi-bytes`, `fb842050…`). The privacy policy names "Zob Connect" (TODO: legal entity) as data fiduciary. The package ID says `sdcomputronix`.

**Why this matters.**
- **Apple:** apps are commonly rejected when the seller name on the account does not match the brand/entity the app represents (Guideline 5.2 intellectual property). An **Organization** account (D-U-N-S number) in the name of the entity that owns Zob Connect avoids that.
- **Google Play:** *personal* accounts created after Nov 2023 must run a **closed test with ≥12 opted-in testers for 14 consecutive days** before production access (⚪ verify the current rule for the account type used). Organization accounts are exempt and need a D-U-N-S number.
- **Signing:** the first Play upload fixes the upload key (use Play App Signing). If the EAS project move generated a new Android keystore, existing internal APKs cannot be upgraded in place. The keystore must be backed up.

**Required change.** Decide the publishing entity, enrol the accounts, and settle credentials.

**Recommended fix.** Publish from **organisation** accounts owned by the legal entity named in the privacy policy (likely the client). Add Kiwi Bytes members as developers. Run `eas credentials` for both platforms under `contactkiwis-team`, download a keystore backup, and enrol in Play App Signing.

**Platform console action.** Both. **External action.** D-U-N-S number, account enrolment fees, identity verification.

**Verification.** Seller/developer name in both consoles = legal entity in the privacy policy. The EAS credentials page shows the production keystore and iOS distribution certificate/profile. The keystore backup is stored in the team password manager.

---

### STORE-020 — Store listing content and assets not prepared (including required monitoring disclosure)

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both | Metadata | 🟠 High | Confirmed gap | 🔴 Pending | Unassigned | 2026-09-28 | — | — |

**Current state.** No listing copy, screenshots or support page in the repo. `https://web.zobconnect.com` serves a landing page, privacy and terms. There is no support/contact page.

**Why this matters.** Play requires monitoring apps to **disclose the monitoring/tracking functionality in the store description**. Apple requires a working **Support URL**. Both require screenshots of the real app (no placeholder content — Apple 2.3).

**Required change / recommended fix.**
- **Play:** title (≤30), short description (≤80), full description with an explicit paragraph: "Zob Connect is an attendance app provided by your employer. While you are clocked in, it checks your location about every 12 minutes (including when the app is closed), takes a live selfie with face verification at clock-in and clock-out, and checks whether Developer Mode is on. A notification is shown while checks are running. Accounts are issued by your employer's HR team." Also phone screenshots (≥2), feature graphic 1024×500, 512×512 icon, category Business, contact email, privacy URL.
- **Apple:** name, subtitle, description (same honesty), keywords, promotional text, 6.9" iPhone screenshots (and iPad 13" if STORE-026 keeps iPad), support URL, marketing URL (optional), copyright.
- Create `https://web.zobconnect.com/support` (contact email, grievance officer, how to get an account, deletion link).
- Screenshots must use the demo data, not real employees' names or faces.

**Platform console action.** Both. **External action.** Copywriting, design assets, web deploy.

**Verification.** Listing previews render in both consoles. The Play description contains the monitoring paragraph. The support URL returns 200 logged-out.

---

### STORE-021 — Legal positions not signed off (DPDP, Aadhaar, biometrics, retention, employee monitoring)

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both | Legal | 🟠 High | Needs Verification | ⚪ Needs Verification | Unassigned | 2026-09-28 | — | — |

**Current state.** The policy file itself says the legal positions "need counsel before publication". The app collects Aadhaar numbers (via third-party KYC), PAN, bank details, biometric templates, continuous shift-time location, and device integrity signals, and it makes face verification mandatory for attendance.

**Why this matters.** These are the highest-sensitivity data classes in Indian law. Store reviewers do not adjudicate Indian law, but an inaccurate or unlawful policy creates post-launch removal risk and regulatory exposure. Specific questions:
- DPDP Act 2023 + DPDP Rules 2025 (phased commencement — ⚪ confirm which obligations are in force at launch): notice content, consent for biometrics, legitimate-use basis for employment, grievance officer, breach notice.
- Aadhaar Act / UIDAI rules on collecting Aadhaar numbers via a KYC vendor (who is the requesting entity? is offline/masked handling sufficient?).
- Whether mandatory face verification needs an alternative for employees who refuse or withdraw consent.
- Retention periods: location checks (STORE-029), punch selfies (60 days default), face templates, KYC records.
- Data location (STORE-009 item 3).

**Required change.** Written counsel sign-off, reflected in the policy, terms and in-app copy.

**Platform console action.** Neither. **External action.** Engage counsel; client confirms legal entity and employment-contract wording on monitoring.

**Verification.** Signed-off policy version recorded in section M, with date.

---

### STORE-022 — Account deletion: gated users cannot reach it, employees without email cannot use it, no timeframe given

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both | Authentication / Legal | 🟡 Medium | Confirmed | 🟡 In Progress | Unassigned | 2026-09-28 | — | Partly done; rest needs backend + a decision |

> **Review & fix, 28 Sep 2026.** The onboarding checklist and the mandatory-policy screen now show the deletion card and the privacy/terms links. The policy screen also gained the sign-out it never had. The set-password screen gets privacy/terms only: the backend's `mustChangePassword` allow-list refuses `/auth/me/deletion/*`, so deletion there needs a backend change (STORE-042). **Still open:** a route for employees with no email, and the stated timeframe (HR decision).

**Current state.** Deletion lives at Profile → Account & privacy, inside `AppTabs`. Users on the **onboarding checklist**, the **mandatory-policy screen**, or the **forced set-password screen** have a signed-in account but no route to deletion or to the privacy policy (the policy screen also has no sign-out). The confirmation code is emailed, and the backend refuses when the employee has no email ("has no email on file"), while `Employee.email` is nullable. The UI says HR "is reviewing your request" with no timeframe.

**Why this matters.** Apple 5.1.1(v) requires in-app deletion for apps with accounts, and Apple's account-deletion guidance asks apps to tell users how long deletion takes. Play requires an in-app path. A new employee who changes their mind during onboarding is exactly the person likely to want deletion.

**Evidence.** [src/navigation/RootNavigator.tsx](src/navigation/RootNavigator.tsx) gate order; [src/screens/onboarding/OnboardingChecklistScreen.tsx](src/screens/onboarding/OnboardingChecklistScreen.tsx) (sign-out only); [src/screens/onboarding/AcceptPoliciesScreen.tsx](src/screens/onboarding/AcceptPoliciesScreen.tsx) (no sign-out, no legal links); [../SD_Computer/src/modules/auth/accountDeletion.service.js:55-72](../SD_Computer/src/modules/auth/accountDeletion.service.js#L55-L72); [../SD_Computer/src/modules/auth/auth.service.js:936](../SD_Computer/src/modules/auth/auth.service.js#L936).

**Required change.** Deletion and the privacy policy reachable from every signed-in state. A route for employees without email. A stated timeframe.

**Recommended fix.** Add a small "Account & privacy" footer (privacy, terms, request deletion, sign out) to the checklist, policy and set-password screens. When the code request fails with no-email, show the email/web deletion route (STORE-010). Add "We'll complete your request within N days" (decide N with HR/counsel) to `del.pendingBody` and the policy.

**Platform console action.** None. **External action.** HR agrees an SLA.

**Verification.** From each gate screen, reach the deletion sheet. An account with no email sees the alternative route. The text shows the timeframe.

---

### STORE-023 — iOS declares background mode `fetch` that the app never uses

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| iOS | Build / Policy | 🟡 Medium | Confirmed | 🟢 Completed | Unassigned | 2026-09-28 | 2026-09-28 | Introspection: no UIBackgroundModes |

> **Review & fix, 28 Sep 2026.** `expo-task-manager` uninstalled, and `legacyTaskCleanup.ts` and `LEGACY_BACKGROUND_LOCATION_TASK` deleted. The cleanup was marked "keep for one release cycle", and every internal APK since 17 Sep has already run it. `expo-location` only uses the task manager for background location *updates*, which this app does not use. Introspection: `UIBackgroundModes` absent.

**Current state.** `UIBackgroundModes = ["fetch"]` is added by the autolinked `expo-task-manager` config plugin. The app uses `expo-task-manager` only in `legacyTaskCleanup.ts`, which unregisters an old **Android** location task from pre-shift-timer APKs. No background fetch is ever registered, and on iOS the cleanup does nothing.

**Why this matters.** Guideline 2.5.4: background modes may only be used for their intended purposes. Unused background modes regularly draw review questions or rejections ("we were unable to locate any features that require persistent background …").

**Evidence.** [node_modules/expo-task-manager/plugin/build/withTaskManager.js](node_modules/expo-task-manager/plugin/build/withTaskManager.js); [src/utils/legacyTaskCleanup.ts](src/utils/legacyTaskCleanup.ts); [index.ts:9-13](index.ts#L9-L13); introspection output.

**Required change.** No `UIBackgroundModes` entries that the app does not use.

**Recommended fix.** Store installs are fresh, so the legacy task cannot exist on them. Delete `legacyTaskCleanup.ts`, its call in `index.ts`, `LEGACY_BACKGROUND_LOCATION_TASK`, and the `expo-task-manager` dependency. If internal APK upgrades still matter, keep the cleanup behind `Platform.OS === 'android'` and strip `fetch` with a config plugin for iOS store builds instead.

**Platform console action.** None. **External action.** None.

**Verification.** The built Info.plist has no `UIBackgroundModes` (or only modes with a documented use). The app still boots on Android.

---

### STORE-024 — Choosing a profile photo from the library likely fails on Android 12 and below

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Android | Technical | 🟡 Medium | Potential (needs device test) | 🟡 In Progress | Unassigned | 2026-09-28 | — | Code done; needs Android ≤12 device test |

> **Review & fix, 28 Sep 2026.** `ProfilePhoto.pickImage` now requests only the camera permission. Confirmed in `ImagePickerModule.kt`: on API < 33 the media-library request is `WRITE_EXTERNAL_STORAGE`, which `app.json` blocks, and `launchImageLibraryAsync` enforces no permission itself. See also STORE-040, a gap this item missed.

**Current state.** `pickImage('library')` calls `ImagePicker.requestMediaLibraryPermissionsAsync()` first and aborts unless granted. On Android ≤ 12 (API ≤ 32) expo-image-picker requests `WRITE_EXTERNAL_STORAGE` + `READ_EXTERNAL_STORAGE`. `app.json` **blocks** `WRITE_EXTERNAL_STORAGE`, so it is not in the manifest, and Android denies a request for an undeclared permission. On Android 13+ the request is empty and succeeds.

**Why this matters.** A large share of field phones in India run Android 10–12. The feature appears broken ("Photos access needed"). minSdk is 24, so these devices can install the app.

**Evidence.** [src/screens/profile/ProfilePhoto.tsx:35-45](src/screens/profile/ProfilePhoto.tsx#L35-L45); [node_modules/expo-image-picker/android/src/main/java/expo/modules/imagepicker/ImagePickerModule.kt](node_modules/expo-image-picker/android/src/main/java/expo/modules/imagepicker/ImagePickerModule.kt) `getMediaLibraryPermissions`; [app.json:40](app.json#L40).

**Required change.** Library pick must work on every supported Android version.

**Recommended fix.** Do not request media-library permission before `launchImageLibraryAsync`. The system picker / `ACTION_GET_CONTENT` needs none. Keep the camera permission request. (Same change fixes STORE-031 on iOS.)

**Platform console action.** None. **External action.** None.

**Verification.** On Android 10, 12, 13 and 14 devices/emulators: Profile → photo → "Choose from library" opens the picker and uploads.

---

### STORE-025 — Shift-timer service can crash-loop if location permission is revoked during a shift

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Android | Technical / Stability | 🟡 Medium | Potential | 🟡 In Progress | Unassigned | 2026-09-28 | — | Needs an Android build + revoke test |

> **Review & fix, 28 Sep 2026.** `onStartCommand` now checks for a location permission and wraps `startForegroundCompat()` in `try/catch (Exception)`. On failure it cancels the alarm, calls `stopSelf()` and returns `START_NOT_STICKY` (`stopWithoutRestart()`). Not compiled locally. The "report as unknown, not location-off" part (step 3) is **not done**: it needs backend agreement.

**Current state.** `ShiftTimerService.onStartCommand` always calls `startForeground(…, FOREGROUND_SERVICE_TYPE_LOCATION)` and returns `START_REDELIVER_INTENT`. Revoking location permission kills the process, and the system then restarts the service. On Android 14+, `startForeground` with type `location` throws `SecurityException` if no location permission is held. Nothing catches it, so the process crashes and is restarted again. Separately, a service restarted from the background has no while-in-use access (relevant to STORE-005 option A), so ticks get "timeout", which the server may treat as a location gap.

**Why this matters.** Crash loops show up in Android vitals (bad-behaviour thresholds affect Play visibility) and can trigger a Play pre-launch report crash. An employee penalised for a gap the phone could not measure is an HR problem.

**Evidence.** [modules/shift-timer/.../ShiftTimerService.kt:160-172, 212-220](modules/shift-timer/android/src/main/java/expo/modules/shifttimer/ShiftTimerService.kt#L160-L172).

**Required change.** The service must stop cleanly when it cannot legally run as a location FGS.

**Recommended fix.** Before `startForeground`, check `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION`. Wrap `startForeground` in `try/catch (SecurityException)` (and `ForegroundServiceStartNotAllowedException` on API 31+). On failure: cancel the alarm, `stopSelf()`, return `START_NOT_STICKY`. Let the tick report an explicit "no permission" state that the server does not count as location-off.

**Platform console action.** None. **External action.** Possibly backend: accept a "permission revoked" condition.

**Verification.** Android 14/15/16: clock in → revoke location in Settings → no crash dialog, no restart loop in logcat, the notification disappears, and the app shows why on next open.

---

### STORE-026 — iPad support is on, so iPad screenshots and iPad/landscape behaviour will be reviewed

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| iOS | Build / UX / Metadata | 🟡 Medium | Confirmed | 🟢 Completed | Unassigned | 2026-09-28 | 2026-09-28 | app.json |

> **Review & fix, 28 Sep 2026.** `ios.supportsTablet: false`. **Still to see:** `UIDeviceFamily=[1]` in the first IPA, and an iPad compatibility-mode smoke test.

**Current state.** `ios.supportsTablet: true`. The generated plist allows all four orientations on iPad with `UIRequiresFullScreen=false`, while the app's layouts were built portrait-phone-first (`orientation: portrait`).

**Why this matters.** A universal app needs iPad screenshots in App Store Connect and is reviewed on iPad, where landscape and Split View are then in play. Layout problems on iPad are a common 2.1/4.0 rejection. A field-attendance app has no iPad use case.

**Evidence.** [app.json:11](app.json#L11); introspection (`UISupportedInterfaceOrientations~ipad`).

**Required change.** Either properly support iPad or ship iPhone-only.

**Recommended fix.** Set `supportsTablet: false`. iPads still run the app in iPhone compatibility mode, and reviewers may still open it on an iPad, so smoke-test that.

**Platform console action.** App Store Connect (no iPad screenshots needed once iPhone-only). **External action.** None.

**Verification.** The built plist has `UIDeviceFamily=[1]`. ASC does not ask for iPad screenshots. The app works in compatibility mode on an iPad.

---

### STORE-027 — Release build / version / OTA configuration not production-ready

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both | Build / Configuration | 🟡 Medium | Confirmed | 🟡 In Progress | Unassigned | 2026-09-28 | — | Environments done; versioning not |

> **Review & fix, 28 Sep 2026.** Done: `environment` named on all three profiles, and production URLs in EAS (STORE-001). **Not done:** `appVersionSource: remote` + `autoIncrement`. It changes how every team build is numbered, so it needs the team's agreement first.

**Current state.**
- `eas.json`: `appVersionSource: "local"`, no `autoIncrement`, no `environment` on the production profile, `submit.production: {}`.
- `versionCode: 1` / `buildNumber: "1"` are hand-maintained. Every store upload needs a higher number.
- `runtimeVersion` policy `appVersion` → `1.0.0`. An earlier internal APK is also runtime `1.0.0` on the `preview` channel. Production builds use channel `production`, so they are separated, but an OTA published to `production` with native changes would crash store builds.
- The local `uat` has an **unpushed** commit (`0e0876b`). Store builds must come from a pushed, tagged commit.
- `expo-dev-client` is still a dependency (its plugin is filtered for store profiles; the exported scheme `exp+zip-hrms-mobile` still appears). ⚪ Confirm no dev-launcher code ships in the release binary.
- The OTA "tap to update" build stamp is visible to users (fine), but OTA content must stay within Apple 2.5.2 / 3.3.1(b) (bug fixes, no new features that change the app's purpose without review).

**Why this matters.** Failed uploads (duplicate version codes), unreproducible builds, and OTA crashes in production.

**Evidence.** [eas.json](eas.json), [app.json](app.json), [app.config.js](app.config.js) (runtimeVersion), [scripts/publish-update.js](scripts/publish-update.js), `git status` (ahead 1).

**Required change / recommended fix.** Set `cli.appVersionSource: "remote"` and `build.production.autoIncrement: true`. Add `"environment": "production"`. Fill `submit.production` (Android service account JSON + track `internal`; iOS `ascAppId`). Tag release commits (`mobile-v1.0.0`). Write a short OTA rule in the README: "OTA to `production` only for JS-only fixes of the same runtime; any native/package change = new build + review".

**Platform console action.** Play service account for `eas submit` (optional). **External action.** EAS.

**Verification.** `eas build -p all --profile production` succeeds from a tagged commit. Uploads are accepted with auto-incremented numbers. `eas update --branch production` is documented and dry-run tested against a production build.

---

### STORE-028 — Push notification credentials for production not confirmed

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both | Configuration | 🟡 Medium | Needs Verification | ⚪ Needs Verification | Unassigned | 2026-09-28 | — | — |

**Current state.** Android push needs `google-services.json` at build time. `app.config.js` adds it **only if present**, and otherwise the build silently ships without FCM. It also needs the FCM V1 service-account key in EAS credentials. iOS needs an APNs key in EAS credentials, and entitlements show `aps-environment=development` in introspection (EAS normally sets production for store signing). The backend sends through Expo's push service using projectId `1b235d14…`. If Expo "enhanced push security" is enabled, the backend's Expo access token must belong to the new owner account.

**Why this matters.** Silent failure: leave/regularisation decisions and policy notices never arrive, and nobody notices until users complain. Reviewers who test notifications see nothing.

**Evidence.** [app.config.js](app.config.js) (FIREBASE section), [src/hooks/usePushNotifications.ts](src/hooks/usePushNotifications.ts), introspected entitlements.

**Required change.** Verified push delivery on production builds of both platforms.

**Recommended fix.** `eas env:create --environment production --name GOOGLE_SERVICES_JSON --type file`. `eas credentials` → Android → FCM V1 key; iOS → APNs key. Consider failing the production build when `GOOGLE_SERVICES_JSON` is missing.

**Platform console action.** Neither (Firebase console + Apple developer portal). **External action.** Firebase project, APNs key.

**Verification.** A test notification sent from the production backend arrives on a TestFlight build and a Play internal-testing build, and tapping it opens the right tab.

---

### STORE-029 — Location-check coordinates are kept indefinitely

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both (backend) | Privacy | 🟡 Medium | Confirmed | 🔴 Pending | Unassigned | 2026-09-28 | — | — |

**Current state.** `geo_fence_events` receives raw coordinates every ~12 min per clocked-in employee. Punch photos have a prune job (`ATTENDANCE_PHOTO_RETENTION_DAYS`, default 60) and notifications have one (90 days). **No prune job exists for `geo_fence_events`.** The policy says location is kept for "attendance record retention" without a number.

**Why this matters.** Data minimisation (Apple 5.1.1(iii), DPDP storage limitation). A stated retention must be enforced, and it drives what the disclosure can honestly say (STORE-006).

**Evidence.** [../SD_Computer/src/modules/attendance/attendance.punch.js:635-650](../SD_Computer/src/modules/attendance/attendance.punch.js#L635-L650); [../SD_Computer/src/modules/attendance/attendance.photoPrune.js](../SD_Computer/src/modules/attendance/attendance.photoPrune.js) (pattern to copy); [../SD_Computer/migrations/004_create_geo_fence_events.sql](../SD_Computer/migrations/004_create_geo_fence_events.sql).

**Required change.** A defined, enforced retention for location-check rows (and a statement of what summary survives, e.g. inside/outside + distance).

**Recommended fix.** Backend: `GEO_EVENTS_RETENTION_DAYS` (value from counsel), and a daily prune that deletes or nulls `latitude/longitude/accuracy_m` on `location-check` rows older than N days while keeping `is_within_fence` and `distance_from_site_m` for the attendance record. Idempotent migration if a column change is needed. Update the policy and disclosure.

**Platform console action.** None (Data Safety retention answers follow). **External action.** Backend deploy (SD_Computer `main` via cherry-pick per team workflow).

**Verification.** Seed old rows, run the job, confirm the coordinates are gone and the summaries kept. The job is visible in server logs.

---

### STORE-030 — Android map loads its library from three public CDNs and tiles from OpenFreeMap at runtime

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Android | Privacy / Technical | 🟡 Medium | Confirmed | 🔴 Pending | Unassigned | 2026-09-28 | — | — |

**Current state.** The Android geofence card renders MapLibre GL JS 5.24.0 in a WebView, fetched from `cdn.jsdelivr.net`, `unpkg.com` or `cdnjs.cloudflare.com` (SRI-pinned), with vector tiles from `tiles.openfreemap.org`. The employee's coordinates stay inside the WebView, but the tile requests reveal the approximate area being viewed (the store and the employee's surroundings), plus IP address and time.

**Why this matters.** These are third parties receiving data derived from location. The privacy policy lists jsDelivr for the wrong purpose and omits the other three (STORE-009). Remote script in a WebView is allowed on both stores (not "downloaded executable code" in the Play sense), but bundling removes three third parties and a runtime dependency on CDN availability.

**Evidence.** [src/components/libreMapPage.ts:49-64](src/components/libreMapPage.ts#L49-L64), [src/components/GeofenceMap.libre.tsx](src/components/GeofenceMap.libre.tsx).

**Required change.** Either bundle the library or disclose all hosts. Tiles must be disclosed either way.

**Recommended fix.** Ship `maplibre-gl.js`/`.css` as a local asset inlined into the page (≈1 MB, compressed in the bundle), leaving OpenFreeMap as the only map third party, and list it in the policy with its attribution.

**Platform console action.** None. **External action.** Policy update (STORE-009).

**Verification.** With the three CDN hosts blocked (e.g., via a proxy), the map still renders. The policy lists OpenFreeMap.

---

### STORE-031 — iOS asks for Photo Library access that the system picker does not need

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| iOS | Permissions / Privacy | 🟢 Low | Confirmed | 🟡 In Progress | Unassigned | 2026-09-28 | — | Code done with STORE-024; needs iOS test |

> **Review & fix, 28 Sep 2026.** Done together with STORE-024: no Photos prompt before the picker. The plist string was kept (see STORE-014).

**Current state.** Before opening the library, the app calls `requestMediaLibraryPermissionsAsync()`, which on iOS shows the Photos access prompt. `launchImageLibraryAsync` uses PHPicker (iOS 14+) and needs no permission.

**Why this matters.** Guideline 5.1.1(iii) data minimisation, and a needless prompt. Harmless for approval in most cases.

**Evidence.** [src/screens/profile/ProfilePhoto.tsx:35-45](src/screens/profile/ProfilePhoto.tsx#L35-L45).

**Required change / recommended fix.** Same change as STORE-024: drop the library permission request, then remove `NSPhotoLibraryUsageDescription` / `photosPermission` if nothing else uses them (⚪ confirm expo-image-picker does not require the key to be present).

**Platform console action.** None. **External action.** None.

**Verification.** iOS: choosing a photo shows the picker with no permission prompt.

---

### STORE-032 — `READ_EXTERNAL_STORAGE` is declared but not needed

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Android | Permissions | 🟢 Low | Confirmed | 🟢 Completed | Unassigned | 2026-09-28 | 2026-09-28 | Introspection: blocked |

> **Review & fix, 28 Sep 2026.** `android.permission.READ_EXTERNAL_STORAGE` added to `blockedPermissions` (after STORE-024 removed the only request). **Still to see:** that the merged manifest in the AAB omits it, and that the Android 10–12 photo/document/policy flows still work.

**Current state.** Merged in from `expo-file-system` and `expo-image-picker`. `WRITE_EXTERNAL_STORAGE` is blocked but `READ_…` is not. The app only writes to its own cache and uses the system picker.

**Why this matters.** Minimisation. It shows in the store's permission list and invites questions. It is inert at target 36 but granted on older Android.

**Recommended fix.** Add `android.permission.READ_EXTERNAL_STORAGE` to `blockedPermissions` **after** STORE-024 lands (so nothing requests it). Retest profile photo and policy/document viewing on Android 10–12.

**Evidence.** Introspection permission list; dependency manifests.

**Platform console action.** None. **External action.** None.

**Verification.** The merged manifest from the AAB has no `READ_EXTERNAL_STORAGE`. The flows above still work.

---

### STORE-033 — Third-party iOS privacy manifests and required-reason coverage not confirmed

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| iOS | Build / Privacy | 🟢 Low | Needs Verification | ⚪ Needs Verification | Unassigned | 2026-09-28 | — | — |

**Current state.** App-level `privacyManifests` declares FileTimestamp C617.1, UserDefaults CA92.1, SystemBootTime 35F9.1, DiskSpace E174.1, tracking false. `PrivacyInfo.xcprivacy` was found in RN core, async-storage, and several expo modules. None was found in `react-native-vision-camera`, `react-native-vision-camera-face-detector`, `jail-monkey`, `react-native-webview`, `react-native-svg` or `expo-location`/`expo-camera`/`expo-image-picker`/`expo-secure-store` (⚪ some may ship them via pods not visible in `node_modules`). `GoogleMLKit/FaceDetection 9.0.0` brings Google pods that are on Apple's "commonly used SDKs" list (GoogleDataTransport, GoogleUtilities, GTMSessionFetcher, PromisesObjC, nanopb…), which must include their own manifests. `jail-monkey` stats files **outside** the app container, which C617.1 does not cover.

**Why this matters.** Missing or incorrect manifests produce ITMS-91053 / 91061 notices, which can block upload.

**Recommended fix.** After the first TestFlight upload, read the App Store Connect email. Generate the Xcode Privacy Report from the archive. If flagged, add reasons (for example 0A2A.1 / 3B52.1 do not fit jailbreak detection, so consider not calling `jail-monkey` on iOS at all: the Developer Mode check is Android-only).

**Platform console action.** App Store Connect (upload feedback). **External action.** None.

**Verification.** Upload accepted with no ITMS-9105x/9106x warnings. The privacy report is reconciled with STORE-016.

---

### STORE-034 — App Transport Security value in the real iOS build not confirmed

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| iOS | Security / Build | 🟢 Low | Needs Verification | ⚪ Needs Verification | Unassigned | 2026-09-28 | — | — |

**Current state.** Introspection showed `NSAllowsArbitraryLoads: true` + a `localhost` exception, but that came from `@expo/config-plugins`' **placeholder** Info.plist used during introspection, not the real prebuild template. All app traffic is https except the dev-only localhost fallback (STORE-001).

**Why this matters.** If a release plist does allow arbitrary loads, Apple asks for a justification and it weakens transport security.

**Recommended fix.** Inspect the Info.plist inside the first EAS iOS build artifact (or run `npx expo prebuild -p ios --clean` in a throwaway clone). If arbitrary loads are allowed, set `ios.infoPlist.NSAppTransportSecurity = { NSAllowsArbitraryLoads: false }` for production.

**Platform console action.** None. **External action.** None.

**Verification.** The release Info.plist shows `NSAllowsArbitraryLoads` false/absent.

---

### STORE-035 — Location and notification prompts appear on first launch without context

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both | UX / Permissions | 🟢 Low | Recommendation | 🟡 In Progress | Unassigned | 2026-09-28 | — | Location part done; push prompt unchanged |

> **Review & fix, 28 Sep 2026.** `useLocationReadiness` reads silently on mount (`acquire(false)`) and has a new `not-asked` state, so a fresh install shows no red banner before anything has been asked. The first Punch In tap brings the system prompt. On Android the notification prompt now comes at clock-in (STORE-012). **Not changed:** `usePushNotifications` still asks right after sign-in.

**Current state.** Right after sign-in, `usePushNotifications` requests notification permission (it runs even during onboarding). As soon as Home mounts, `ClockPanel` (compact) calls `acquire(true)`, which shows the location prompt before the user has tapped anything.

**Why this matters.** Not a policy violation (the purpose strings are good), but prompts that come from nowhere get denied, and Play/Apple guidance prefers requests in context. A denial here makes STORE-012 harder.

**Evidence.** [src/hooks/useLocationReadiness.ts:243-250](src/hooks/useLocationReadiness.ts#L243-L250); [src/hooks/usePushNotifications.ts:66-98](src/hooks/usePushNotifications.ts#L66-L98).

**Recommended fix.** On mount use `acquire(false)` (read-only) and show the banner. Prompt on the first Punch In tap (already implemented in `ensureFix`). Ask for notifications after onboarding completes, with a one-line in-app explanation.

**Platform console action.** None. **External action.** None.

**Verification.** Fresh install: no system prompt until the user taps Punch In / accepts the notifications explainer.

---

### STORE-036 — User-facing English strings outside the translation catalogue

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both | UX | 🟢 Low | Confirmed | 🟡 In Progress | Unassigned | 2026-09-28 | — | Only the tracking notification done |

> **Review & fix, 28 Sep 2026.** The foreground-service notification is now localised (STORE-012). Reminders, integrity alerts, "Outside your store" and the camera overlay are still English.

**Current state.** The app ships 10 complete catalogues, but these are hard-coded English: FGS notification ("Clocked in / Checking your shift status periodically", `ShiftTimerService.kt`), clock-out and break reminders ([src/utils/notifications.ts](src/utils/notifications.ts)), integrity alerts ([src/utils/shiftIntegrityCheck.ts](src/utils/shiftIntegrityCheck.ts)), "Outside your store" ([src/tasks/shiftTimerTask.ts](src/tasks/shiftTimerTask.ts)), camera overlay "Live selfie · liveness check" ([src/screens/attendance/CameraCaptureScreen.vision.tsx:105](src/screens/attendance/CameraCaptureScreen.vision.tsx#L105)), and the WebView stage labels (Expo Go only). The API client's fallback error messages are also English.

**Why this matters.** Monitoring notices and warnings about attendance penalties should be understood by the employee (DPDP notice in a language the person understands). Quality signal only for store review.

**Recommended fix.** Route through `t()`. In the headless task, rehydrate `preferencesStore` first, then use `t` with `currentLanguage()`. Pass notification strings into the native module.

**Platform console action.** None. **External action.** Translations for new keys.

**Verification.** Switch to Hindi → clock in → notification, reminders and alerts appear in Hindi.

---

### STORE-037 — No production crash reporting

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both | Technical / QA | 🟢 Low | Recommendation | 🔴 Pending | Unassigned | 2026-09-28 | — | — |

**Current state.** No Sentry/Crashlytics/Bugsnag. Errors go to `console.warn` only.

**Why this matters.** "No known production crashes" (final checklist) cannot be demonstrated after launch, and the native FGS/camera paths are where crashes have happened before (see commit history). Android vitals will show crashes, but without JS stack traces.

**Recommended fix.** Optional: add `@sentry/react-native` with PII scrubbing (no selfies, no coordinates, no IDs in breadcrumbs). If added, declare "Crash logs" / "Diagnostics" in STORE-015/016 and name Sentry in the policy.

**Platform console action.** Declarations if added. **External action.** Sentry account.

**Verification.** A test crash from a release build appears in Sentry with source maps.

---

### STORE-038 — Android auto-backup is enabled

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Android | Security | 🟢 Low | Needs Verification | 🟢 Completed | Unassigned | 2026-09-28 | 2026-09-28 | Introspection: allowBackup=false |

> **Review & fix, 28 Sep 2026.** `android.allowBackup: false`. Introspection shows `android:allowBackup="false"`.

**Current state.** Introspection shows `android:allowBackup="true"`. `expo-secure-store` normally adds backup rules that exclude its own data (⚪ confirm in the merged manifest). AsyncStorage (consent timestamp, shift state, local alert history, language, theme) would be backed up and restored to a new phone.

**Why this matters.** A restored "disclosure accepted" timestamp on a new device contradicts the design ("a new phone is a new disclosure", `consentStore.ts`). Restored shift state is reconciled by the server, so that part is low risk.

**Recommended fix.** Set `android.allowBackup: false` via config, or add full-backup-content rules that exclude AsyncStorage's database.

**Platform console action.** None. **External action.** None.

**Verification.** The merged manifest shows the chosen setting. Backup/restore to a new device does not carry the consent record.

---

### STORE-039 — Every iOS punch receipt is shown as a warning that names "iOS"

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| iOS | UX / Reviewer Flow | 🟢 Low | Confirmed | 🟢 Completed | Unassigned | 2026-09-28 | 2026-09-28 | Code |

> **Review & fix, 28 Sep 2026.** `noMidShiftCheckLabel` is `null` for installed iOS builds, so the receipt uses the success tone with no suffix. Expo Go and web keep their label.

**Current state.** On iOS, `noMidShiftCheckLabel === 'iOS'`, so every successful clock-in/out shows the amber "warning" tone with "No mid-shift location checks on iOS." appended.

**Why this matters.** The Apple reviewer's first successful action looks like a warning about the platform they are reviewing on. It is harmless, but it invites a question and reads as unfinished (Guideline 2.1 / 4.0 polish).

**Evidence.** [src/native/runtime.ts:61](src/native/runtime.ts#L61); [src/screens/attendance/ClockPanel.tsx:409-431](src/screens/attendance/ClockPanel.tsx#L409-L431).

**Recommended fix.** In store builds, show the normal success tone on iOS and drop the runtime suffix. Keep the label only for Expo Go / web diagnostics.

**Platform console action.** None. **External action.** None.

**Verification.** iOS release build: clock-in shows the green success receipt.

---
### STORE-040 — Profile-photo *camera* also fails on Android 9 and below (added in review)

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Android | Technical | 🟢 Low | Confirmed | 🔴 Pending | Unassigned | 2026-09-28 | — | — |

**Current state.** `ImagePickerModule.kt` `ensureCameraPermissionsAreGranted()` asks for `WRITE_EXTERNAL_STORAGE` as well as `CAMERA` when `SDK_INT < Q` (Android 9 and below). `app.json` blocks that permission, so on those phones "Take a photo" for the profile picture is always refused. STORE-024 covers only the library path. Punch selfies are unaffected (they use VisionCamera). minSdk is 24, so Android 7–9 can install the app.

**Recommended fix.** Either accept it (a small share of devices, and the profile photo is optional), or declare `WRITE_EXTERNAL_STORAGE` with `android:maxSdkVersion="28"` through a config plugin instead of blocking it outright.

**Verification.** Android 9 emulator: Profile → photo → camera opens.

---

### STORE-041 — Withdrawing face consent does not delete the enrolment photo in Drive (added in review)

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both (backend) | Privacy / Legal | 🟠 High | Confirmed | 🔴 Pending | Unassigned | 2026-09-28 | — | — |

**Current state.** `withdrawConsent()` in `SD_Computer/src/face/face.service.js` stamps the consent withdrawn, soft-deletes the template and resets `face_status`. It never deletes the enrolment photo that `enrol()` uploaded to Drive (`face-enrolment/<employeeId>`). The privacy policy says withdrawal removes it.

**Why this matters.** A described control that does not do what the policy says is the same class of problem as STORE-006/007, and it now has a visible button (STORE-013).

**Recommended fix.** Store the Drive file id with the template (or look it up by folder), and delete it inside the withdrawal flow. On failure, log it and queue a retry rather than failing the withdrawal. Deploy per the backend workflow. Alternatively, change the policy to say the photo is kept for N days after withdrawal (a counsel decision).

**Verification.** Withdraw on a test account → the Drive folder no longer holds the photo.

---

### STORE-042 — Account deletion is refused while a password change is pending (added in review)

| Platform | Category | Severity | Type | Status | Owner | Date identified | Date fixed | Verification |
|---|---|---|---|---|---|---|---|---|
| Both (backend) | Authentication / Legal | 🟡 Medium | Confirmed | 🔴 Pending | Unassigned | 2026-09-28 | — | — |

**Current state.** `SD_Computer/src/middleware/mustChangePassword.js` allows only `/auth/me/password`, `/auth/me`, `/auth/logout(-all)` and `/auth/refresh` for a session holding an admin-issued password. `/auth/me/deletion/*` is refused with `PASSWORD_CHANGE_REQUIRED`, so the app cannot offer deletion on the set-password screen (STORE-022).

**Recommended fix.** Add the three `/auth/me/deletion` routes to `ALLOWED`, then render `DeleteAccountCard` on `SetPasswordScreen`.

**Verification.** An account with an issued password can request and confirm deletion from the set-password screen.

---
## E. Master pending checklist

Tick an item only when its section-D status block says 🟢 Completed with verification evidence.

### 🔴 Must fix before submission

- [x] STORE-001 — Set production API/web URLs in EAS `production` env; make builds fail without a public https API URL
- [ ] STORE-002 — Decide iOS distribution (Unlisted / Custom App / public SaaS) before creating the ASC listing
- [ ] STORE-003 — Create two fully onboarded review accounts on production and write review notes
- [x] STORE-004 — Change monitoring flag key to `isMonitoringTool`
- [ ] STORE-005 — Decide and implement background-location approach (drop it, or file declaration + video)
- [ ] STORE-006 — Correct the "no trail" claim in the location disclosure (10 locales)
- [ ] STORE-007 — Correct the "never the photo itself" claim on face enrolment (10 locales)
- [ ] STORE-008 — Declining the disclosure must still record the punch; never gate clock-out; ask before the camera
- [ ] STORE-009 — Finalise privacy policy (legal entity, recipients, data location, paths, withdrawal) and redeploy web
- [ ] STORE-010 — Publish a public account-deletion web page
- [ ] STORE-011 — Sign-out revokes server session and wipes per-user local state
- [ ] STORE-012 — Localised, location-explicit monitoring notification with monochrome icon; handle notifications denied
- [ ] STORE-013 — Add in-app face-verification consent withdrawal
- [x] STORE-014 — Fix iOS camera/photo purpose strings
- [ ] STORE-022 — Deletion + privacy links reachable from every gated screen; no-email route; timeframe
- [x] STORE-023 — Remove unused iOS `fetch` background mode (drop `expo-task-manager`)

### 🟠 Strongly recommended before submission

- [ ] STORE-024 — Fix Android ≤12 profile-photo library pick (drop media permission request)
- [ ] STORE-025 — Make the shift-timer service stop cleanly when location permission is missing
- [x] STORE-026 — Set `supportsTablet: false` (or fully support iPad)
- [ ] STORE-027 — Remote versioning + autoIncrement, explicit production environment, submit config, tagged pushed commits, OTA rule
- [ ] STORE-029 — Enforce retention on location-check coordinates (backend)
- [ ] STORE-030 — Bundle MapLibre locally (or disclose all CDN hosts)
- [ ] STORE-031 — Stop requesting iOS Photo Library permission
- [x] STORE-032 — Block `READ_EXTERNAL_STORAGE` (after STORE-024)
- [ ] STORE-035 — Ask for location/notifications in context, not on first render
- [ ] STORE-036 — Translate notification, reminder, alert and camera-overlay strings
- [ ] STORE-037 — (Optional) Add crash reporting with PII scrubbing
- [x] STORE-038 — Decide Android auto-backup behaviour
- [x] STORE-039 — Show a normal success receipt on iOS store builds

- [ ] STORE-041 — Delete the Drive enrolment photo on face-consent withdrawal (backend)
- [ ] STORE-042 — Allow account deletion for sessions with a pending password change (backend)
- [ ] STORE-040 — (Low) Profile camera on Android ≤9

### 🟡 Console / configuration / external actions

- [ ] STORE-015 — Complete Google Play Data Safety (draft in section K)
- [ ] STORE-016 — Complete App Store Connect App Privacy (draft in section K)
- [ ] STORE-017 — Complete Play App content declarations (App access, Ads, IARC, Target audience 18+, FGS location + video, Location, Financial features, AD_ID)
- [ ] STORE-018 — Create ASC app record, India-only availability, review info, support URL, export compliance, `eas.json` submit config
- [ ] STORE-019 — Settle publishing accounts (organisation, D-U-N-S), seller name, EAS credentials and keystore backup
- [ ] STORE-020 — Store listings (monitoring disclosure in Play description), screenshots, feature graphic, support page
- [ ] STORE-021 — Counsel sign-off (DPDP, Aadhaar, biometrics, retention, data location)
- [ ] STORE-028 — Production push credentials (google-services.json, FCM V1, APNs) verified end-to-end
- [ ] STORE-033 — After first TestFlight upload: check privacy-manifest notices, reconcile privacy report
- [ ] STORE-034 — Confirm ATS in the real release Info.plist

### 🟢 Verified / no action required

See [section J](#j-verified--no-action-required) for the full list with evidence. In short: no IAP/ads/tracking; enterprise-login exception applies; in-app deletion exists; policy + terms public; iOS never asks for Always location; dev-launcher plist keys stripped; microphone and overlay permissions blocked; target SDK 36; iOS min 16.4; exempt-encryption flag set; tokens in secure storage; OTP echo blocked in production; app-level privacy manifest; translations complete; TypeScript clean.

---

## F. Point-by-point remediation plan

Conventions: **Repo** = where the change goes. Follow the team git workflow (pull first, feature branch, explicit `git add` paths, ask before pushing `uat`). After any `eas`/`expo` CLI run, check `git status` for unintended rewrites of `app.json`.

### STORE-001 — Production API URL
**Status:** Pending · **Platform:** Both · **Priority:** Critical · **Repo:** SD_Comp_Moblie + EAS
1. `eas env:list --environment production` and record what exists.
2. `eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://api.zobconnect.com --visibility plaintext` and the same for `EXPO_PUBLIC_WEB_URL=https://web.zobconnect.com`.
3. In `eas.json` add `"environment": "production"` to `build.production` (and `"environment": "preview"` / `"development"` to the others, so nothing is implicit).
4. In `package.json` add `"eas-build-pre-install": "node scripts/check-api-url.js"`. Confirm the script reads the env var EAS injects (it checks `process.env` first).
5. In `src/constants/config.ts` replace the localhost fallback: in `__DEV__` keep `http://localhost:3000`, otherwise throw a clear error at module load if unset.
6. Build once with the variable deliberately removed on a scratch environment and confirm the build fails.

**Verification:** EAS build log shows `✔ EXPO_PUBLIC_API_URL = https://api.zobconnect.com`. The installed build signs in. Network inspector/proxy shows only `api.zobconnect.com`.
**Definition of Done:** A production build cannot be produced with a missing or non-https API URL.

### STORE-002 — iOS distribution model
**Status:** Blocked (decision) · **Platform:** iOS · **Priority:** Critical
1. Product owner decides: **Unlisted** (recommended), **Custom App (ABM)**, or public listing as a SaaS product.
2. Unlisted: create the app in ASC, submit the build for review as normal, and submit Apple's Unlisted App Distribution request form referencing the app. Custom App: get the client's ABM Organization ID and select "Private" availability.
3. Public: only if the website offers Zob Connect to other employers. Add that page and describe it in the review notes.
4. Record the decision and date in this item.

**Verification:** Apple confirms unlisted status / the custom app appears in the client's ABM.
**Definition of Done:** The distribution method is set in ASC and consistent with the review notes and listing text.

### STORE-003 — Reviewer access
**Status:** Pending · **Platform:** Both · **Priority:** Critical · **Repo:** production backend data (+ optional SD_Computer change)
1. Decide the face-check approach: (a) the reviewer re-enrols their own face, or (b) a server flag `face_check_exempt` on review accounts only (audited, never settable from the app).
2. If (a): on staging, check that re-enrolment from Profile → Identity → Face verification does **not** reset `approvalStatus` or the onboarding gate. If it does, use (b).
3. On production create store `DEMO01` (fake address) with geofence exemption or radius ≥ 50 km.
4. Create `EMP-REVIEW-A` and `EMP-REVIEW-G`: fake names, fake email mailboxes you control (needed for OTP/deletion demo), role `field-employee`, **no shift template**, all onboarding steps satisfied (with verification disabled on prod, `required` is profile + face + approval; otherwise mark KYC rows verified via admin tooling, **never** with real IDs), HR-approved, own password (not admin-issued), no outstanding mandatory policies, gender/DOB filled.
5. Sign in with each on a release build from outside India time/location and walk the full path (see Verification).
6. Paste the review notes into ASC (App Review Information → Notes) and Play (App access → instructions):

```
Zob Connect is an attendance app issued by an employer to its field staff. Accounts are created by
HR; there is no public sign-up. Please use this test account (it is not used by anyone else):
  Employee ID: EMP-REVIEW-A     Password: ********
Steps: 1) Sign in. 2) [If using option (a)] Profile → Identity → Face verification → re-register your
face (a live selfie with a blink/head-turn check). 3) Home → Punch In: allow location and camera,
follow the blink/turn prompts. Because you are outside the demo store, your mark is accepted and
flagged "pending HR approval" — this is expected. 4) Punch Out the same way. Other features: Leave
tab, Attendance history, Profile → Account & privacy (privacy policy, account deletion request).
Location is only checked at clock-in and, on Android, about every 12 minutes while clocked in.
iOS never uses background location. No purchases, ads or tracking. Contact: <name, phone, email>.
```

**Verification:** Clean install → full path without help, both platforms, both accounts signed in simultaneously.
**Definition of Done:** Credentials and notes entered in both consoles. Accounts tested within 48 h of submission.

### STORE-004 — Monitoring flag key
**Status:** Pending · **Platform:** Android · **Priority:** Critical · **Repo:** SD_Comp_Moblie
1. In `plugins/withMonitoringTool.js` set `FLAG = 'isMonitoringTool'`. Also remove any existing `android.content.isMonitoringTool` entry (or keep both — decide and comment why).
2. Update the doc comment to cite Play Console Help answer 12955211.
3. Run introspection and confirm.
4. After the first AAB: `bundletool dump manifest --bundle app.aab | grep -i monitoring`.

**Verification:** As above.
**Definition of Done:** The AAB manifest contains `isMonitoringTool=enterprise_management`.

### STORE-005 — Background location approach
**Status:** Blocked (decision) · **Platform:** Android · **Priority:** Critical · **Repo:** SD_Comp_Moblie
1. Spike option A on a branch: remove `ACCESS_BACKGROUND_LOCATION` from `app.json`. In `useLocationPollingEffect`, require only foreground permission. Remove `requestBackgroundPermissionsAsync` from `ClockPanel`, but keep the disclosure (it still accurately says checks continue when the app is closed).
2. Build a dev client. On Android 12, 13, 14, 15, 16 (+1 OEM device): clock in, swipe the app away, lock the screen for 60 min, and check the server for ~5 location checks with coordinates.
3. Test process death: `adb shell am kill com.sdcomputronix.ziphrmsmobile` while clocked in, then observe the ticks. Pair with STORE-025 so "no access" is reported as unknown.
4. If A passes, adopt it. Update the disclosure/policy wording and the Data Safety answer (background location still "collected", since collection happens while the app is not visible).
5. If A fails, keep B: film a ≤30 s video on the final build (Home → Punch In → disclosure → "Allow all the time" → notification visible → clock-out stops it) and write the declaration ("Mid-shift presence verification at the employee's assigned store while clocked in; stops at clock-out").
6. Either way, file the **Foreground service (location)** declaration with its own video (STORE-017).

**Verification:** See the section D verification.
**Definition of Done:** The shipped manifest matches the chosen option, and the matching Play declarations are approved.

### STORE-006 — Location disclosure accuracy
**Status:** Pending · **Platform:** Android · **Priority:** Critical · **Repo:** SD_Comp_Moblie
1. Agree the retention wording with STORE-029/021.
2. Edit `loc.discloseNotTrack` → move it out of "What we never do". Add a "What we keep" line: "Each check is saved with your attendance record for N days."
3. Update all 10 locale files (keys must stay in sync; run the key-coverage check used in this audit).
4. Re-read the whole disclosure against the policy's "Location — what is actually tracked" section.

**Verification:** Screenshot the disclosure in English and Hindi and attach it to this item.
**Definition of Done:** The disclosure, privacy policy and backend behaviour agree.

### STORE-007 — Face enrolment copy
**Status:** Pending · **Platform:** Both · **Priority:** Critical · **Repo:** SD_Comp_Moblie
1. ⚪ Check whether Drive is enabled on production (`/health/deps` → `documents`). Write the copy so it is true either way ("may be kept").
2. Rewrite `face.intro` (and review `face.consent`) in 10 locales, mentioning the stored set-up photo, the punch selfies, and withdrawal (STORE-013).
3. Cross-check the policy wording.

**Verification:** On-device screenshot attached.
**Definition of Done:** No claim that photos are never stored.

### STORE-008 — Disclosure decline behaviour
**Status:** Pending · **Platform:** Android · **Priority:** High · **Repo:** SD_Comp_Moblie
1. Move the disclosure/permission step from `handleCaptured` into `openPunch('clock-in')`, after `ensureFix` succeeds and before `setPendingAction('clock-in')`.
2. `agreed === false` → continue to the camera, no background request, then show the "periodic checks are off" alert after the punch lands.
3. Clock-out path never shows the disclosure.
4. Fix the comment in `BackgroundLocationDisclosure.tsx`. Rewrite `loc.discloseDecline` (10 locales).
5. Regression-test the Android 11+ behaviour where the background request opens Settings: returning from Settings must not lose the punch.

**Verification:** The three scenarios in section D, on Android 13 and 14.
**Definition of Done:** No path where the disclosure blocks a punch.

### STORE-009 — Privacy policy
**Status:** Pending · **Platform:** Both · **Priority:** High · **Repo:** SD_Comp_Web (`src/legal/content.js`)
1. Get the registered legal entity name + address from the client. Set `legalName`. Remove the "DRAFT" status comment once counsel signs (STORE-021).
2. Recipients table: fix the jsDelivr row (Android map library, not liveness in store builds); remove or mark storage.googleapis.com as development-only; add OpenFreeMap, unpkg.com, cdnjs.cloudflare.com (or drop them after STORE-030), Google ML Kit (diagnostics), Expo push service + Apple Push Notification service, the SMTP provider actually used for OTP email (⚪ identify), and the hosting/database providers.
3. "Where your data is held": confirm the production server location (145.223.18.164 per team notes) and database region. Correct the statement.
4. Permissions table: camera = selfie, face set-up photo, profile picture. Remove "photographing documents".
5. Location: add "On iPhone, location is only read at clock-in"; add retention from STORE-029.
6. Deletion: exact in-app path, web page URL (STORE-010), timeframe (STORE-022).
7. Withdrawal: describe the in-app control from STORE-013.
8. Bump `lastUpdated`. Deploy the web app.
9. ⚪ Check the rendered page without JavaScript. If empty, add a prerendered/static HTML version of `/privacy` and `/terms`.

**Verification:** Review the diff against section C. Open the live page on a phone. `curl` or JS-disabled check.
**Definition of Done:** Live policy final, accurate, counsel-approved, dated.

### STORE-010 — Web deletion page
**Status:** Pending · **Platform:** Android (Play) · **Priority:** High · **Repo:** SD_Comp_Web (+ optional SD_Computer)
1. Add public route `/delete-account` outside `RequireAuth`, titled "Delete your Zob Connect account".
2. Content: in-app steps, email route (grievance email, quote employee ID, send from registered address), what is deleted, what is retained and why, timeframe, grievance officer.
3. Optional form: employee ID → emailed OTP → confirm (new unauthenticated, rate-limited endpoint mirroring `/auth/me/deletion/*`).
4. Link it from the privacy policy and the landing page footer. Deploy.
5. Enter the URL in Play Data Safety.

**Verification:** The page loads logged-out on mobile.
**Definition of Done:** URL live and saved in Play Console.

### STORE-011 — Sign-out hygiene
**Status:** Pending · **Platform:** Both · **Priority:** High · **Repo:** SD_Comp_Moblie
1. Add `logout()` to `auth.api.ts` → `POST /auth/logout` (5 s timeout, errors ignored).
2. In `authStore.signOut`: if not already a forced sign-out after a failed refresh, call `logout()` first. Then `stopShiftTimer()`, `clearAuth()`, `queryClient.clear()` (export the client from a module or register a sign-out callback from `App.tsx`), `useShiftStore.getState().setClockedOut()`, `useNotificationsStore.getState().clear()`, `useConsentStore.getState().clearConsents()`, cancel all scheduled local notifications, and delete cached `document-*`/profile-photo files in `Paths.cache`.
3. Scope remaining unscoped query keys by employee ID as a second line of defence.
4. Confirm with the backend that `/auth/logout` also unregisters push tokens for that session (the devices.api comment says the session owns the token).

**Verification:** The A→B shared-device test in section D, plus a server check that A's refresh token is rejected.
**Definition of Done:** No cross-user data after sign-out, and the server session is revoked.

### STORE-012 — Monitoring notification
**Status:** Pending · **Platform:** Android · **Priority:** High · **Repo:** SD_Comp_Moblie (Kotlin + JS)
1. Add a monochrome notification icon: set `expo-notifications` plugin `icon: "./assets/notification-icon.png"` (white-on-transparent, 96×96), and use the generated drawable (`notification_icon`) in `ShiftTimerService.setSmallIcon`.
2. Extend `ShiftTimerModule.start(intervalMs, title, text, channelName)`. Persist the strings in SharedPreferences for restarts. Send localised strings from `useLocationPollingEffect`.
3. Wording: title "On shift — location checks on"; text "Zob Connect checks your location about every 12 minutes until you clock out." Channel "Shift location checks".
4. Before `start()`, on Android 13+, request `POST_NOTIFICATIONS` (with a one-line explanation). If denied: show a persistent in-app banner on Home + Attendance while tracking runs, and mention it in the disclosure.
5. Tap on the notification opens the Attendance tab.

**Verification:** Section D check, plus screenshots for the Play FGS video.
**Definition of Done:** Tracking is always visibly indicated, with an identifiable icon and location-explicit wording in the user's language.

### STORE-013 — Face consent withdrawal
**Status:** Pending · **Platform:** Both · **Priority:** High · **Repo:** SD_Comp_Moblie
1. In `KycCard` (face row, registered state) add "Withdraw consent", using `ConfirmDialog` tone danger.
2. Body text: what happens (template deleted; you cannot clock in/out until you set it up again).
3. On confirm call `withdrawFaceConsent()` and invalidate `['face-status', id]`, `['profile-kyc-status', id]`, `onboardingGateQueryKey(id)`.
4. Localise (10 locales).
5. Confirm with the backend that withdrawal deletes the Drive enrolment photo too (the policy says it does).

**Verification:** Section D check + DB/Drive confirmation.
**Definition of Done:** Withdrawal is one screen away from where consent was given and does what the policy says.

### STORE-014 — iOS purpose strings
**Status:** Pending · **Platform:** iOS · **Priority:** High · **Repo:** SD_Comp_Moblie (`app.json`)
1. Set identical camera text in `ios.infoPlist.NSCameraUsageDescription`, `expo-image-picker.cameraPermission`, `expo-camera.cameraPermission`.
2. Photo library text → profile picture only (or remove with STORE-031).
3. Introspect and confirm the final plist values.

**Verification:** Plist values + on-device prompts.
**Definition of Done:** Every purpose string describes a feature that exists.

### STORE-015 — Play Data Safety
**Status:** Pending · **Platform:** Android · **Priority:** High · **Where:** Play Console
1. Wait for STORE-005/009/029/030/037 decisions.
2. Enter the answers from section K. Deletion URL from STORE-010.
3. A second person reviews against the release AAB's merged manifest and the policy.

**Definition of Done:** Form submitted, no Play warnings.

### STORE-016 — App Store App Privacy
**Status:** Pending · **Platform:** iOS · **Priority:** High · **Where:** App Store Connect
1. Enter the answers from section K.
2. After the first TestFlight upload, generate the privacy report and reconcile it (with STORE-033).

**Definition of Done:** Published and reconciled.

### STORE-017 — Play App content declarations
**Status:** Pending · **Platform:** Android · **Priority:** High · **Where:** Play Console
1. Upload the first AAB to **Internal testing** (needed before several declarations unlock).
2. Complete each section listed in section D (App access, Ads, IARC, Target audience 18+, Data safety, FGS location, Location (if B), Financial features, Government/News/Health, Advertising ID).
3. Record the FGS video: Punch In → notification visible → app closed → notification persists → Punch Out → notification gone (≤30 s, show the permission dialogs).
4. Resolve any pre-launch report issues.

**Definition of Done:** App content shows all green. Internal track release is available.

### STORE-018 — App Store Connect setup
**Status:** Pending · **Platform:** iOS · **Priority:** High · **Where:** App Store Connect + `eas.json`
1. Create the app record (after STORE-019). Set category, price, **availability India only**.
2. Age rating questionnaire. Export compliance (no non-exempt encryption).
3. URLs: privacy, support (STORE-020).
4. Review information + notes (STORE-003).
5. Add `submit.production.ios.ascAppId` to `eas.json`. Run `eas submit -p ios`.
6. TestFlight internal test on 2+ devices before submitting for review.

**Definition of Done:** Version page complete. A build has passed TestFlight processing.

### STORE-019 — Accounts, identity, credentials
**Status:** Needs Verification · **Platform:** Both · **Priority:** High · **External**
1. Client confirms the legal entity. Obtain its D-U-N-S number.
2. Enrol Apple Developer Program (Organization) and a Google Play Console organization account in that entity's name (or confirm existing ones). Add team members.
3. ⚪ If a personal Play account must be used, check the current closed-testing requirement and plan 14+ days with ≥12 testers.
4. `eas credentials` (Android): confirm or generate the upload keystore and download a backup to the password manager. Enable Play App Signing on first upload.
5. `eas credentials` (iOS): distribution certificate, provisioning profile, APNs key.
6. Update the team memory/README: EAS owner is `contactkiwis-team`, projectId `1b235d14…`.

**Definition of Done:** Consoles and EAS show the right entity. Keystore backed up.

### STORE-020 — Listings and support page
**Status:** Pending · **Platform:** Both · **Priority:** High · **External + SD_Comp_Web**
1. Write the Play and App Store descriptions (monitoring paragraph in section D is mandatory for Play and recommended for Apple).
2. Capture screenshots from a release build signed in as a review account (no real names/faces; use a staff member who consents, or a mannequin/placeholder face).
3. Feature graphic 1024×500, Play icon 512×512 (from `assets/icon.png`), iPhone 6.9" screenshots.
4. Add `/support` to the web app (contact, grievance officer, how accounts are issued, deletion link). Deploy.

**Definition of Done:** Both listings saved with no missing assets. Support URL live.

### STORE-021 — Legal sign-off
**Status:** Needs Verification · **Platform:** Both · **Priority:** High · **External**
1. Send counsel: the policy, terms, in-app disclosures (location, face, KYC consents, deletion), the data flow table (section C), and the retention questions.
2. Get written answers on DPDP applicability/timeline, Aadhaar handling, mandatory biometric attendance, retention numbers, data location.
3. Apply the changes (STORE-006/007/009/013/022/029). Record the approval date in section M.

**Definition of Done:** Written sign-off stored with the client.

### STORE-022 — Deletion reachability
**Status:** Pending · **Platform:** Both · **Priority:** Medium · **Repo:** SD_Comp_Moblie
1. Create an `AccountFooter` component (privacy · terms · request deletion · sign out).
2. Render it on `OnboardingChecklistScreen`, `AcceptPoliciesScreen`, `SetPasswordScreen`. The deletion sheet must work there too, since its API calls are allowed during onboarding (⚪ verify the server allows `/auth/me/deletion/*` for unapproved and must-change-password sessions).
3. In `DeleteAccountCard`, when the code request fails because there is no email, show the web/email route instead of the raw error.
4. Add a timeframe to `del.pendingBody` (10 locales) and the policy.

**Verification:** Each gate screen → deletion sheet. A no-email account sees the alternative.
**Definition of Done:** Deletion reachable from every signed-in state.

### STORE-023 — Unused iOS background mode
**Status:** Pending · **Platform:** iOS · **Priority:** Medium · **Repo:** SD_Comp_Moblie
1. Remove the `stopLegacyLocationTask` import/call from `index.ts`, delete `src/utils/legacyTaskCleanup.ts` and `LEGACY_BACKGROUND_LOCATION_TASK`.
2. `npm uninstall expo-task-manager`. Check nothing else imports it (`grep -rn expo-task-manager src`).
3. Introspect: `UIBackgroundModes` absent.

**Verification:** iOS plist + Android boot smoke test.
**Definition of Done:** No unused background modes declared.

### STORE-024 — Android ≤12 library pick
**Status:** Pending · **Platform:** Android · **Priority:** Medium · **Repo:** SD_Comp_Moblie
1. In `ProfilePhoto.pickImage`, only request the **camera** permission. Skip the media-library request.
2. Test on API 29/31/32/33/34 emulators.

**Definition of Done:** Library pick works on all supported versions.

### STORE-025 — Service stop on missing permission
**Status:** Pending · **Platform:** Android · **Priority:** Medium · **Repo:** SD_Comp_Moblie (`modules/shift-timer`)
1. In `onStartCommand`: check the location permission, then `try { startForegroundCompat() } catch (e: SecurityException) {…}` (+ `ForegroundServiceStartNotAllowedException` on API 31+).
2. On failure: `cancelAlarm(this)`, `stopSelf()`, return `START_NOT_STICKY`. Log it.
3. In `shiftTimerTask`, when foreground permission is missing, report the condition as unknown (not `location_off: true`), and coordinate with the backend so it is not counted.

**Verification:** Section D check on Android 14+.
**Definition of Done:** No crash loop. No false location-off counts.

### STORE-026 — iPad
**Status:** Pending · **Platform:** iOS · **Priority:** Medium · **Repo:** SD_Comp_Moblie
1. `app.json` → `ios.supportsTablet: false`.
2. Smoke-test in the iPad simulator (compatibility mode).

**Definition of Done:** iPhone-only binary.

### STORE-027 — Build/version/OTA
**Status:** Pending · **Platform:** Both · **Priority:** Medium · **Repo:** SD_Comp_Moblie
1. `eas.json`: `cli.appVersionSource: "remote"`, `build.production.autoIncrement: true`, `environment` per profile, `submit.production` for both platforms.
2. `eas build:version:set` to initialise the remote versionCode/buildNumber at ≥ the highest ever uploaded.
3. Push `0e0876b` (after the team go-ahead). Create tag `mobile-v1.0.0` on the release commit and build from it.
4. Add an "OTA to production" rule to the repo README.
5. ⚪ Confirm the release binary contains no dev-launcher (check the AAB for `expo.modules.devlauncher` classes).

**Definition of Done:** Reproducible, tagged, auto-versioned production builds.

### STORE-028 — Push credentials
**Status:** Needs Verification · **Platform:** Both · **Priority:** Medium · **EAS + Firebase + Apple**
1. Upload `google-services.json` as an EAS file variable (production).
2. Upload the FCM V1 service account key to EAS credentials. Create/upload the APNs key.
3. If Expo push security is on, rotate the backend's Expo access token to the new owner account.
4. Send a test push from the production backend to TestFlight + internal-track builds.

**Definition of Done:** Pushes arrive and route correctly on both platforms.

### STORE-029 — Location retention
**Status:** Pending · **Platform:** Both (backend) · **Priority:** Medium · **Repo:** SD_Computer
1. Add `GEO_EVENTS_RETENTION_DAYS` to `src/config/env.js` (value from STORE-021).
2. Add `geoEventsPrune.js`, modelled on `attendance.photoPrune.js`: null the coordinates of `location-check` rows older than N days (keep `is_within_fence`, `distance_from_site_m`). Schedule daily.
3. Tests + deploy per backend workflow.

**Definition of Done:** Job running in production. Policy states N.

### STORE-030 — Map assets
**Status:** Pending · **Platform:** Android · **Priority:** Medium · **Repo:** SD_Comp_Moblie
1. Add `maplibre-gl@5.24.0` dist files as assets (or inline the minified JS/CSS strings at build).
2. Change `libreMapPage` to load them locally. Keep the SRI check.
3. Test on-device offline-then-online behaviour and first render time.

**Definition of Done:** The map renders with the CDN hosts blocked. The policy lists only OpenFreeMap.

### STORE-031 — iOS photo permission
**Status:** Pending · **Platform:** iOS · **Priority:** Low · Done together with STORE-024; then remove the unused plist string (⚪ check expo-image-picker's config-plugin requirements).

### STORE-032 — READ_EXTERNAL_STORAGE
**Status:** Pending · **Platform:** Android · **Priority:** Low · After STORE-024: add to `blockedPermissions`, then retest the photo/document/policy flows on Android 10–12.

### STORE-033 — iOS privacy manifests
**Status:** Needs Verification · **Platform:** iOS · **Priority:** Low
1. After the first upload, check the email for ITMS-91053/91061.
2. Generate the Privacy Report from the archive and compare with STORE-016.
3. Consider skipping `JailMonkey` calls on iOS entirely (Developer Mode check is Android-only).

### STORE-034 — ATS
**Status:** Needs Verification · **Platform:** iOS · **Priority:** Low · Inspect the release `Info.plist`. If `NSAllowsArbitraryLoads` is true, override it in `app.json` for production.

### STORE-035 — Contextual prompts
**Status:** Pending · **Platform:** Both · **Priority:** Low · **Repo:** SD_Comp_Moblie
1. `useLocationReadiness`: on mount `acquire(false)`. Prompt only on Punch In / Allow tap.
2. `usePushNotifications`: register only after onboarding + policy gates pass, preceded by a one-screen explainer.

### STORE-036 — Untranslated strings
**Status:** Pending · **Platform:** Both · **Priority:** Low · Add keys for each string listed in section D. For the native notification, pass strings from JS (STORE-012). For the headless task, rehydrate `usePreferencesStore.persist` before calling `t`.

### STORE-037 — Crash reporting (optional)
**Status:** Pending · **Platform:** Both · **Priority:** Low · Add Sentry with `beforeSend` scrubbing. Update STORE-009/015/016 before release.

### STORE-038 — Auto-backup
**Status:** Needs Verification · **Platform:** Android · **Priority:** Low · Inspect the merged manifest. Choose `allowBackup=false` or exclusion rules. Test restore.

### STORE-039 — iOS receipt tone
**Status:** Pending · **Platform:** iOS · **Priority:** Low · In `runtime.ts` return `null` for installed iOS builds (keep Expo Go/web labels). Confirm the receipt uses the success tone.

---
## G. Dependencies between fixes

| Item | Depends on | Why |
|---|---|---|
| STORE-003 | 001, 019 | Review accounts live on the production backend the store build talks to, and the accounts/consoles must exist |
| STORE-006 | 029, 021 | The disclosure must state the retention that is actually enforced and legally approved |
| STORE-007 | 013, 021 | The copy points at the withdrawal control; counsel wording |
| STORE-008 | 005 | Which permission is requested after the disclosure depends on the background-location decision |
| STORE-009 | 005, 013, 021, 029, 030, (037) | The policy describes those decisions |
| STORE-010 | 009, 022 | Same deletion wording and timeframe everywhere |
| STORE-012 | 005 | Notification text differs slightly between options A/B |
| STORE-015 | 005, 009, 010, 029, 030, 037 | Data Safety must mirror the final behaviour and policy |
| STORE-016 | 009, 033, 037 | Must match the policy and the SDK privacy report |
| STORE-017 | 003, 004, 005, 008, 012, 015 | Declaration videos must show the final flow; App access needs accounts |
| STORE-018 | 002, 003, 016, 019, 020, 026 | Distribution method, review info, privacy, account, assets, device family |
| STORE-020 | 002, 012, 026, 039 | Listing text/visibility depends on distribution; screenshots show the final UI |
| STORE-022 | 010 | The no-email fallback links to the web deletion page |
| STORE-027 | 001, 019 | Environment + credentials must exist before the real build |
| STORE-028 | 019 | Credentials live under the final accounts |
| STORE-031 | 024 | Same code change |
| STORE-032 | 024 | Only block the permission once nothing requests it |
| STORE-033, 034 | 027 | Need a real iOS build |
| STORE-036 | 012 | Notification strings are passed through the new native API |

## H. Implementation order

Ordered for the fewest rework loops. Items in the same step can run in parallel.

1. **Decisions (product owner, this week — nothing else needs to wait on them except where noted)**
   STORE-002 (iOS distribution) · STORE-005 (background location A/B — start the option A spike now) · STORE-019 (accounts & entity) · engage counsel for STORE-021.
2. **Critical configuration (small, unblocks every build)**
   STORE-001 → STORE-004 → STORE-027 (environment/versioning part).
3. **Policy-sensitive code on Android monitoring**
   STORE-005 (implement chosen option) → STORE-008 → STORE-012 → STORE-025.
4. **Truthful copy and consent controls**
   STORE-006, STORE-007, STORE-013, STORE-014 (all translation work batched into one pass across 10 locales, together with STORE-036).
5. **Account & session hygiene**
   STORE-011 → STORE-022.
6. **Platform cleanup**
   STORE-023, STORE-026, STORE-024 + STORE-031 → STORE-032, STORE-039, STORE-035, STORE-030, STORE-038, (STORE-037).
7. **Backend + web (parallel with 3-6)**
   STORE-029 (backend) · STORE-009 → STORE-010 → STORE-020 support page (web) · STORE-021 sign-off lands here.
8. **Credentials and first release builds**
   STORE-028 → production builds from a tagged commit (STORE-027) → STORE-034, STORE-033 on the first iOS upload.
9. **Reviewer preparation**
   STORE-003 (accounts on production, walk-through on release builds, notes).
10. **Store consoles**
    Play: STORE-017 (internal track first) + STORE-015 · Apple: STORE-018 + STORE-016 · both: STORE-020 listings.
11. **Final QA** — section I on release builds of both platforms.
12. **Submit** — Play: internal → closed (if required by account type) → production. Apple: TestFlight → submit with notes → Unlisted request (if chosen).

**First item to tackle: STORE-001.** It is small, it is critical, and every later step (review accounts, screenshots, declaration videos, QA) needs a build that reaches the real server. Make the STORE-002 and STORE-005 decisions in parallel.

---

## I. Final pre-submission checklist

### Code readiness
- [ ] All 🔴 items in section E completed and verified
- [ ] `npx tsc --noEmit` clean on the release commit
- [ ] Release commit pushed, tagged (`mobile-vX.Y.Z`), and the build made from the tag
- [ ] Production build points at `https://api.zobconnect.com` (check the pre-install log line)
- [ ] No known production crashes: 30-minute monkey/pre-launch run on Android + TestFlight session on iOS with no crash
- [ ] Major flows tested (see Final QA)
- [ ] Error states handled: offline banner, timeouts on punch upload, face mismatch, outside fence, shift window closed, session displaced
- [ ] No dev-only UI or strings visible in store builds (fallback "No liveness check" banner never reachable; build stamp acceptable)
- [ ] OTA rule documented; no `eas update` to `production` until the store build is live

### Android / Google Play
- [ ] AAB built with `targetSdk 36`, `compileSdk 36`, `minSdk 24` (`bundletool dump manifest`)
- [ ] Merged manifest permissions reviewed: expected set only (no `READ_EXTERNAL_STORAGE`, no `RECORD_AUDIO`, no `SYSTEM_ALERT_WINDOW`, no `AD_ID`; `ACCESS_BACKGROUND_LOCATION` only if option B)
- [ ] `isMonitoringTool=enterprise_management` present
- [ ] FGS `type=location` service, localised notification, monochrome icon
- [ ] Signing: EAS upload keystore backed up; Play App Signing enrolled
- [ ] Data Safety completed and matches the policy (section K)
- [ ] App content: App access, Ads, IARC rating, Target audience 18+, FGS declaration + video, Location declaration (if B), Financial features, Government/News/Health
- [ ] Store listing: monitoring disclosure in description, screenshots, feature graphic, icon, category, contact email, privacy URL
- [ ] Deletion URL entered
- [ ] Internal testing release installed from Play on at least 2 real devices (one Android ≤12, one Android 14+)
- [ ] Pre-launch report reviewed
- [ ] Closed-testing requirement satisfied (if a personal account)

### iOS / App Store
- [ ] Release build via EAS with Xcode 26 / iOS 26 SDK; deployment target 16.4
- [ ] Signing: distribution certificate + App Store profile under the publishing team
- [ ] Entitlements: `aps-environment=production` in the signed build
- [ ] Info.plist reviewed: accurate camera/location strings; no unused photo string; no `UIBackgroundModes`; no local-network/Bonjour keys; ATS not arbitrary; `ITSAppUsesNonExemptEncryption=false`; iPhone-only (if STORE-026)
- [ ] Privacy manifest: no ITMS-9105x/9106x notices; privacy report reconciled
- [ ] App Privacy answers published (section K)
- [ ] Metadata: name, subtitle, description, keywords, 6.9" screenshots, support URL, privacy URL, copyright, category Business, availability India
- [ ] Age rating questionnaire answered
- [ ] Distribution method set (Unlisted / Custom / Public) per STORE-002
- [ ] Review information: contact, demo account, notes (STORE-003)
- [ ] TestFlight internal testing passed on 2+ devices

### Privacy / legal
- [ ] Privacy Policy final (no draft/TODO), counsel-approved, dated, publicly reachable, linked in app (login + Account & privacy) and in both consoles
- [ ] Terms of Use final and linked
- [ ] Data collection disclosures consistent across: in-app disclosure, face consent, KYC consents, policy, Data Safety, App Privacy
- [ ] Consent flows: background-location disclosure (decline works), face consent (+ withdrawal), PAN/Aadhaar consent checkboxes
- [ ] Third-party sharing table lists every host the release build and backend send personal data to
- [ ] Account deletion: in-app from every signed-in state, web page, email route, timeframe stated
- [ ] Data deletion/retention: location-check retention enforced; selfie retention configured on production; face template/photo deleted on withdrawal
- [ ] Data location statement verified against the production hosting/DB region

### Final QA (release builds, both platforms unless noted)
- [ ] Fresh install → first launch → language selection → login
- [ ] Login with review account; wrong password message; employee ID vs email login; "remember me" off → relaunch requires login
- [ ] Forgot password (OTP email) end-to-end; forced password change screen
- [ ] Onboarding checklist + policy gate (with a separate fresh test account)
- [ ] Clock in inside fence / outside fence (pending approval) / outside shift window / with location off / with location denied / blocked
- [ ] Liveness + face match success and mismatch; camera permission denied path
- [ ] Android: background disclosure accept/decline; tracking notification visible; ticks arrive with the app swiped away; clock-out stops tracking; break stops tracking
- [ ] Android: notifications denied → documented behaviour
- [ ] Android: revoke location mid-shift → no crash loop
- [ ] Breaks start/end + break reminder; clock-out reminder
- [ ] Leave apply/cancel; regularisation submit; attendance history/day detail
- [ ] Notifications inbox; push received in foreground/background/killed; tap routing
- [ ] Policies read + acknowledge; policy file open/share
- [ ] Profile photo: camera + library (Android 10/12/13/14; iOS)
- [ ] Face consent withdraw → re-enrol
- [ ] Logout → login as another user on the same device → no leftover data or reminders
- [ ] Account deletion request (on a throwaway account) → access revoked immediately → pending banner / login refused
- [ ] Offline: airplane mode → clear "can't reach server" messaging; recovery when back online
- [ ] Team tab as a team lead (read-only)
- [ ] Dark mode + all 10 languages spot-checked on key screens (no clipped text)
- [ ] Small screen (5") and large screen; Android gesture nav + 3-button nav
- [ ] iPad compatibility-mode smoke test (iOS)
- [ ] Production environment confirmed on every screen (no staging data, correct store names)

---

## J. Verified / no action required

| Area | Finding | Evidence |
|---|---|---|
| Payments / IAP / subscriptions | None. No billing libraries; ₹1 penny-drop is a vendor bank-verification deposit to the employee, not a purchase | `package.json`; `BankVerifyScreen.tsx` |
| Ads / analytics / tracking | None. No ATT needed; `NSPrivacyTracking=false`, no tracking domains | `package.json`; `app.config.js` |
| Login services (Apple 4.8) | Employer-issued credentials only, so the enterprise exception applies and no Sign in with Apple is needed | `LoginScreen.tsx` |
| In-app account deletion | Exists (Profile → Account & privacy), OTP-confirmed, revokes access server-side (edge cases in STORE-022) | `DeleteAccountCard.tsx`; `accountDeletion.service.js` |
| Privacy policy & terms reachable | Public routes, HTTP 200, linked from login and Account & privacy | `LegalLinks.tsx`; `SD_Comp_Web/src/App.jsx:80-81` |
| iOS background location | Not requested; Always strings removed; `isIosBackgroundLocationEnabled:false`; only When-In-Use string present | `app.json`; introspection |
| Dev launcher leakage (iOS) | `NSLocalNetworkUsageDescription` / `NSBonjourServices` stripped for non-development profiles | `plugins/withoutDevLauncher.js`; introspection |
| Blocked permissions | `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `WRITE_EXTERNAL_STORAGE` removed; microphone disabled in camera/picker plugins | `app.json`; introspection |
| Target API level | RN 0.86 defaults `targetSdk 36`, `compileSdk 36`, `minSdk 24`, meeting Play's 31 Aug 2026 requirement (confirm on AAB) | `react-native/gradle/libs.versions.toml` |
| iOS minimum / SDK | Deployment target 16.4 (≥ iOS 13 rule); EAS image must use Xcode 26 (default for SDK 57 — confirm in build log) | `ExpoModulesCore.podspec` |
| Export compliance | `ITSAppUsesNonExemptEncryption=false`; only HTTPS/OS crypto | `app.json` |
| Credential storage | Tokens in Keychain/Keystore via `expo-secure-store`; "remember me" opt-out keeps them in memory only | `secureStorage.ts`; `authStore.ts` |
| Refresh-token handling | Single-flight refresh; reuse detection server-side; displaced sessions explained on login | `client.ts` |
| OTP leakage | `EMAIL_ECHO_OTP` refused in production at boot | `SD_Computer/src/config/env.js:1137` |
| Required-reason APIs (app level) | Declared (C617.1, CA92.1, 35F9.1, E174.1) | `app.config.js` |
| Exact alarms | Not used (`setAndAllowWhileIdle`), so no `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` policy exposure | `ShiftTimerService.kt` |
| FGS typing | Long-lived service typed `location`, `startForeground` called synchronously; headless tick service correctly untyped | `modules/shift-timer` |
| Background-location disclosure ordering | Disclosure appears before the system prompt and uses near-prescribed wording (content issues in STORE-006/008) | `ClockPanel.tsx`, `BackgroundLocationDisclosure.tsx` |
| Liveness in store builds | On-device (VisionCamera + ML Kit); WebView/MediaPipe path only in Expo Go; no-liveness fallback unreachable in store builds | `CameraCaptureScreen.tsx`; `runtime.ts` |
| KYC consent | Explicit unchecked consent checkboxes for PAN/Aadhaar and face | `PanVerifyScreen.tsx`, `AadhaarOtpRequestScreen.tsx`, `FaceRegisterScreen.tsx` |
| Deep links / Universal / App Links | None configured. Custom scheme only opens the app. Push taps route through an allow-list of paths | `app.json` scheme; `linkTarget.ts` |
| User-generated content | No public UGC; free text (leave reasons, kudos) visible only within the employer, so no moderation/report requirement | code review |
| Maps on iOS | Apple Maps (no Google key, no billing) | `GeofenceMap.map.tsx` |
| Translations | 10 locales, 0 missing keys vs English | key-coverage check 28 Sep |
| Type safety | `tsc --noEmit` exit 0 | run 28 Sep |
| Demo account shift rule | An employee with no shift template may clock in at any hour (client + server) | `attendanceDay.ts`; `attendance.window.js:112` |

---

## K. Draft store declarations

> Drafts for STORE-015/016. **Re-check after STORE-005, 029, 030, 037 decisions.** "Processors" (KYC vendor, Google Drive, hosting, email) process on our behalf and are not "sharing" under Play's definition. Declare them in the privacy policy.

### K1. Google Play Data Safety (draft)

| Data type (Play) | Collected | Shared | Optional? | Purposes | Notes |
|---|---|---|---|---|---|
| Location → Precise location | Yes | No | Required for clock-in | App functionality; Fraud prevention, security & compliance | Clock-in + ~12-min checks during shift (Android), incl. when app closed |
| Location → Approximate location | Yes | No | Required | Same | Implied by precise |
| Personal info → Name | Yes | No | Required | App functionality; Account management | |
| Personal info → Email address | Yes | No | Required | Account management | OTP delivery |
| Personal info → User IDs | Yes | No | Required | Account management | Employee ID |
| Personal info → Address | Yes | No | Required (profile step) | App functionality | |
| Personal info → Phone number | Yes | No | Required | App functionality | |
| Personal info → Other info | Yes | No | Mixed | App functionality; Fraud prevention | DOB, gender (optional "prefer not to say"), PAN, Aadhaar number (verification only), shirt size |
| Financial info → Other financial info | Yes | No | Required (onboarding) | App functionality | Bank account number + IFSC |
| Photos and videos → Photos | Yes | No | Required (selfie, face set-up); optional (profile photo) | App functionality; Fraud prevention, security & compliance | Face template derived server-side; enrolment photo kept |
| App activity → Other user-generated content | Yes | No | Optional | App functionality | Leave/regularisation reasons, deletion reason |
| App activity → Other actions | Yes | No | Required | App functionality | Attendance marks, breaks, policy acknowledgements |
| App info and performance → Diagnostics | Yes | No | Required | Analytics (ML Kit's own diagnostics) | From Google ML Kit face detection; add crash logs if STORE-037 |
| Device or other IDs | Yes | No | Required | App functionality | Push token; ML Kit per-installation ID; Developer Mode flag (declare under "Other actions" or here) |

Security practices: **data encrypted in transit — Yes**. **Users can request deletion — Yes** (in-app + URL from STORE-010). Independent security review — No (unless done).

### K2. App Store Connect App Privacy (draft)

All types: **Linked to the user's identity: Yes. Used for tracking: No.**

| Apple category → type | Purposes |
|---|---|
| Contact Info → Name, Email Address, Phone Number, Physical Address | App Functionality |
| Location → Precise Location | App Functionality (iOS: at clock-in only) |
| Sensitive Info (biometric data — face template) | App Functionality |
| Financial Info → Other Financial Info (bank account) | App Functionality |
| User Content → Photos or Videos (selfies, enrolment and profile photos) | App Functionality |
| User Content → Other User Content (leave/regularisation reasons) | App Functionality |
| Identifiers → User ID | App Functionality |
| Identifiers → Device ID (push token — ⚪ confirm classification) | App Functionality |
| Diagnostics → Performance Data / Other Diagnostic Data (ML Kit) | Analytics (by SDK) — ⚪ reconcile with ML Kit's privacy manifest |
| Other Data → Other Data Types (PAN, Aadhaar number, DOB, gender) | App Functionality |

---

## L. Sources

Policy pages checked on 2026-09-28:
- Google Play target API requirement (new apps/updates must target API 36 from 31 Aug 2026; extension to 1 Nov 2026): https://developer.android.com/google/play/requirements/target-sdk
- Apple upcoming requirements (Xcode 26 / iOS 26 SDK since 28 Apr 2026; required-reason APIs): https://developer.apple.com/news/upcoming-requirements/
- App Review Guidelines (2.1(a) demo account, 2.5.4, 4.8 enterprise exception, 5.1.1(ii)(iii)(v)): https://developer.apple.com/app-store/review/guidelines/
- Apple Guideline 3.2 rejections for organisation-specific apps (developer forum reports): https://developer.apple.com/forums/thread/801768 · https://developer.apple.com/forums/thread/755917 · https://developer.apple.com/forums/thread/704518
- Play — Use of the isMonitoringTool flag: https://support.google.com/googleplay/android-developer/answer/12955211
- Play — Spyware / monitoring apps policy: https://support.google.com/googleplay/android-developer/answer/14745000
- Play — Background location permissions (prominent disclosure, declaration, video, foreground alternative): https://support.google.com/googleplay/android-developer/answer/9799150
- Play — Foreground service requirements / declaration: https://support.google.com/googleplay/android-developer/answer/13392821
- Play — Account deletion requirements (in-app path + web resource): https://support.google.com/googleplay/android-developer/answer/13327111
- Google ML Kit Android data disclosure: https://developers.google.com/ml-kit/android-data-disclosure

Stated from general knowledge and **not re-verified today** (marked ⚪ where used): Play closed-testing rule for new personal accounts; D-U-N-S requirement for organisation accounts; Apple Unlisted App Distribution eligibility wording; DPDP Rules 2025 commencement dates; iPad screenshot requirements; Play Financial features declaration scope.

---

## M. Change log

| Date | Change | By |
|---|---|---|
| 2026-09-28 | Initial audit: 39 findings (7 Critical, 14 High, 9 Medium, 9 Low) | Claude (audit) |
| 2026-09-28 | Review: claims verified. Added STORE-040/041/042. Code fixes applied to 21 items (8 completed, 13 in progress). See "Review of this audit" in section A | Claude (review) |
