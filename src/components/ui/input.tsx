import { cn } from "@/lib/cn";

export function Input({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return <input className={cn("input", className)} {...props} />;
}
