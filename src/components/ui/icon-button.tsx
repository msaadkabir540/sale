import { cn } from "@/lib/cn";

export function IconButton({
  label,
  tone = "default",
  type = "button",
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  label: string;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 disabled:pointer-events-none disabled:opacity-30",
        tone === "danger"
          ? "hover:bg-red-50 hover:text-red-600"
          : "hover:bg-slate-100 hover:text-slate-700",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
