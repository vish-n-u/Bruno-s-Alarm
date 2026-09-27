"use client";

import { useEffect } from "react";

// Same boundaries as getTimeOfDay() in mobile/lib/theme.ts.
function phaseAt(date: Date): string {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "afternoon";
  if (h >= 17 && h < 18.5) return "evening";
  return "night";
}

/** The inline script in layout.tsx sets <html data-phase> once, before first paint. This keeps
 * it current for anyone who leaves the page open across a phase boundary. */
export default function PhaseSync() {
  useEffect(() => {
    const id = setInterval(() => {
      document.documentElement.setAttribute("data-phase", phaseAt(new Date()));
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return null;
}
