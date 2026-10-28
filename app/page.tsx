import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import DepartureBoard from "./_components/DepartureBoard";
import HeroSky from "./_components/HeroSky";
import LastHowl from "./_components/LastHowl";
import StoryScene from "./_components/StoryScene";
import { SiteFooter, SiteHeader } from "./_components/SiteChrome";
import PostCard from "./_components/PostCard";
import { POSTS } from "./blog/posts";
import { CONTACT_EMAIL, PLAY_STORE_LIVE, PLAY_STORE_URL, SITE_URL } from "./site";

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

// "awoooo", one letter at a time (CSS), like the app's About scene.
function Awoo({ className = "" }: { className?: string }) {
  return (
    <span className={`awoo ${className}`} aria-hidden="true">
      {"awoooo".split("").map((ch, i) => (
        <span key={i} style={{ animationDelay: `${0.4 + i * 0.18}s` }}>
          {ch}
        </span>
      ))}
    </span>
  );
}

// Everything here is true of the shipped app (live chat is switched off for now: DECISIONS.md D17a).
// Kept to the three things the app does (owner, 28 Oct: the long list was confusing for a
// simple app). Silent mode and offline are answered in the FAQ.
const FEATURES = [
  { icon: "⏰", title: "Wake up to Bruno", body: "Set an alarm. Bruno's howl wakes you up." },
  { icon: "📺", title: "Watch him live", body: "Twice a day, at 6 AM and 6 PM India time." },
  { icon: "🐾", title: "Rate his howls", body: "Missed it? Watch the last one and rate it." },
];

const FAQ: { q: string; a: React.ReactNode; text?: string }[] = [
  { q: "Is Bruno real?", a: "Very. Everything you see and hear in the app is him, recorded at his actual sessions." },
  { q: "What does it cost?", a: "Nothing. No ads, no sign-up, no account." },
  { q: "iPhone?", a: "Android only for now." },
  {
    q: "Does it ring on silent?",
    a: "Yes. It rings like your phone's normal alarm, even on silent or Do Not Disturb.",
  },
  {
    q: "What if he doesn't howl?",
    a: "The alarm never depends on him turning up. The sound is saved on your phone ahead of time, so it rings with or without a connection, and with or without Bruno.",
  },
  {
    q: "What do you collect?",
    text: "Very little. Alarms stay on your phone, and chat and ratings use an anonymous ID instead of an account. The privacy policy lists every piece of it.",
    a: (
      <>
        Very little. Alarms stay on your phone, and chat and ratings use an anonymous ID instead of
        an account. The <Link href="/privacy">privacy policy</Link> lists every piece of it.
      </>
    ),
  },
];

const SCREENS = [
  { src: "/media/ringing.jpg", w: 810, h: 1586, alt: "The ringing screen: Bruno howling with Stop and Snooze buttons", note: "6:00 am, sorted" },
  { src: "/media/last-howl.jpg", w: 540, h: 996, alt: "Watch his last howl in the app", note: "missed it? replay it" },
  { src: "/media/live-frame.jpg", w: 720, h: 1280, alt: "Bruno mid-howl", note: "live, twice a day" },
];

export const metadata: Metadata = { alternates: { canonical: "/" } };

// Structured data for search engines and AI assistants: what the app is, and the FAQ as plain
// text. No aggregateRating: the paw ratings are for Bruno's howls, not the app.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MobileApplication",
      "@id": `${SITE_URL}/#app`,
      name: "Bruno's Alarm",
      alternateName: "Bruno's Howl Alarm",
      description:
        "An Android alarm clock that wakes you with a real dog's howl. Bruno howls at a church bell at 06:00 and 18:00 IST; watch him live or wake up to his latest recorded howl.",
      operatingSystem: "Android",
      applicationCategory: "LifestyleApplication",
      applicationSubCategory: "Alarm clock",
      url: SITE_URL,
      installUrl: PLAY_STORE_URL,
      downloadUrl: PLAY_STORE_URL,
      image: `${SITE_URL}/bruno.jpg`,
      screenshot: SCREENS.map((s) => `${SITE_URL}${s.src}`),
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: FEATURES.map((f) => f.title),
      publisher: { "@id": `${SITE_URL}/#org` },
      sameAs: [PLAY_STORE_URL],
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "Bruno's Alarm",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.png`,
      email: CONTACT_EMAIL,
    },
    { "@type": "WebSite", "@id": `${SITE_URL}/#site`, name: "Bruno's Alarm", url: SITE_URL, publisher: { "@id": `${SITE_URL}/#org` } },
    {
      "@type": "VideoObject",
      name: "Bruno howling at the church bell",
      description: "Bruno tips his head back and howls when the church bell rings near his home.",
      thumbnailUrl: `${SITE_URL}/media/howl-poster.jpg`,
      contentUrl: `${SITE_URL}/media/howl-loop.mp4`,
      uploadDate: "2026-10-28",
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.text ?? f.a },
      })),
    },
  ],
};

export default function Home() {
  const latestPosts = [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }} />
      <SiteHeader />
      <main>
        <section className="hero">
          <HeroSky />
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Every morning &amp; evening · 06:00 &amp; 18:00 IST</p>
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
                <a href="#last-howl" className="text-link">
                  Hear his last howl ↓
                </a>
              </div>
            </div>
            <div className="hero-art">
              <figure className="polaroid">
                <video src="/media/howl-loop.mp4" poster="/media/howl-poster.jpg" autoPlay muted loop playsInline />
                <figcaption className="hand">Bruno, doing the one thing.</figcaption>
              </figure>
              <Awoo className="hero-awoo" />
              <div className="phone hero-phone">
                <Image src="/media/ringing.jpg" alt="The app's ringing screen" width={810} height={1586} sizes="200px" priority />
              </div>
            </div>
          </div>
        </section>

        <section id="last-howl" className="section">
          <div className="wrap last-howl-wrap">
            <div>
              <h2 className="section-title">His last howl</h2>
              <p className="section-lede">
                The newest session, straight from the camera. Rated by everyone who watched it in
                the app.
              </p>
              <p className="hand side-note">Turn the sound up. Trust me.</p>
            </div>
            <LastHowl />
          </div>
        </section>

        <section className="section story">
          <div className="wrap">
            <h2 className="section-title">How it goes, every day</h2>
            <p className="section-lede">The bell rings far off. He hears it first.</p>
            <div className="scene-frame">
              <StoryScene />
            </div>
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
                  <span className="feature-icon" aria-hidden="true">
                    {f.icon}
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section screens">
          <div className="wrap">
            <h2 className="section-title">Inside the app</h2>
            <ul className="screen-strip">
              {SCREENS.map((s, i) => (
                <li key={s.src} className={`screen-card tilt-${i % 3}`}>
                  <Image src={s.src} alt={s.alt} width={s.w} height={s.h} sizes="(max-width: 700px) 60vw, 260px" />
                  <span className="hand">{s.note}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <h2 className="section-title">From the blog</h2>
              <Link href="/blog" className="text-link">
                All posts →
              </Link>
            </div>
            <ul className="post-grid">
              {latestPosts.map((p, i) => (
                <PostCard key={p.slug} post={p} index={i} />
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
            <Image src="/media/bruno-cutout.webp" alt="" width={180} height={180} className="get-it-bruno" />
            <h2 className="display get-it-title">Wake up with Bruno.</h2>
            <p className="get-it-meta">Android · Free · No ads</p>
            <PlayButton large />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
