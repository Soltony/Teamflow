
import { cn } from "@/lib/utils";
import Image from "next/image";

export function NibLogo({ className }: { className?: string }) {
  return (
    <Image
      src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/NIB_International_Bank_logo.png/480px-NIB_International_Bank_logo.png"
      alt="NIB EPMO Logo"
      width={48}
      height={48}
      className={cn("rounded-md", className)}
    />
  );
}
