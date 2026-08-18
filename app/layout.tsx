import type { Metadata, Viewport } from "next";
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

const title = "LACUNO";
const description = "A daily word puzzle. Fill the gaps in the phrase.";

/**
 * Update this once the domain is settled. Social scrapers do not resolve
 * relative image URLs, so metadataBase is what makes /og-graph.png absolute.
 */
const siteUrl = "https://lacuno.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: title,
  // app/icon.svg and app/apple-icon.png are picked up by filename convention;
  // this adds a PNG fallback for clients that will not take an SVG favicon.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/logo.png", sizes: "100x100", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: title,
    title,
    description,
    url: siteUrl,
    images: [{ url: "/og-graph.png", width: 1200, height: 630, alt: title }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-graph.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The board sizes itself to the viewport and never scrolls, so pinch-zoom
  // would only push part of it off screen.
  maximumScale: 1,
  // Paints the browser chrome to match the frame on mobile.
  themeColor: "#a56f63",
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
