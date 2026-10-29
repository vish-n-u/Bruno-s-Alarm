// One place for the details the landing, privacy, and terms pages all share.

export const SITE_URL = "https://brunos-alarm.com";
export const CONTACT_EMAIL = "vishnuna26@gmail.com";
export const PACKAGE_NAME = "com.brunosalarm.app";

// GA4 property "Bruno's Alarm website" (separate from the app's Firebase property). DECISIONS.md D23.
export const GA_ID = "G-2THHFCRC7Y";
// Only production builds report, so local dev visits don't count.
export const ANALYTICS_ON = process.env.NODE_ENV === "production";

// Flip to true once the Play listing is public — until then the download button says
// "coming soon" instead of linking to a store page that would 404.
export const PLAY_STORE_LIVE = true;
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}`;

// Keep in step with mobile/privacy-policy.txt and mobile/terms-of-service.txt.
export const PRIVACY_EFFECTIVE = "October 29, 2026";
export const TERMS_EFFECTIVE = "October 2, 2026";
