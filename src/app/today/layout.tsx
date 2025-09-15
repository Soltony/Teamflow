
import { AppShellProvider } from "@/components/app-shell";

export default function TodayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}
