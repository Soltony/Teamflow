import { cn } from "@/lib/utils";
import Image from "next/image";

export function NibLogo({ className }: { className?: string }) {
  return (
    <Image
      src="https://play-lh.googleusercontent.com/bXqMt9ROsGd0H9vPhib5hG-0NB-EJcAwZy6UUDhvlP-ykE595IMQtzr14R6IRWtJiGTh"
      alt="NIB Team Logo"
      width={48}
      height={48}
      className={cn("rounded-md", className)}
    />
  );
}
