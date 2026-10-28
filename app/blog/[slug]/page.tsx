import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "../../_components/SiteChrome";
import { SITE_URL } from "../../site";
import { POSTS, formatDate, getPost } from "../posts";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.summary,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { title: post.title, description: post.summary, images: [{ url: post.cover.src }], type: "article", publishedTime: post.date },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  const others = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    image: `${SITE_URL}${post.cover.src}`,
    url: `${SITE_URL}/blog/${post.slug}`,
    author: { "@type": "Person", name: "Bruno's human", url: SITE_URL },
    publisher: { "@id": `${SITE_URL}/#org` },
    about: { "@id": `${SITE_URL}/#app` },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <SiteHeader />
      <main className="section post">
        <article className="wrap post-wrap">
          <Link href="/blog" className="text-link">
            ← All posts
          </Link>
          <p className="post-date">{formatDate(post.date)}</p>
          <h1 className="display post-title">{post.title}</h1>
          <p className="hand post-summary">{post.summary}</p>
          <div className="post-body">{post.body}</div>
          <p className="post-sign hand">Bruno&rsquo;s human 🐾</p>
        </article>
        {others.length > 0 && (
          <div className="wrap post-more">
            <h2 className="section-title">More from the porch</h2>
            <ul className="post-grid">
              {others.map((p, i) => (
                <li key={p.slug} className={`post-card tilt-${i % 3}`}>
                  <Link href={`/blog/${p.slug}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.cover.src} alt={p.cover.alt} />
                    <span className="post-date">{formatDate(p.date)}</span>
                    <h3>{p.title}</h3>
                    <p>{p.summary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
