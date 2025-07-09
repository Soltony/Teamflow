
import { AppShellProvider } from "@/components/app-shell";

export default function CEOReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}
