import type { Metadata, Viewport } from "next";
import { Anton, Bricolage_Grotesque, Caveat, Courier_Prime } from "next/font/google";
import PhaseSync from "./_components/PhaseSync";
import { SITE_URL } from "./site";
import "./globals.css";
import "./fun.css";

// Same four faces as the app (mobile/lib/theme.ts): Anton for the flyer-style headline,
// Bricolage Grotesque for everything you read, Courier Prime only for actual numerals,
// Caveat for the one handwritten aside. next/font self-hosts them, so visitors' browsers
// never make a request to Google.
const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-body" });
const courier = Courier_Prime({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-mono" });
const caveat = Caveat({ weight: "600", subsets: ["latin"], variable: "--font-hand" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // "Howl alarm" / "dog alarm clock" are what people actually search; the Play listing is
  // "Bruno's Howl Alarm", so the site uses the same words (one name everywhere helps search and AI
  // assistants recognise it as one thing).
  title: {
    default: "Bruno's Howl Alarm: wake up to a real dog howling",
    template: "%s · Bruno's Howl Alarm",
  },
  description:
    "A free Android alarm clock that wakes you with a real dog's howl. Bruno howls at a church bell at 6 AM and 6 PM IST: watch him live, or wake up to his latest howl. Rings on silent.",
  applicationName: "Bruno's Alarm",
  openGraph: {
    siteName: "Bruno's Alarm",
    title: "Bruno's Howl Alarm",
    description: "A real dog, live twice a day. Wake up to Bruno's howl. Free on Android.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Bruno with his head tipped back, howling" }],
    type: "website",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0f1c2e",
};

// Mirrors getTimeOfDay() in mobile/lib/theme.ts. Runs in <head> before first paint so the
// page never flashes the wrong palette; PhaseSync keeps it current after that.
const phaseScript = `(function(){try{var d=new Date(),h=d.getHours()+d.getMinutes()/60,p=h>=5&&h<6.5?"dawn":h>=6.5&&h<11?"morning":h>=11&&h<16?"afternoon":h>=16&&h<17?"golden":h>=17&&h<18.5?"evening":h>=18.5&&h<19.5?"dusk":"night";document.documentElement.setAttribute("data-phase",p);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${bricolage.variable} ${courier.variable} ${caveat.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: phaseScript }} />
      </head>
      <body>
        <PhaseSync />
        {children}
      </body>
    </html>
  );
}
