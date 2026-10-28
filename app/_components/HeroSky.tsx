"use client";

import { useEffect, useState } from "react";

// The app's Home sky, for the website hero: the sun (or moon at night) sits on an arc by the
// visitor's real clock, clouds drift across, a leaf falls now and then. Purely decorative.
// Same sunrise/sunset hours as the app (mobile/components/Sky.tsx): sun 05:00–18:30.

const SUNRISE = 5;
const SUNSET = 18.5;

function position(now: Date) {
  const h = now.getHours() + now.getMinutes() / 60;
  const day = h >= SUNRISE && h < SUNSET;
  const span = day ? SUNSET - SUNRISE : 24 - (SUNSET - SUNRISE);
  const p = day ? (h - SUNRISE) / span : ((h < SUNRISE ? h + 24 : h) - SUNSET) / span;
  const t = Math.min(1, Math.max(0, p));
  // Kept to the upper right, clear of the headline (left column) — the same reason the app's sun
  // stays off its title.
  return { day, left: 52 + 44 * t, top: 16 - 12 * Math.sin(t * Math.PI) };
}

export default function HeroSky() {
  const [pos, setPos] = useState<ReturnType<typeof position> | null>(null);
  useEffect(() => {
    const tick = () => setPos(position(new Date()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hero-sky" aria-hidden="true">
      {pos && (
        <div className={pos.day ? "sky-body sky-sun" : "sky-body sky-moon"} style={{ left: `${pos.left}%`, top: `${pos.top}%` }}>
          {pos.day ? (
            <svg viewBox="0 0 100 100" className="sun-spin">
              <circle cx="50" cy="50" r="20" fill="#ffb300" />
              {Array.from({ length: 8 }, (_, i) => (
                <rect key={i} x="47" y="6" width="6" height="16" rx="3" fill="#ffb300" transform={`rotate(${i * 45} 50 50)`} />
              ))}
            </svg>
          ) : (
            <svg viewBox="0 0 100 100">
              <path d="M62 18a34 34 0 1 0 20 52A28 28 0 1 1 62 18z" fill="#e4ecf7" />
            </svg>
          )}
        </div>
      )}
      <svg className="cloud cloud-1" viewBox="0 0 120 60"><path d="M30 50h65a20 20 0 0 0 0-40 26 26 0 0 0-50 6 18 18 0 0 0-15 34z" /></svg>
      <svg className="cloud cloud-2" viewBox="0 0 120 60"><path d="M30 50h65a20 20 0 0 0 0-40 26 26 0 0 0-50 6 18 18 0 0 0-15 34z" /></svg>
      <svg className="cloud cloud-3" viewBox="0 0 120 60"><path d="M30 50h65a20 20 0 0 0 0-40 26 26 0 0 0-50 6 18 18 0 0 0-15 34z" /></svg>
      <svg className="leaf" viewBox="0 0 24 24"><path d="M4 20C4 9 11 4 21 3c0 10-5 17-16 17zm0 0 8-8" fill="#4f8f4a" stroke="#3b7037" strokeWidth="1" /></svg>
    </div>
  );
}
