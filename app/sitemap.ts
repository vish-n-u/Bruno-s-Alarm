import type { MetadataRoute } from "next";
import { POSTS } from "./blog/posts";
import { PRIVACY_EFFECTIVE, SITE_URL, TERMS_EFFECTIVE } from "./site";

export default function sitemap(): MetadataRoute.Sitemap {
  const newest = POSTS.map((p) => p.date).sort().at(-1);
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/blog`, lastModified: newest, changeFrequency: "weekly", priority: 0.8 },
    ...POSTS.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.date, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${SITE_URL}/privacy`, lastModified: new Date(PRIVACY_EFFECTIVE), changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified: new Date(TERMS_EFFECTIVE), changeFrequency: "yearly", priority: 0.2 },
  ];
}
