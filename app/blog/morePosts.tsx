import Link from "next/link";
import type { Post } from "./posts";

// Guides and explainers (28 Oct). Same rule as posts.tsx: every claim is true of the shipped app
// or is general knowledge stated as such. Nothing about Bruno that the owner hasn't told us
// (no town, age or breed). No em dashes (DECISIONS.md D13).

export const MORE_POSTS: Post[] = [
  {
    slug: "why-do-dogs-howl-at-bells",
    title: "Why do dogs howl at church bells?",
    date: "2026-10-28",
    summary: "Bruno does it twice a day. Here’s what we know about why dogs answer bells and sirens.",
    cover: { src: "/media/howl-poster.jpg", alt: "Bruno with his head tipped back, howling" },
    body: (
      <>
        <p>
          Short answer: nobody knows for certain, but there are a few good explanations, and
          Bruno seems to fit all of them.
        </p>
        <h2>Howling is long-distance talking</h2>
        <p>
          Howling is how wolves keep in touch over long distances: “I’m here, where are you?”
          Dogs kept the habit. A long, steady sound like a bell, a siren or a harmonica can sound
          a lot like another animal calling, so some dogs answer it.
        </p>
        <h2>Bells sit in a howl-ish range</h2>
        <p>
          Church bells ring long, sustained tones that hang in the air. That’s different from
          most everyday noise, which is short and choppy. Dogs that howl at sounds tend to react
          to exactly that kind of long, wavering note.
        </p>
        <h2>Habit and reward</h2>
        <p>
          Once a dog has howled at something a few times, it becomes routine. The bell rings,
          the dog howls, the bell stops. From the dog’s side, it worked. Bruno has never once
          let a bell go unanswered.
        </p>
        <h2>Is it a sign that the noise hurts?</h2>
        <p>
          Usually not. A dog in pain from a sound tends to hide, pace or try to get away. A dog
          who trots toward the noise and tips his head back is joining in. If your own dog
          seems stressed by bells or sirens, though, a vet is the person to ask.
        </p>
        <p>
          Want to hear it for yourself? His <Link href="/#last-howl">last howl</Link> is on the
          home page, and the app lets you wake up to it.
        </p>
      </>
    ),
  },
  {
    slug: "what-time-does-bruno-howl",
    title: "What time does Bruno howl where you live?",
    date: "2026-10-28",
    summary: "6 AM and 6 PM in India. Here’s that in London, New York, Dubai, Sydney and more.",
    cover: { src: "/media/live-frame.jpg", alt: "Bruno howling on the live stream" },
    body: (
      <>
        <p>
          Bruno howls when the bell rings: <strong>06:00 and 18:00 India time (IST)</strong>.
          India is UTC+5:30 all year, with no daylight saving, so his times never move. Yours
          might, depending on where you are.
        </p>
        <h2>His two sessions around the world</h2>
        <table className="post-table">
          <thead>
            <tr>
              <th>Where</th>
              <th>Morning howl</th>
              <th>Evening howl</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>India (IST)</td><td>06:00</td><td>18:00</td></tr>
            <tr><td>UTC</td><td>00:30</td><td>12:30</td></tr>
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
        <h2>The fun part</h2>
        <p>
          If you’re in the Americas, his <em>evening</em> howl lands in your morning. New York
          gets it at breakfast. Singapore gets the morning one at 8:30, which is honestly a very
          civilised time to be howled at.
        </p>
        <h2>You don’t have to do the maths</h2>
        <p>
          The app and the <Link href="/#schedule">schedule on the home page</Link> show his
          sessions in your own time automatically. And your own alarms ring whenever you set
          them, with his recorded howl, so you never need to line up with India time at all.
        </p>
      </>
    ),
  },
  {
    slug: "alarm-that-rings-on-silent",
    title: "An alarm that rings even on silent",
    date: "2026-10-28",
    summary: "Why some alarm apps go quiet on silent mode, and why this one doesn’t.",
    cover: { src: "/media/ringing.jpg", alt: "The ringing screen over the lock screen" },
    body: (
      <>
        <p>
          The number one job of an alarm clock is to actually make a noise. It sounds obvious,
          but plenty of apps get this wrong.
        </p>
        <h2>Notifications are not alarms</h2>
        <p>
          Android has different “channels” for sound: ringtone, media, notifications, and
          alarms. If an app plays its sound as a notification, silent mode and Do Not Disturb
          will happily mute it. I know, because that’s the first thing I tried, and it didn’t
          work.
        </p>
        <h2>What Bruno’s Alarm does instead</h2>
        <ul>
          <li>
            It plays Bruno on the <strong>alarm channel</strong>, the same one your phone’s own
            clock app uses. Silent mode and Do Not Disturb let alarms through by design.
          </li>
          <li>
            It schedules a real <strong>exact alarm</strong> with Android, so it fires on time
            even when the app is closed.
          </li>
          <li>
            It opens a <strong>full screen over your lock screen</strong>, with a big Stop
            button and a 10-minute Snooze.
          </li>
          <li>
            The volume buttons don’t silence it by accident while it’s ringing.
          </li>
        </ul>
        <h2>One thing to check</h2>
        <p>
          Your phone’s <strong>alarm volume</strong> is separate from your ringer volume. If
          it’s turned all the way down, every alarm app is quiet, including the built-in one.
          Turn it up once and you’re set.
        </p>
        <p>
          <Link href="/#get-it">Get Bruno’s Howl Alarm</Link>, free on Android.
        </p>
      </>
    ),
  },
  {
    slug: "android-alarm-not-going-off",
    title: "Android alarm not going off? Check these settings",
    date: "2026-10-28",
    summary: "Battery savers on some phones get in the way of alarms. Here’s how to fix it, for any alarm app.",
    cover: { src: "/media/ringing.jpg", alt: "Bruno’s ringing screen" },
    body: (
      <>
        <p>
          This applies to every alarm app, not just mine. If an alarm ever fails to ring, it’s
          almost always one of these.
        </p>
        <h2>1. Alarm volume</h2>
        <p>
          Press a volume button, open the full volume panel, and check the alarm slider. It’s
          separate from ringer and media volume.
        </p>
        <h2>2. Battery: set the app to Unrestricted</h2>
        <p>
          Phones try hard to save battery, and some brands (OPPO, realme, Xiaomi, OnePlus, vivo
          and others) are especially strict. Go to <strong>Settings → Apps → the alarm app →
          Battery</strong> and choose <strong>Unrestricted</strong> or “Allow background
          activity”. The exact words change by brand.
        </p>
        <h2>3. Auto-launch / Autostart</h2>
        <p>
          Some phones have a separate switch that stops apps starting in the background. If
          yours has <strong>Auto-launch</strong> or <strong>Autostart</strong>, turn it on for
          your alarm app.
        </p>
        <h2>4. Don’t swipe it away from “recent apps” on strict phones</h2>
        <p>
          On most phones this is fine. On a few, clearing the app from recents also clears its
          alarms. If that’s happened to you, the battery and auto-launch settings above usually
          fix it.
        </p>
        <h2>5. Alarms &amp; reminders permission</h2>
        <p>
          Android has a permission called <strong>Alarms &amp; reminders</strong>. Alarm apps
          need it to ring on time. Bruno’s Alarm asks for it only if it’s missing, with a short
          explanation.
        </p>
        <h2>What Bruno’s Alarm already does</h2>
        <p>
          It schedules exact alarms, plays on the alarm channel, and keeps Bruno’s howl saved on
          your phone, so nothing depends on the internet at 6 in the morning. When you turn on
          “Ring when Bruno goes live”, it also checks whether the app is battery-restricted and
          offers to fix it, because that feature relies on a message arriving in the background.
        </p>
        <p>
          The site <a href="https://dontkillmyapp.com" rel="noopener">dontkillmyapp.com</a> has
          step-by-step guides for most phone brands.
        </p>
      </>
    ),
  },
  {
    slug: "set-your-first-bruno-alarm",
    title: "How to set your first Bruno alarm",
    date: "2026-10-28",
    summary: "Pick a time, pick your days, and you’re done. A one-minute guide.",
    cover: { src: "/media/ringing.jpg", alt: "The ringing screen with Stop and Snooze" },
    body: (
      <>
        <p>It takes about a minute. No account, no sign-up.</p>
        <h2>1. Install it</h2>
        <p>
          <Link href="/#get-it">Get Bruno’s Howl Alarm</Link> from Google Play. It’s free, with
          no ads.
        </p>
        <h2>2. Add an alarm</h2>
        <p>
          Tap to add an alarm and scroll to your time. The picker marks Bruno’s own session
          times, in case you want to wake up exactly when he does.
        </p>
        <h2>3. Pick when it repeats</h2>
        <p>
          Once, every day, weekdays, or any days you choose. Set as many alarms as you like.
        </p>
        <h2>4. Hear him first</h2>
        <p>
          You can play a preview of the howl before you commit. The app shows a countdown, like
          “Rings in 7 h 20 min”, so you know you got AM and PM right.
        </p>
        <h2>5. Optional: Bruno’s own schedule</h2>
        <p>
          In Settings you can also switch on his daily alarm, which rings at his two sessions
          (06:00 and 18:00 India time, shown in your time).
        </p>
        <h2>When it rings</h2>
        <p>
          Bruno fills your screen, howling, with <strong>Stop</strong> and{" "}
          <strong>Snooze 10 min</strong>. If he happens to be live right then, there’s a button
          to go and watch him.
        </p>
      </>
    ),
  },
  {
    slug: "ring-when-bruno-goes-live",
    title: "Ring me when Bruno goes live",
    date: "2026-10-28",
    summary: "Turn it on once and your phone rings the moment he’s on camera.",
    cover: { src: "/media/live-frame.jpg", alt: "Bruno on the live stream" },
    body: (
      <>
        <p>
          Your normal alarms ring at times you choose. This one is different: it rings when{" "}
          <em>Bruno</em> decides, the moment his camera goes live.
        </p>
        <h2>How to turn it on</h2>
        <p>
          Open the Live tab and tap <strong>Ring me when he’s live</strong>. One tap, and
          you’re on the list.
        </p>
        <h2>What happens</h2>
        <p>
          When the stream starts, a message goes out to every phone that turned it on, and your
          phone rings like an alarm, so you can catch him mid-howl. If your own alarm is about
          to ring anyway, it doesn’t ring twice.
        </p>
        <h2>The honest bit</h2>
        <p>
          This one depends on a message reaching your phone over the internet, so it’s less
          certain than a normal alarm, which is saved on your phone and needs nothing. That’s
          why, when you turn it on, the app checks whether battery saving might block it and
          offers to fix that. Use it for fun. Use a normal alarm for getting up.
        </p>
        <h2>Missed him anyway?</h2>
        <p>
          <Link href="/blog/missed-him-watch-his-last-howl">Watch his last howl</Link> and rate
          it.
        </p>
      </>
    ),
  },
  {
    slug: "missed-him-watch-his-last-howl",
    title: "Missed him live? Watch his last howl",
    date: "2026-10-28",
    summary: "His newest session, ready to play any time, in the app and on this site.",
    cover: { src: "/media/last-howl.jpg", alt: "Watch his last howl in the app" },
    body: (
      <>
        <p>
          Two sessions a day is not a lot of chances, especially if one of them is at 6 AM in
          your time zone. So the newest one is always waiting.
        </p>
        <h2>In the app</h2>
        <p>
          On the Live tab, tap <strong>Watch his last howl</strong>. It plays his most recent
          session straight from the stream, with a loader while it fetches, and a{" "}
          <strong>Watch again</strong> button at the end.
        </p>
        <h2>On this website</h2>
        <p>
          The same howl is on the <Link href="/#last-howl">home page</Link>, with the date and
          its rating.
        </p>
        <h2>Rate it</h2>
        <p>
          Give it 1 to 5 paws. Everyone sees the average, so you can tell a classic from an
          off day. <Link href="/blog/rate-his-howls">More on ratings</Link>.
        </p>
      </>
    ),
  },
  {
    slug: "does-bruno-alarm-work-offline",
    title: "Does it work without internet?",
    date: "2026-10-28",
    summary: "Yes. Your alarm never waits for a download, a stream, or Bruno himself.",
    cover: { src: "/media/howl-poster.jpg", alt: "Bruno mid-howl" },
    body: (
      <>
        <p>Yes. This was the first rule I set for the app.</p>
        <h2>The howl is already on your phone</h2>
        <p>
          The app downloads Bruno’s latest howl in the background, ahead of time, and only keeps
          it once the whole file has arrived safely. When your alarm goes off, it plays from
          your phone. Flight mode, bad signal, no Wi-Fi: it still rings.
        </p>
        <h2>And there’s a backup</h2>
        <p>
          A howl comes built into the app. If nothing new has downloaded yet, or the saved one
          won’t play for some reason, the alarm uses the built-in howl instead. Silence is never
          the fallback.
        </p>
        <h2>What does need internet</h2>
        <ul>
          <li>Watching Bruno live.</li>
          <li>Watching and rating his last howl.</li>
          <li>Getting a fresher howl for tomorrow’s alarm.</li>
          <li>“Ring me when he’s live”.</li>
        </ul>
        <p>
          Waking up is not on the list. <Link href="/#get-it">Get the app</Link>.
        </p>
      </>
    ),
  },
  {
    slug: "what-if-bruno-doesnt-howl",
    title: "What if Bruno doesn’t howl?",
    date: "2026-10-28",
    summary: "He’s a dog, not a clock. Here’s how the alarm copes on his off days.",
    cover: { src: "/media/live-frame.jpg", alt: "Bruno on camera" },
    body: (
      <>
        <p>
          He’s very reliable for a dog. He is still a dog. Some days the camera has a problem,
          some days he’s somewhere else when the bell goes.
        </p>
        <h2>Your alarm doesn’t care</h2>
        <p>
          Your alarm plays a howl that’s already saved on your phone. It never waits for him to
          perform live, so an off day just means tomorrow’s alarm uses the last good howl again.
        </p>
        <h2>Only proper howls make it</h2>
        <p>
          Not every recording becomes an alarm. Test streams and short camera blips are skipped,
          and the alarm sound has to come from a session at least 30 seconds long, so it loops
          nicely instead of cutting out.
        </p>
        <h2>The live part is a bonus</h2>
        <p>
          Watching him live, getting rung when he’s on, rating his last howl: those depend on
          him showing up, and that’s part of the charm. The alarm is the part that has to be
          boring and dependable, so it is.
        </p>
      </>
    ),
  },
  {
    slug: "a-sky-that-keeps-time",
    title: "A sky that keeps time",
    date: "2026-10-28",
    summary: "The app and this website change colour through the day: seven looks, from dawn to night.",
    cover: { src: "/media/ringing.jpg", alt: "Bruno’s Alarm on a phone" },
    body: (
      <>
        <p>
          Open the app at 5:30 in the morning and you’ll see a dark sky with the first rays of
          the sun. Open it at 4 in the afternoon and it’s golden. It follows your real clock,
          not your phone’s dark mode setting.
        </p>
        <h2>The seven looks</h2>
        <ul>
          <li><strong>Dawn</strong>: still dark, with a sunrise glow on the horizon.</li>
          <li><strong>Morning</strong>: bright and fresh.</li>
          <li><strong>Afternoon</strong>: full daylight.</li>
          <li><strong>Golden hour</strong>: warm and orange.</li>
          <li><strong>Evening</strong>: the light starts to go.</li>
          <li><strong>Dusk</strong>: deep blue.</li>
          <li><strong>Night</strong>: stars and the moon.</li>
        </ul>
        <h2>Why bother?</h2>
        <p>
          An alarm app is the first thing you look at in the morning and often the last thing at
          night. It should feel like the time of day it is. Also, it’s just nicer.
        </p>
        <p>
          This website does the same thing. Come back at a different time and the sky will have
          moved.
        </p>
      </>
    ),
  },
  {
    slug: "no-ads-no-account",
    title: "No ads, no account, no sign-up",
    date: "2026-10-28",
    summary: "What the app collects, what it doesn’t, and why there’s nothing to log in to.",
    cover: { src: "/media/howl-poster.jpg", alt: "Bruno mid-howl" },
    body: (
      <>
        <p>
          You open the app, you set an alarm. There is no step where you hand over an email
          address.
        </p>
        <h2>What stays on your phone</h2>
        <p>
          Your alarms, their times and repeat days, and Bruno’s saved howl all live on your
          phone. They’re not uploaded anywhere.
        </p>
        <h2>What uses an anonymous ID</h2>
        <p>
          Things that involve other people, like ratings, use an anonymous ID instead of an
          account. It isn’t tied to your name or email.
        </p>
        <h2>Basic usage and crash data</h2>
        <p>
          The app uses Firebase Analytics and Crashlytics, so I can see things like which
          screens people open and when the app crashes. That’s how I find bugs. It isn’t linked
          to your name or email.
        </p>
        <h2>No ads</h2>
        <p>
          There are no ads in the app. Nobody is paying to put something between you and the
          dog.
        </p>
        <p>
          The <Link href="/privacy">privacy policy</Link> lists every single thing, in plain
          English. If anything there surprises you, email me.
        </p>
      </>
    ),
  },
  {
    slug: "why-android-only",
    title: "Why is Bruno’s Alarm Android only?",
    date: "2026-10-28",
    summary: "The short version: iPhones make it very hard for an app to be a real alarm. That’s changing.",
    cover: { src: "/media/ringing.jpg", alt: "The ringing screen on Android" },
    body: (
      <>
        <p>I get this one a lot. It’s not that I don’t like iPhones.</p>
        <h2>Android lets apps be real alarms</h2>
        <p>
          On Android, an app can schedule an exact alarm, play on the alarm channel through
          silent mode, and take over the lock screen, just like the built-in clock. That’s
          everything Bruno’s Alarm needs.
        </p>
        <h2>iPhone mostly didn’t</h2>
        <p>
          For years, iPhone apps couldn’t do that. Third-party alarm apps used workarounds, like
          keeping the app running in the background with near-silent audio. The catch: if you
          swipe the app away, the alarm never rings. It also costs battery. I didn’t want to
          ship an alarm that can quietly fail.
        </p>
        <h2>What’s changing</h2>
        <p>
          Newer versions of iOS give apps a proper alarm system, the same kind the Clock app
          uses. That’s the version I’d want to build for iPhone, when I can do it properly.
        </p>
        <p>
          Until then, <Link href="/#get-it">Android it is</Link>.
        </p>
      </>
    ),
  },
];
