import { cn } from "@/lib/utils";

export function NibLogo({ className }: { className?: string }) {
  return (
    <svg
      className={cn("w-12 h-12", className)}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="48" fill="#003366" />
      <text
        x="50"
        y="65"
        fontFamily="Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif"
        fontSize="40"
        fontWeight="600"
        fill="white"
        textAnchor="middle"
      >
        NIB
      </text>
    </svg>
  );
}
