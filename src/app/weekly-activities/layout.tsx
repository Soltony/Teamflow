
import { AppShellProvider } from "@/components/app-shell";

export default function WeeklyActivitiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}
