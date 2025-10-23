
import { cn } from "@/lib/utils";
import Image from "next/image";

export function NibLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/img/logo.png"
      alt="NIB EPMO Logo"
      width={48}
      height={48}
      className={cn("rounded-md", className)}
    />
  );
}
