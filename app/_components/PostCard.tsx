import Image from "next/image";
import Link from "next/link";
import { formatDate, type Post } from "../blog/posts";

// One blog card, used on the home page, the blog index and under each post. Covers are 4:3
// photos cut from the full-HD howl video (public/media/covers); app screenshots are tall, so
// they sit whole on a tinted card instead of being cropped to a blurry strip.
export default function PostCard({ post, index, heading: H = "h3" }: { post: Post; index: number; heading?: "h2" | "h3" }) {
  const { cover } = post;
  return (
    <li className={`post-card tilt-${index % 3}`}>
      <Link href={`/blog/${post.slug}`}>
        <span className={cover.screen ? "post-cover post-cover-screen" : "post-cover"}>
          <Image
            src={cover.src}
            alt={cover.alt}
            fill
            sizes={cover.screen ? "160px" : "(max-width: 700px) 92vw, 360px"}
          />
        </span>
        <span className="post-date">{formatDate(post.date)}</span>
        <H>{post.title}</H>
        <p>{post.summary}</p>
      </Link>
    </li>
  );
}
