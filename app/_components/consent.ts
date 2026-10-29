// Shared by layout.tsx (server) and Analytics.tsx (client). DECISIONS.md D23.

export const CONSENT_STORAGE_KEY = "ga-consent";
export const OPEN_COOKIE_CHOICES = "open-cookie-choices";

// EEA + UK + Switzerland: analytics waits for a yes there.
const CONSENT_REGIONS = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IE", "IT",
  "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "GB", "CH",
];

const DENY_ADS = "ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'";

// Runs in <head> before gtag.js: region defaults first, then a choice the visitor already made
// on an earlier visit, so a "No thanks" holds from the very first hit.
export const CONSENT_DEFAULT_SCRIPT = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('consent','default',{${DENY_ADS},analytics_storage:'denied',region:${JSON.stringify(CONSENT_REGIONS)}});gtag('consent','default',{${DENY_ADS},analytics_storage:'granted'});try{var c=localStorage.getItem('${CONSENT_STORAGE_KEY}');if(c==='granted'||c==='denied')gtag('consent','update',{analytics_storage:c});}catch(e){}`;
