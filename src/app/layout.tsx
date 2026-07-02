import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Canopy — your allergen scanner",
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
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh bg-background text-foreground flex flex-col">
        {children}
      </body>
    </html>
  );
}
