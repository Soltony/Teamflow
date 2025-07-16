
import { AppShellProvider } from "@/components/app-shell";

export default function PaymentApprovalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}
