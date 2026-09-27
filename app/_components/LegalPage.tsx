import Link from "next/link";
import { SiteFooter, SiteHeader } from "./SiteChrome";

type Props = {
  title: string;
  effective: string;
  summary: React.ReactNode;
  children: React.ReactNode;
  other: { href: string; label: string };
};

export default function LegalPage({ title, effective, summary, children, other }: Props) {
  return (
    <>
      <SiteHeader />
      <main className="legal">
        <div className="wrap legal-wrap">
          <p className="eyebrow">Effective {effective}</p>
          <h1 className="display legal-title">{title}</h1>
          <div className="legal-summary">
            <p className="legal-summary-label">The short version</p>
            {summary}
          </div>
          <article className="legal-body">{children}</article>
          <p className="legal-other">
            See also: <Link href={other.href}>{other.label}</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
