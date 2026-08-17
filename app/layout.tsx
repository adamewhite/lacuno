import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

/**
 * Outfit for everything — UI and tiles alike.
 *
 * The design handoff paired Arvo with DM Mono. A single family keeps the board
 * quieter; the weight range covers the range of jobs, from 10px uppercase
 * labels to 25px tile letters.
 */
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "VWL DRP",
  description: "A daily word puzzle. Vowels are free — only consonants count.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} antialiased`}>{children}</body>
    </html>
  );
}
