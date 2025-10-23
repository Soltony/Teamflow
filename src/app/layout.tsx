
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/context/auth-context";
import { AuthShell } from "@/components/auth-shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "NIB EPMO",
    template: "%s | NIB EPMO",
  },
  description: "A project management solution to assign tasks and manage activity online.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/NIB_International_Bank_logo.png/480px-NIB_International_Bank_logo.png",
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
          <AuthShell>{children}</AuthShell>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
