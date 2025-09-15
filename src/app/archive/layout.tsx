
import { AppShellProvider } from "@/components/app-shell";

export default function ArchiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}

    