import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Free fonts, served with the site. Geist Mono is also the fallback for the UI font and the
// licensed monos; Geist for Alpha Lyrae (src/lib/fonts.ts).
const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Colour Shift",
  description: "Find new colour pairings from random photos.",
};

// viewport-fit=cover: the page runs under the notch and home bar, and the bottom bar pads
// itself with env(safe-area-inset-bottom) to stay clear of them.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
