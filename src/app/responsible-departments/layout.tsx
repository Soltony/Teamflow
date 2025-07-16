import { AppShellProvider } from "@/components/app-shell";

export default function ResponsibleDepartmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}