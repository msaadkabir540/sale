import { cn } from "@/lib/cn";

const SIZE_CLASSES = {
  sm: "size-7",
  md: "size-8",
  lg: "size-9",
} as const;

const TONE_CLASSES = {
  default: "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
  danger: "text-slate-400 hover:bg-red-50 hover:text-red-600",
  brand: "bg-brand-700 text-white hover:bg-brand-800",
} as const;

export function IconButton({
  label,
  tone = "default",
  size = "md",
  type = "button",
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  label: string;
  tone?: "default" | "danger" | "brand";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-30",
        SIZE_CLASSES[size],
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
