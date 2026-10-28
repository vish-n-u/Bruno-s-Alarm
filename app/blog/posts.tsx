import type { ReactNode } from "react";
import Link from "next/link";
import { MORE_POSTS } from "./morePosts";

// Blog posts. Facts only: everything here is true of Bruno and of the app as shipped. When the
// owner shares more about Bruno (where, his age, how it started), add a post rather than
// guessing. No em dashes in copy (DECISIONS.md D13).

export type Post = {
  slug: string;
  title: string;
  date: string; // ISO
  summary: string;
  cover: { src: string; alt: string; screen?: boolean }; // screen: a tall app screenshot, shown whole
  body: ReactNode;
};

export const POSTS: Post[] = [
  {
    slug: "meet-bruno",
    title: "Meet Bruno",
    date: "2026-10-28",
    summary: "A dog, a church bell, and the alarm clock that came out of it.",
    cover: { src: "/media/covers/howl-close.jpg", alt: "Bruno with his head tipped back, mid-howl" },
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
    summary: "From a church bell to your phone, in four simple steps.",
    cover: { src: "/media/ringing.jpg", alt: "The app's ringing screen: Bruno howling, with Stop and Snooze buttons", screen: true },
    body: (
      <>
        <p>People ask how a dog ends up inside their alarm. It&rsquo;s pretty simple.</p>
        <h2>1. The bell rings</h2>
        <p>Twice a day the church bell rings, Bruno howls, and a camera records him.</p>
        <h2>2. A good howl is picked</h2>
        <p>
          Short or broken recordings are skipped. The alarm only uses a howl that&rsquo;s at least
          30 seconds long, so it doesn&rsquo;t cut out.
        </p>
        <h2>3. It&rsquo;s saved on your phone</h2>
        <p>
          The app downloads the howl ahead of time. So your alarm works without internet, even if
          Bruno skips a day. There&rsquo;s also a howl built into the app as a backup.
        </p>
        <figure className="post-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/media/ringing.jpg" alt="The ringing screen" width={270} />
          <figcaption className="hand">What it looks like at 6 in the morning.</figcaption>
        </figure>
        <h2>4. It rings</h2>
        <p>
          At your time, Bruno fills your screen, howling. It rings even if your phone is on
          silent. Tap Stop, or Snooze for 10 minutes.
        </p>
        <p>
          Missed him live? You can watch his <Link href="/#last-howl">last howl</Link> any time.
        </p>
      </>
    ),
  },
  {
    slug: "rate-his-howls",
    title: "New: rate Bruno's howls",
    date: "2026-10-20",
    summary: "Some howls are better than others. Now you can say so, out of 5 paws.",
    cover: { src: "/media/covers/howl-full.jpg", alt: "Bruno howling, tail up" },
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

POSTS.push(...MORE_POSTS);

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
