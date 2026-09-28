import Image from "next/image";
import Link from "next/link";
import DepartureBoard from "./_components/DepartureBoard";
import { SiteFooter, SiteHeader } from "./_components/SiteChrome";
import { PLAY_STORE_LIVE, PLAY_STORE_URL } from "./site";

function PlayButton({ large = false }: { large?: boolean }) {
  const className = large ? "play-button play-button-lg" : "play-button";
  const label = (
    <>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path fill="currentColor" d="M4 2.8v18.4c0 .5.6.8 1 .5l15.3-9.2c.4-.2.4-.8 0-1L5 2.3c-.4-.3-1 0-1 .5z" />
      </svg>
      <span>
        <small>{PLAY_STORE_LIVE ? "Get it on" : "Coming soon to"}</small>
        Google Play
      </span>
    </>
  );
  return PLAY_STORE_LIVE ? (
    <a href={PLAY_STORE_URL} className={className}>
      {label}
    </a>
  ) : (
    <span className={`${className} is-soon`} aria-disabled="true">
      {label}
    </span>
  );
}

const FEATURES = [
  {
    title: "A real alarm, not a notification",
    body: "It rings on your phone's alarm channel, so it gets through silent mode and Do Not Disturb and takes over the lock screen like a proper alarm clock. Snooze is there if you must.",
  },
  {
    title: "Live when he's live",
    body: "At session time the Live tab shows the camera. If your alarm rings while he's off, it plays his latest recording, so there's always a howl in it. Flip one switch and it'll ring you the moment he goes live, even off schedule.",
  },
  {
    title: "Your own times too",
    body: "Set alarms for whenever you actually get up. The time picker marks Bruno's two slots in your timezone, in case you want to line up with the real thing.",
  },
  {
    title: "A chat for the pack",
    body: "A small public chat opens while he's on. It's moderated, rate-limited, and wiped a couple of hours after each session.",
  },
];

const FAQ = [
  {
    q: "What does it cost?",
    a: "Nothing. No ads, no sign-up, no account.",
  },
  {
    q: "iPhone?",
    a: "Android only for now.",
  },
  {
    q: "What if he doesn't howl?",
    a: "The alarm never depends on him turning up. The sound is saved on your phone ahead of time, so it rings with or without a connection, and with or without Bruno.",
  },
  {
    q: "What do you collect?",
    a: (
      <>
        Very little. Alarms stay on your phone, and chat uses an anonymous ID instead of an
        account. The <Link href="/privacy">privacy policy</Link> lists every piece of it.
      </>
    ),
  },
  {
    q: "It says beta?",
    a: "It is. Things will occasionally break, and he still won't be punctual.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">06:00 &amp; 18:00 IST · every day</p>
              <h1 className="display">
                A real dog.
                <br />
                Live twice
                <br />
                a day.
              </h1>
              <p className="hand hero-hand">The alarm&rsquo;s always on time. He mostly is.</p>
              <p className="lede">
                Twice a day a church bell rings near Bruno&rsquo;s home, and he howls at it, every
                time. Bruno&rsquo;s Alarm points a camera at him and turns that howl into your
                wake-up call.
              </p>
              <div className="hero-actions">
                <PlayButton />
                <a href="#schedule" className="text-link">
                  When is he on? ↓
                </a>
              </div>
            </div>
            <figure className="hero-photo">
              <Image
                src="/bruno.jpg"
                alt="Bruno, a tan short-haired dog, head tipped back mid-howl"
                width={800}
                height={800}
                priority
                sizes="(max-width: 800px) 80vw, 420px"
              />
              <figcaption className="hand">Bruno, doing the one thing.</figcaption>
            </figure>
          </div>
        </section>

        <section id="schedule" className="section">
          <div className="wrap">
            <h2 className="section-title">When he&rsquo;s on</h2>
            <p className="section-lede">Both sessions, converted to wherever you are.</p>
            <DepartureBoard />
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <h2 className="section-title">What the app does</h2>
            <ul className="features">
              {FEATURES.map((f) => (
                <li key={f.title}>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section">
          <div className="wrap faq-wrap">
            <h2 className="section-title">Fair questions</h2>
            <div className="faq">
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="get-it" className="section get-it">
          <div className="wrap get-it-inner">
            <h2 className="display get-it-title">Wake up with Bruno.</h2>
            <p className="get-it-meta">Android · Free · Beta</p>
            <PlayButton large />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
