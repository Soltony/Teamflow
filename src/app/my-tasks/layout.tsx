import { AppShellProvider } from "@/components/app-shell";

export default function MyTasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}