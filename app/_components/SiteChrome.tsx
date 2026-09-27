import Image from "next/image";
import Link from "next/link";
import { CONTACT_EMAIL } from "../site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap site-header-inner">
        <Link href="/" className="brand" aria-label="Bruno's Alarm home">
          <Image src="/bruno.jpg" alt="" width={36} height={36} className="brand-mark" priority />
          <span className="brand-word">Bruno&rsquo;s Alarm</span>
        </Link>
        <nav className="site-nav" aria-label="Site">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/#get-it" className="nav-cta">
            Get the app
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer-inner">
        <div>
          <p className="footer-brand">Bruno&rsquo;s Alarm</p>
          <p className="footer-hand">Made by one person and one very loud dog.</p>
        </div>
        <nav className="footer-links" aria-label="Legal and contact">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </nav>
      </div>
      <div className="wrap footer-fine">
        <span>© 2026 Bruno&rsquo;s Alarm</span>
        <span>Not affiliated with Google, Firebase, or Cloudflare.</span>
      </div>
    </footer>
  );
}
