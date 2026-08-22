
import { AppShellProvider } from "@/components/app-shell";

export default function TaskApprovalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}
