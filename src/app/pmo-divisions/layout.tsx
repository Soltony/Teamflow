
import { AppShellProvider } from "@/components/app-shell";

export default function PmoDivisionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}
