import type { Metadata, Viewport } from "next";
import { Archivo, Manrope, IBM_Plex_Mono } from "next/font/google";
import { PageShell } from "@/components/PageShell";
import "./globals.css";

// Three families, per the 2a visual refresh handoff:
//   Archivo        headings
//   Manrope        body copy, labels, buttons
//   IBM Plex Mono  uppercase eyebrows/captions and numeric stats
// Archivo and Manrope are variable fonts, so they need no weight list. IBM
// Plex Mono is not, so its weights are named explicitly.
const display = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const sans = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Canopy · Your allergen scanner",
  description:
    "Snap a photo of any food label. Canopy reads the ingredients and flags anything you're allergic or sensitive to.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Canopy",
  },
};

export const viewport: Viewport = {
  themeColor: "#1c7a53",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh bg-background text-foreground flex flex-col">
        <PageShell>{children}</PageShell>
      </body>
    </html>
  );
}
