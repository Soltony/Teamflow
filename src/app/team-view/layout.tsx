import { AppShellProvider } from "@/components/app-shell";

export default function TeamViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}