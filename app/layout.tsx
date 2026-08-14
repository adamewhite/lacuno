import type { Metadata } from "next";
import { Arvo, DM_Mono } from "next/font/google";
import "./globals.css";

/** UI type from the design handoff. */
const arvo = Arvo({
  variable: "--font-arvo",
  subsets: ["latin"],
  weight: ["400", "700"],
});

/** Tiles and numerals. */
const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
      <body className={`${arvo.variable} ${dmMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
