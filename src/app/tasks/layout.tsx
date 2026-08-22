
import { AppShellProvider } from "@/components/app-shell";

export default function TaskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}
