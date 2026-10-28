"use client";

import { useEffect, useState } from "react";

// The website's "Watch his last howl": Bruno's newest real session (from /api/last-howl, the same
// source the app's Live tab uses) as a thumbnail that becomes Cloudflare's player on tap, plus
// the average paw rating viewers gave it in the app (Firestore howlRatings/{uid}, public-read).

type Howl = { uid: string; recordedAt: string; duration?: number; thumbnail?: string; embedUrl?: string };
type Rating = { count: number; average: number | null };

const RATINGS_URL = "https://firestore.googleapis.com/v1/projects/bruno-s-howl/databases/(default)/documents/howlRatings/";

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" });
}

export default function LastHowl() {
  const [howl, setHowl] = useState<Howl | null>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [rating, setRating] = useState<Rating | null>(null);

  useEffect(() => {
    fetch("/api/last-howl")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((h: Howl) => setHowl(h))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (!howl) return;
    fetch(RATINGS_URL + howl.uid)
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => {
        const count = Number(doc?.fields?.count?.integerValue) || 0;
        const sum = Number(doc?.fields?.sum?.integerValue) || 0;
        setRating({ count, average: count ? sum / count : null });
      })
      .catch(() => setRating({ count: 0, average: null }));
  }, [howl]);

  if (failed) return null;

  return (
    <div className="howl-card">
      <div className="howl-media">
        {!howl ? (
          <div className="howl-loading">Finding his last howl…</div>
        ) : playing && howl.embedUrl ? (
          <iframe
            src={`${howl.embedUrl}?autoplay=true&muted=false&preload=auto`}
            title="Bruno's last howl"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button type="button" className="howl-thumb" onClick={() => setPlaying(true)} aria-label="Play his last howl">
            {howl.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${howl.thumbnail}?height=720&time=${Math.min(5, Math.floor((howl.duration ?? 10) / 2))}s`} alt="Bruno at his last session" />
            )}
            <span className="howl-play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="34" height="34">
                <path fill="currentColor" d="M7 4.5v15c0 .6.7 1 1.2.7l12-7.5c.5-.3.5-1 0-1.3l-12-7.5c-.5-.4-1.2 0-1.2.6z" />
              </svg>
            </span>
            <span className="howl-badge">LAST HOWL</span>
          </button>
        )}
      </div>
      <div className="howl-meta">
        <p className="howl-when">{howl ? when(howl.recordedAt) : " "}</p>
        <p className="howl-rating">
          {rating?.average != null ? (
            <>
              <span className="paws" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={n <= Math.round(rating.average!) ? "paw on" : "paw"}>
                    🐾
                  </span>
                ))}
              </span>
              <strong>{rating.average.toFixed(1)}</strong> from {rating.count} {rating.count === 1 ? "rating" : "ratings"}
            </>
          ) : (
            <span className="hand">No ratings yet. Rate it in the app!</span>
          )}
        </p>
      </div>
    </div>
  );
}
