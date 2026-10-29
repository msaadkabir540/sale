import { cn } from "@/lib/cn";

export function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select className={cn("input", className)} {...props}>
      {children}
    </select>
  );
}
