import Link from "next/link";
import type { Post } from "./posts";

// Guides and explainers (28 Oct). Same rule as posts.tsx: every claim is true of the shipped app
// or is general knowledge stated as such. Nothing about Bruno that the owner hasn't told us
// (no town, age or breed). Plain, short words: it's a simple app, so no technical terms
// (owner, 28 Oct). No em dashes (DECISIONS.md D13).

export const MORE_POSTS: Post[] = [
  {
    slug: "why-do-dogs-howl-at-bells",
    title: "Why do dogs howl at church bells?",
    date: "2026-10-28",
    summary: "Bruno does it twice a day. Here’s why dogs answer bells and sirens.",
    cover: { src: "/media/covers/head-up.jpg", alt: "Bruno with his head up, howling" },
    body: (
      <>
        <p>Nobody knows for sure, but there are a few good guesses.</p>
        <h2>It’s how dogs call out</h2>
        <p>
          Wolves howl to find each other from far away. Dogs still have that habit. A long sound
          like a bell or a siren can sound like another dog calling, so they answer.
        </p>
        <h2>Bells sound a bit like a howl</h2>
        <p>
          A bell rings long and steady, a lot like a howl does. Most other noises are short. That
          long note is what sets many dogs off.
        </p>
        <h2>It becomes a habit</h2>
        <p>
          The bell rings, the dog howls, the bell stops. From the dog’s side, it worked. Bruno has
          never let a bell go unanswered.
        </p>
        <h2>Does it hurt their ears?</h2>
        <p>
          Usually not. A dog bothered by a noise tends to hide or run away. A dog who walks toward
          it and tips his head back is joining in. If your dog seems scared, ask a vet.
        </p>
        <p>
          Hear it for yourself: his <Link href="/#last-howl">last howl</Link> is on the home page.
        </p>
      </>
    ),
  },
  {
    slug: "what-time-does-bruno-howl",
    title: "What time does Bruno howl where you live?",
    date: "2026-10-28",
    summary: "6 AM and 6 PM in India. Here’s that in London, New York, Dubai, Sydney and more.",
    cover: { src: "/media/covers/howl-turn.jpg", alt: "Bruno howling" },
    body: (
      <>
        <p>
          Bruno howls when the bell rings: <strong>6 AM and 6 PM India time</strong>. India
          doesn’t change its clocks, so his times never move. Here’s what that is for you.
        </p>
        <table className="post-table">
          <thead>
            <tr>
              <th>Where</th>
              <th>Morning howl</th>
              <th>Evening howl</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>India</td><td>06:00</td><td>18:00</td></tr>
            <tr><td>London (winter / summer)</td><td>00:30 / 01:30</td><td>12:30 / 13:30</td></tr>
            <tr><td>Berlin, Paris (winter / summer)</td><td>01:30 / 02:30</td><td>13:30 / 14:30</td></tr>
            <tr><td>Dubai</td><td>04:30</td><td>16:30</td></tr>
            <tr><td>Singapore</td><td>08:30</td><td>20:30</td></tr>
            <tr><td>Sydney (winter / summer)</td><td>10:30 / 11:30</td><td>22:30 / 23:30</td></tr>
            <tr><td>New York (winter / summer)</td><td>19:30 / 20:30*</td><td>07:30 / 08:30</td></tr>
            <tr><td>Los Angeles (winter / summer)</td><td>16:30 / 17:30*</td><td>04:30 / 05:30</td></tr>
          </tbody>
        </table>
        <p className="post-note">* the evening before, your time.</p>
        <p>
          Fun fact: in America, his <em>evening</em> howl lands in your morning. New York gets it
          at breakfast.
        </p>
        <p>
          You don’t need to work any of this out. The app and the{" "}
          <Link href="/#schedule">home page</Link> show his times in your time. And your own
          alarms ring whenever you set them.
        </p>
      </>
    ),
  },
  {
    slug: "alarm-that-rings-on-silent",
    title: "An alarm that rings even on silent",
    date: "2026-10-28",
    summary: "Your phone is on silent. Bruno still wakes you up.",
    cover: { src: "/media/ringing.jpg", alt: "The ringing screen", screen: true },
    body: (
      <>
        <p>An alarm has one job: make noise. Bruno’s Alarm does that even when your phone is on silent.</p>
        <h2>Why some apps go quiet</h2>
        <p>
          Some apps play their sound like a normal notification. Silent mode mutes those. Bruno’s
          Alarm rings the same way your phone’s own alarm clock does, so silent mode and Do Not
          Disturb don’t stop it.
        </p>
        <h2>What you see</h2>
        <p>
          Bruno fills your screen, howling, even on the lock screen. Tap Stop, or Snooze for 10
          minutes. The volume buttons won’t turn it off by mistake.
        </p>
        <h2>One thing to check</h2>
        <p>
          Your phone has a separate <strong>alarm volume</strong>. If it’s all the way down, every
          alarm is quiet. Turn it up once and you’re set.
        </p>
        <p>
          <Link href="/#get-it">Get the app</Link>. It’s free.
        </p>
      </>
    ),
  },
  {
    slug: "android-alarm-not-going-off",
    title: "Alarm not going off? Check these settings",
    date: "2026-10-28",
    summary: "Some phones block alarms to save battery. Here’s the quick fix, for any alarm app.",
    cover: { src: "/media/covers/look.jpg", alt: "Bruno looking up, puzzled" },
    body: (
      <>
        <p>This works for any alarm app on Android, not just mine.</p>
        <h2>1. Turn up the alarm volume</h2>
        <p>Press a volume button and open the full volume panel. The alarm slider is separate.</p>
        <h2>2. Let the app run in the background</h2>
        <p>
          Some phones (like OPPO, realme, Xiaomi, OnePlus and vivo) are strict about saving
          battery. Go to <strong>Settings → Apps → the alarm app → Battery</strong> and pick{" "}
          <strong>Unrestricted</strong> or “Allow background activity”. The words differ by phone.
        </p>
        <h2>3. Turn on Auto-launch</h2>
        <p>If your phone has an <strong>Auto-launch</strong> or <strong>Autostart</strong> setting, turn it on for the app.</p>
        <h2>4. Allow “Alarms &amp; reminders”</h2>
        <p>
          Android asks for this so alarm apps can ring on time. Bruno’s Alarm only asks if it’s
          missing.
        </p>
        <p>
          <a href="https://dontkillmyapp.com" rel="noopener">dontkillmyapp.com</a> has picture guides
          for most phone brands.
        </p>
      </>
    ),
  },
  {
    slug: "set-your-first-bruno-alarm",
    title: "How to set your first Bruno alarm",
    date: "2026-10-28",
    summary: "Pick a time, pick your days, done. Takes a minute.",
    cover: { src: "/media/covers/walk.jpg", alt: "Bruno standing on the porch" },
    body: (
      <>
        <p>No account, no sign-up. Just this:</p>
        <h2>1. Install it</h2>
        <p>
          <Link href="/#get-it">Get Bruno’s Howl Alarm</Link> on Google Play. It’s free, with no
          ads.
        </p>
        <h2>2. Pick a time</h2>
        <p>Add an alarm and scroll to your time. Bruno’s own times are marked, if you want to wake up with him.</p>
        <h2>3. Pick your days</h2>
        <p>Once, every day, weekdays, or the days you choose.</p>
        <h2>4. Hear him first</h2>
        <p>Play the howl before you save. The app also shows how long until it rings, so you know you got AM and PM right.</p>
        <h2>When it rings</h2>
        <p>Bruno fills your screen. Tap Stop, or Snooze for 10 minutes.</p>
      </>
    ),
  },
  {
    slug: "ring-when-bruno-goes-live",
    title: "Get a ring when Bruno goes live",
    date: "2026-10-28",
    summary: "Turn it on once and your phone rings when he’s on camera.",
    cover: { src: "/media/covers/tail-up.jpg", alt: "Bruno with his tail up" },
    body: (
      <>
        <p>Your normal alarms ring at times you pick. This one rings when Bruno goes live.</p>
        <h2>How to turn it on</h2>
        <p>Open the Live tab and tap <strong>Ring me when he’s live</strong>. That’s it.</p>
        <h2>What happens</h2>
        <p>When his camera turns on, your phone rings so you can watch him howl live.</p>
        <h2>Good to know</h2>
        <p>
          This one needs internet to reach your phone, so it’s not as certain as a normal alarm.
          Use it for fun. Use a normal alarm for getting up.
        </p>
        <p>
          Missed him? <Link href="/blog/missed-him-watch-his-last-howl">Watch his last howl</Link>.
        </p>
      </>
    ),
  },
  {
    slug: "missed-him-watch-his-last-howl",
    title: "Missed him live? Watch his last howl",
    date: "2026-10-28",
    summary: "His newest howl, ready to play any time.",
    cover: { src: "/media/last-howl.jpg", alt: "Watch his last howl in the app", screen: true },
    body: (
      <>
        <p>Two shows a day is not a lot, especially if one is at 6 AM for you. So the newest one is always there.</p>
        <h2>In the app</h2>
        <p>On the Live tab, tap <strong>Watch his last howl</strong>.</p>
        <h2>On this website</h2>
        <p>It’s on the <Link href="/#last-howl">home page</Link> too.</p>
        <h2>Rate it</h2>
        <p>
          Give it 1 to 5 paws. Everyone sees the average. <Link href="/blog/rate-his-howls">More on ratings</Link>.
        </p>
      </>
    ),
  },
  {
    slug: "does-bruno-alarm-work-offline",
    title: "Does it work without internet?",
    date: "2026-10-28",
    summary: "Yes. Your alarm never needs internet to ring.",
    cover: { src: "/media/covers/listen.jpg", alt: "Bruno listening" },
    body: (
      <>
        <p>Yes.</p>
        <p>
          The app saves Bruno’s howl on your phone ahead of time. When your alarm goes off, it
          plays from your phone. No Wi-Fi, no signal, flight mode: it still rings.
        </p>
        <p>There’s also a howl built into the app, just in case.</p>
        <h2>What does need internet</h2>
        <ul>
          <li>Watching him live.</li>
          <li>Watching and rating his last howl.</li>
          <li>Getting a newer howl for your alarm.</li>
        </ul>
        <p>Waking up is not on the list.</p>
      </>
    ),
  },
  {
    slug: "what-if-bruno-doesnt-howl",
    title: "What if Bruno doesn’t howl?",
    date: "2026-10-28",
    summary: "He’s a dog, not a clock. Your alarm still rings.",
    cover: { src: "/media/covers/standing.jpg", alt: "Bruno standing quietly" },
    body: (
      <>
        <p>He’s very reliable, for a dog. Some days he’s busy. Some days the camera isn’t.</p>
        <p>
          It doesn’t matter for your alarm. The alarm plays a howl already saved on your phone. It
          never waits for him to show up live.
        </p>
        <p>
          On an off day, your alarm just uses his last good howl again. The live part is a bonus.
        </p>
      </>
    ),
  },
  {
    slug: "a-sky-that-keeps-time",
    title: "The app changes with the time of day",
    date: "2026-10-28",
    summary: "Orange in the morning, dark blue at night. A small thing that makes it nicer.",
    cover: { src: "/media/covers/waiting.jpg", alt: "Bruno on the porch in the morning" },
    body: (
      <>
        <p>
          Open the app early and you’ll see a sunrise. In the afternoon it’s bright, in the evening
          it turns golden, and at night there are stars.
        </p>
        <p>It follows your clock, not your phone’s dark mode. It’s just nicer to look at first thing in the morning.</p>
        <p>This website does the same. Come back later and the sky will have moved.</p>
      </>
    ),
  },
  {
    slug: "no-ads-no-account",
    title: "No ads, no account, no sign-up",
    date: "2026-10-28",
    summary: "Open it, set an alarm. That’s it.",
    cover: { src: "/media/covers/howl-close.jpg", alt: "Bruno mid-howl" },
    body: (
      <>
        <p>There’s no step where you give your email.</p>
        <h2>On your phone</h2>
        <p>Your alarms stay on your phone.</p>
        <h2>Ratings</h2>
        <p>Ratings use a random ID, not your name or email.</p>
        <h2>Usage and crash reports</h2>
        <p>
          The app sends basic usage and crash info (through Firebase) so I can find bugs. It isn’t
          linked to your name or email.
        </p>
        <h2>No ads</h2>
        <p>None.</p>
        <p>
          Everything is listed in the <Link href="/privacy">privacy policy</Link>. Questions? Email me.
        </p>
      </>
    ),
  },
  {
    slug: "why-android-only",
    title: "Why is it Android only?",
    date: "2026-10-28",
    summary: "iPhones make it hard for apps to be real alarms. That’s changing.",
    cover: { src: "/media/ringing.jpg", alt: "The ringing screen on Android", screen: true },
    body: (
      <>
        <p>I get asked this a lot. It’s not that I don’t like iPhones.</p>
        <p>
          On Android, an app can ring just like the phone’s own alarm clock, even on silent. That’s
          all Bruno’s Alarm needs.
        </p>
        <p>
          On iPhone, apps mostly couldn’t do that. The workarounds can fail if you close the app,
          and I don’t want an alarm that might not ring.
        </p>
        <p>
          Newer iPhones now let apps make real alarms. That’s how I’d like to build it, when I can do it properly.
        </p>
        <p>
          Until then, <Link href="/#get-it">Android it is</Link>.
        </p>
      </>
    ),
  },
];
