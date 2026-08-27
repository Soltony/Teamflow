
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

/**
 * The application typeface.
 *
 * The blueprint has always specified Inter and the Tailwind config named it,
 * but nothing ever loaded it — globals.css set Arial on the body and
 * --font-sans was never defined, so every screen rendered in Arial.
 *
 * next/font downloads it at build time and serves it from this origin. That
 * matters here for three reasons: no request leaves the browser to a third
 * party when a colleague opens a project, the offline service worker can
 * cache it, and there is no flash of unstyled text while a remote stylesheet
 * resolves.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NIB EPMO",
    template: "%s | NIB EPMO",
  },
  description: "A project management solution to assign tasks and manage activity online.",
  // app/manifest.ts is served at this path by Next's metadata API.
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/img/logo.png",
    apple: "/img/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0C1222",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased"
        )}
      >
        {/*
          Authentication is applied per route by ProtectedShell, which resolves
          the session on the server before rendering. There is deliberately no
          global client-side auth gate here: a gate that runs in the browser can
          be skipped, and it forced every page to render a loading state first.
        */}
        {children}
        <Toaster />
      </body>
    </html>
  );
}
