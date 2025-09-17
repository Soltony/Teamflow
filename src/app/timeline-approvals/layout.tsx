import { AppShellProvider } from "@/components/app-shell";

export default function TimelineApprovalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}
