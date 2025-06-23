import { AppShellProvider } from "@/components/app-shell";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}
