import type { ReactNode } from "react";
import Link from "next/link";

// Blog posts. Facts only: everything here is true of Bruno and of the app as shipped. When the
// owner shares more about Bruno (where, his age, how it started), add a post rather than
// guessing. No em dashes in copy (DECISIONS.md D13).

export type Post = {
  slug: string;
  title: string;
  date: string; // ISO
  summary: string;
  cover: { src: string; alt: string };
  body: ReactNode;
};

export const POSTS: Post[] = [
  {
    slug: "meet-bruno",
    title: "Meet Bruno",
    date: "2026-10-28",
    summary: "A dog, a church bell, and the alarm clock that came out of it.",
    cover: { src: "/media/howl-poster.jpg", alt: "Bruno with his head tipped back, mid-howl" },
    body: (
      <>
        <p>
          Bruno is my dog. There&rsquo;s a church near our house, and whenever the bell rings he
          starts howling, twice every day. It&rsquo;s pretty loud.
        </p>
        <figure className="post-video">
          <video src="/media/howl-loop.mp4" poster="/media/howl-poster.jpg" autoPlay muted loop playsInline />
          <figcaption className="hand">That&rsquo;s the one. Every single time.</figcaption>
        </figure>
        <p>
          At some point the obvious question came up: if he&rsquo;s going to howl at the same time
          every day anyway, why not let him wake people up? So I made an alarm clock out of it.
        </p>
        <p>
          You set a time, and your phone rings with a real recording of Bruno howling. A camera
          points at him when the bell rings, so twice a day you can also watch him live, and if you
          miss it, his last howl is waiting in the app.
        </p>
        <p>
          That&rsquo;s pretty much it. <Link href="/#get-it">Bruno&rsquo;s Howl Alarm</Link> is free
          on Google Play, with no ads and no account.
        </p>
      </>
    ),
  },
  {
    slug: "how-his-howl-becomes-your-alarm",
    title: "How Bruno's howl becomes your alarm",
    date: "2026-10-28",
    summary: "From a church bell to your lock screen, and why it still rings on silent.",
    cover: { src: "/media/ringing.jpg", alt: "The app's ringing screen: Bruno howling, with Stop and Snooze buttons" },
    body: (
      <>
        <p>People ask how a dog ends up inside their alarm. Here&rsquo;s the whole trip.</p>
        <h2>1. The bell rings, the camera streams</h2>
        <p>
          When the church bell rings, a phone camera streams Bruno live. Every stream is recorded,
          which is how the app always has a fresh howl to work with.
        </p>
        <h2>2. The best recent howl is picked</h2>
        <p>
          Not every recording makes the cut. Test streams and camera blips are ignored, and the
          alarm only uses a session that&rsquo;s at least 30 seconds long, so the looping alarm
          sound never feels choppy.
        </p>
        <h2>3. It&rsquo;s saved on your phone ahead of time</h2>
        <p>
          Your phone quietly downloads that howl in advance. When your alarm goes off, it plays from
          your phone, so it rings with or without internet, and with or without Bruno turning up.
          If nothing has downloaded yet, there&rsquo;s a built-in howl as a backup.
        </p>
        <figure className="post-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/media/ringing.jpg" alt="The ringing screen over the lock screen" width={270} />
          <figcaption className="hand">What it looks like at 6 in the morning.</figcaption>
        </figure>
        <h2>4. It rings like a real alarm</h2>
        <p>
          The sound plays on your phone&rsquo;s alarm channel, the same one the built-in clock app
          uses. That&rsquo;s why it gets through silent mode and Do Not Disturb, and why it shows
          over your lock screen with a big Stop button and a 10-minute snooze.
        </p>
        <h2>5. And the newest one is always there to watch</h2>
        <p>
          Missed the live session? &ldquo;Watch his last howl&rdquo; in the app streams the newest
          one straight away, even if it was short. You can watch it on <Link href="/#last-howl">this page</Link> too.
        </p>
      </>
    ),
  },
  {
    slug: "rate-his-howls",
    title: "New: rate Bruno's howls",
    date: "2026-10-20",
    summary: "Some howls are better than others. Now you can say so, out of 5 paws.",
    cover: { src: "/media/last-howl.jpg", alt: "Bruno's last howl playing in the app" },
    body: (
      <>
        <p>
          Some days he really commits. Some days it&rsquo;s more of a polite comment. Now you can
          tell him which is which.
        </p>
        <p>
          Open the Live tab, tap <strong>Watch his last howl</strong>, and rate it from 1 to 5
          paws. Everyone sees the average, so you can see how today&rsquo;s performance stacks up.
          Changed your mind? Tap again and your rating updates. One rating per phone, per howl.
        </p>
        <figure className="post-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/media/last-howl.jpg" alt="Bruno's last howl in the app" width={270} />
          <figcaption className="hand">Rate responsibly. He can&rsquo;t read, but still.</figcaption>
        </figure>
        <p>
          The latest howl and its rating are on the <Link href="/#last-howl">home page</Link> as
          well.
        </p>
      </>
    ),
  },
];

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
