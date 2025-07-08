import { AppShellProvider } from "@/components/app-shell";

export default function ProjectDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShellProvider>{children}</AppShellProvider>;
}
