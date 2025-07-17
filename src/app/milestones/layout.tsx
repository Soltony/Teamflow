import { AppShellProvider } from "@/components/app-shell";

export default function MilestonesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}