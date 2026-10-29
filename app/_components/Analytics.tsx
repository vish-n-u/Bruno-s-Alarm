"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { GA_ID } from "../site";
import { CONSENT_STORAGE_KEY, OPEN_COOKIE_CHOICES } from "./consent";

// Google Analytics 4 with Consent Mode (DECISIONS.md D23). Consent defaults and any saved choice
// are applied by CONSENT_DEFAULT_SCRIPT in layout.tsx <head>, before gtag.js loads. Every visitor
// sees the banner once and can say no; the footer's "Cookie choices" reopens it.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function hasChoice(): boolean {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export default function Analytics() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!hasChoice()) setShowBanner(true);
    const reopen = () => setShowBanner(true);
    window.addEventListener(OPEN_COOKIE_CHOICES, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_CHOICES, reopen);
  }, []);

  function choose(choice: "granted" | "denied") {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    } catch {}
    window.gtag?.("consent", "update", { analytics_storage: choice });
    setShowBanner(false);
  }

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-config" strategy="afterInteractive">
        {`gtag('js', new Date()); gtag('config', '${GA_ID}');`}
      </Script>
      {showBanner && (
        <div className="cookie-banner" role="region" aria-label="Cookie choices">
          <p>
            We use Google Analytics cookies to count visits and see which pages people read.
            Nothing is used for ads. <a href="/privacy#website">More</a>
          </p>
          <div className="cookie-actions">
            <button type="button" className="cookie-no" onClick={() => choose("denied")}>
              No thanks
            </button>
            <button type="button" className="cookie-yes" onClick={() => choose("granted")}>
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Footer link that reopens the banner. */
export function CookieChoicesLink() {
  return (
    <button
      type="button"
      className="footer-link-button"
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_CHOICES))}
    >
      Cookie choices
    </button>
  );
}
