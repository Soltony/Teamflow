
import { AppShellProvider } from "@/components/app-shell";

export default function DepartmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}
