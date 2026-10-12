// App Store listing, pushed with `npx eas-cli@latest metadata:push`.
//
// EAS Metadata signs in with the App Store Connect API key stored on EAS (the
// one `eas submit` uses), so no Apple ID is needed.
//
// THIS REPOSITORY IS PUBLIC. Nothing secret or personal is written here; the
// review sign-in and the review contact come from the environment of whoever
// runs the push:
//   REVIEW_PASSWORD   password of the review accounts
//   REVIEW_OTP        the server's TEST_ACCOUNT_OTP
//   REVIEW_PHONE      contact phone for App Review, with +91
// Without REVIEW_PHONE the whole App Review section is skipped (Apple requires
// a phone in it); the rest of the listing is still pushed.
//
// Apple has no API for the App Privacy answers or for price and availability;
// see APP_STORE_SUBMISSION_AUDIT.md ("iOS submission status") for those.
const fs = require('fs');
const path = require('path');

const env = (name) => (process.env[name] ? process.env[name] : undefined);
const only = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

const description = `Zob Connect is the workplace app for S.D. Computronix field and store staff. Sign in with the employee account issued by your employer — there is no public sign-up.

• Clock in and out with a live selfie and your location
• Breaks, daily and monthly hours, and full attendance history
• Leave and attendance-correction requests with a supporting photo
• Shift reminders and alerts from your team
• Team view for team leads
• Company policies, your profile and documents in one place
• Available in English, Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi, Punjabi, Tamil and Telugu

Your data: see the Privacy Policy. You can request deletion of your account and data at any time from Profile → Privacy & account.`;

const otpLine = env('REVIEW_OTP') ? `\nIf a one-time code is requested, use: ${env('REVIEW_OTP')}\n` : '';

const reviewNotes = `Zob Connect is an internal app for employees of S.D. Computronix. Accounts are issued by HR; there is no public sign-up. We intend to request Unlisted App Distribution for this app.
${otpLine}
This review account is fully set up and works from any location, at any time:
- Attendance tab → Clock In (takes a selfie; location is recorded) → Break → Clock Out
- History, leave and regularisation requests
- Profile → Privacy & account → Request deletion of my data (it sends a request to HR and signs you out; you can sign in again)

Identity documents (PAN, Aadhaar, bank) are collected only during employee onboarding for payroll and are already completed for this account.

Team-lead view: TL-90001 (same password as the review account)`;

// goldie's output (goldie/out/screenshots/iphone-6.9/en-US), in scene order,
// once it exists. 1320x2868 is accepted in the 6.7"/6.9" display slot.
const shotsDir = path.join(__dirname, 'goldie/out/screenshots/iphone-6.9/en-US');
const screenshots = fs.existsSync(shotsDir)
  ? fs.readdirSync(shotsDir).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(shotsDir, f))
  : [];

module.exports = {
  configVersion: 0,
  apple: {
    copyright: '2026 S.D. Computronix',
    categories: ['BUSINESS', 'PRODUCTIVITY'],
    // Released by hand once Apple has approved both the app and the Unlisted
    // distribution request.
    release: { automaticRelease: false },
    info: {
      'en-US': {
        title: 'Zob Connect',
        subtitle: 'Attendance & leave for staff',
        description,
        keywords: ['attendance', 'clock in', 'shift', 'leave', 'employee', 'staff', 'timesheet', 'workforce', 'HR', 'store'],
        promoText: 'Attendance, leave and shift tools for S.D. Computronix staff.',
        supportUrl: 'https://web.zobconnect.com/support',
        privacyPolicyUrl: 'https://web.zobconnect.com/privacy',
        ...(screenshots.length ? { screenshots: { APP_IPHONE_67: screenshots } } : {}),
      },
    },
    // Rates 4+. No chat between users (kudos come from managers only), no
    // user-generated content, no web browser, no ads, no gambling.
    advisory: {
      alcoholTobaccoOrDrugUseOrReferences: 'NONE',
      contests: 'NONE',
      gamblingSimulated: 'NONE',
      gunsOrOtherWeapons: 'NONE',
      horrorOrFearThemes: 'NONE',
      matureOrSuggestiveThemes: 'NONE',
      medicalOrTreatmentInformation: 'NONE',
      profanityOrCrudeHumor: 'NONE',
      sexualContentGraphicAndNudity: 'NONE',
      sexualContentOrNudity: 'NONE',
      violenceCartoonOrFantasy: 'NONE',
      violenceRealistic: 'NONE',
      violenceRealisticProlongedGraphicOrSadistic: 'NONE',
      gambling: false,
      lootBox: false,
      unrestrictedWebAccess: false,
      advertising: false,
      ageAssurance: false,
      healthOrWellnessTopics: false,
      messagingAndChat: false,
      parentalControls: false,
      userGeneratedContent: false,
      seventeenPlus: false,
      kidsAgeBand: null,
      ageRatingOverride: 'NONE',
      koreaAgeRatingOverride: 'NONE',
    },
    ...(env('REVIEW_PHONE') ? { review: only({
      firstName: 'Subir',
      lastName: 'Bhagvati',
      // Already public: the privacy policy's grievance address.
      email: 'zobconnect@gmail.com',
      phone: env('REVIEW_PHONE'),
      demoUsername: 'EMP-90001',
      demoPassword: env('REVIEW_PASSWORD'),
      demoRequired: true,
      notes: reviewNotes,
    }) } : {}),
  },
};
