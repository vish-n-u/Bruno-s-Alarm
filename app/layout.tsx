import type { Metadata, Viewport } from "next";
import { Anton, Bricolage_Grotesque, Caveat, Courier_Prime } from "next/font/google";
import PhaseSync from "./_components/PhaseSync";
import { SITE_URL } from "./site";
import "./globals.css";

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
  title: {
    default: "Bruno's Alarm",
    template: "%s · Bruno's Alarm",
  },
  description:
    "A real dog howls at a church bell at 6AM and 6PM IST. This Android app wakes you up with it — live when he's on, recorded when he isn't.",
  openGraph: {
    title: "Bruno's Alarm",
    description: "A real dog, live twice a day. Wake up to Bruno's howl.",
    images: [{ url: "/bruno.jpg", width: 800, height: 800, alt: "Bruno mid-howl" }],
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1c2e",
};

// Mirrors getTimeOfDay() in mobile/lib/theme.ts. Runs in <head> before first paint so the
// page never flashes the wrong palette; PhaseSync keeps it current after that.
const phaseScript = `(function(){try{var d=new Date(),h=d.getHours()+d.getMinutes()/60,p=h>=5&&h<11?"morning":h>=11&&h<17?"afternoon":h>=17&&h<18.5?"evening":"night";document.documentElement.setAttribute("data-phase",p);}catch(e){}})();`;

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
