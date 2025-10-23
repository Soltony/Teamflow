
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/context/auth-context";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = {
  title: {
    default: "NIB EPMO",
    template: "%s | NIB EPMO",
  },
  description: "A project management solution to assign tasks and manage activity online.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "https://img.logoipsum.com/288.svg",
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
          "min-h-screen bg-background font-sans antialiased"
        )}
      >
        <AuthProvider>
          <AuthShell>{children}</AuthShell>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}

    