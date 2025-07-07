
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/context/auth-context";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "NIB PMO",
    template: "%s | NIB PMO",
  },
  description: "A project management solution to assign tasks and manage activity online.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "https://play-lh.googleusercontent.com/bXqMt9ROsGd0H9vPhib5hG-0NB-EJcAwZy6UUDhvlP-ykE595IMQtzr14R6IRWtJiGTh",
  },
};

export const viewport: Viewport = {
  themeColor: "#733f19",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.variable
        )}
      >
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
      </body>
    </html>
  );
}
