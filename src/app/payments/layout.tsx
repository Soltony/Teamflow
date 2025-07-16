
import { AppShellProvider } from "@/components/app-shell";

export default function PaymentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}
