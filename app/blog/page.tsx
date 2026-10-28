import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "../_components/SiteChrome";
import { POSTS, formatDate } from "./posts";

export const metadata: Metadata = {
  title: "Blog",
  description: "Notes from Bruno's world: the dog, the church bell, and the alarm clock.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndex() {
  const posts = [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <>
      <SiteHeader />
      <main className="section blog">
        <div className="wrap">
          <p className="eyebrow">The Bruno blog</p>
          <h1 className="display blog-title">Notes from the porch</h1>
          <p className="hand blog-hand">Mostly about one dog. Occasionally about the app.</p>
          <ul className="post-grid">
            {posts.map((p, i) => (
              <li key={p.slug} className={`post-card tilt-${i % 3}`}>
                <Link href={`/blog/${p.slug}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.cover.src} alt={p.cover.alt} />
                  <span className="post-date">{formatDate(p.date)}</span>
                  <h2>{p.title}</h2>
                  <p>{p.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
