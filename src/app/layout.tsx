import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

// Free fallback for the UI font (Input Mono is local-only).
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Colour Shift",
  description: "Find new colour pairings from random photos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${geistMono.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
