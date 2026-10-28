import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../_components/SiteChrome";
import PostCard from "../_components/PostCard";
import { POSTS } from "./posts";

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
              <PostCard key={p.slug} post={p} index={i} heading="h2" />
            ))}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
