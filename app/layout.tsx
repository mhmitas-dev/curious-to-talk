import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Rubik_Spray_Paint } from "next/font/google";
import { PwaServiceWorker } from "@/components/pwa-service-worker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const rubikSprayPaint = Rubik_Spray_Paint({
  weight: "400",
  variable: "--font-rubik-spray-paint",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Niribi",
  description: "Voice room app for hanging out with friends.",
  applicationName: "Niribi",
  other: {
    "apple-mobile-web-app-title": "Niribi",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Niribi",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#262624",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Always dark — force the .dark class for shadcn tokens
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${rubikSprayPaint.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <PwaServiceWorker />
      </body>
    </html>
  );
}
