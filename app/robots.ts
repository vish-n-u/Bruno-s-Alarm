import type { MetadataRoute } from "next";
import { SITE_URL } from "./site";

// Everyone (search engines and AI assistants alike) may read the public pages; the API and the
// legacy secret /status page aren't content. AI crawlers are named explicitly so it's clear
// they're welcome: being quoted by ChatGPT/Claude/Perplexity is how people find a niche app.
export default function robots(): MetadataRoute.Robots {
  const disallow = ["/api/", "/status"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      {
        userAgent: ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended"],
        allow: "/",
        disallow,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
