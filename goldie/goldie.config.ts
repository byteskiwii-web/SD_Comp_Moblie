// App Store screenshots for Zob Connect, framed by goldie
// (https://github.com/software-mansion-labs/goldie).
//
// Captured by .github/workflows/store-screenshots.yml on a GitHub-hosted Mac:
// the scenes reuse the explore flows in .argent/flows/explore. `goldie frame`
// renders goldie/out/screenshots/iphone-6.9/en-US/*.png, which store.config.js
// hands to `eas metadata:push`.
const config = {
  appRoot: "..",
  appPath: process.env.APP_PATH ?? "../build-sim",
  bundleId: "com.sdcomputronix.ziphrmsmobile",
  devices: ["iphone-6.9"],
  locales: ["en-US"],
  appearance: "light",
  frame: { variant: "17-pro-blue" },

  theme: {
    // The app's own brand ramp (src/theme/tokens.ts): 50 -> white, 900 text.
    background: "linear-gradient(160deg, #E0E7FF 0%, #EEF2FF 50%, #FFFFFF 100%)",
    headlineColor: "#172554",
    subheadColor: "#3B4FD9",
    fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
    copyHeightRatio: 0.22,
    deviceWidthRatio: 0.84,
    layout: "classic",
  },

  scenes: [
    {
      kind: "screenshot",
      id: "01-attendance",
      flow: "explore/25-lead-attendance",
      headline: { "en-US": "Punch in from your store" },
      subhead: { "en-US": "A live selfie and your location, on the site map." },
    },
    {
      kind: "screenshot",
      id: "02-leave",
      flow: "explore/11-leave",
      headline: { "en-US": "Your leave at a glance" },
      subhead: { "en-US": "Days taken, approvals, comp off and holidays." },
    },
    {
      kind: "screenshot",
      id: "03-apply-leave",
      flow: "explore/12-leave-apply",
      headline: { "en-US": "Apply for leave in seconds" },
      subhead: { "en-US": "Paid, unpaid, comp off or a half day." },
    },
    {
      kind: "screenshot",
      id: "04-regularise",
      flow: "explore/10-attendance-regularise",
      headline: { "en-US": "Missed a punch? Fix it" },
      subhead: { "en-US": "Send an attendance correction to your manager." },
    },
    {
      kind: "screenshot",
      id: "05-verification",
      flow: "explore/15-profile-identity-verification",
      headline: { "en-US": "Onboarding, verified" },
      subhead: { "en-US": "PAN, Aadhaar and bank checks in one place." },
    },
    {
      kind: "screenshot",
      id: "06-language",
      flow: "explore/20-profile-language",
      headline: { "en-US": "In your language" },
      subhead: { "en-US": "English and nine Indian languages." },
    },
  ],
};

export default config;
