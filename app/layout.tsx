import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bruno's Alarm",
  description: "Bruno's twice-daily howl, live at 6AM/6PM and on-demand the rest of the day.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
