import { cn } from "@/lib/cn";

export function Label({
  className,
  children,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label className={cn("label", className)} {...props}>
      {children}
    </label>
  );
}

export function FieldErrors({
  messages,
  id,
}: {
  messages?: string[];
  id?: string;
}) {
  if (!messages || messages.length === 0) return null;

  return (
    <ul id={id} className="mt-1 space-y-1 text-xs font-medium text-red-600">
      {messages.map((message, index) => (
        <li key={`${message}-${index}`}>{message}</li>
      ))}
    </ul>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  errors,
  optional = false,
  required = false,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  hint?: React.ReactNode;
  errors?: string[];
  optional?: boolean;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-accent-600"> *</span> : null}
        {optional ? (
          <span className="font-normal text-slate-400"> (optional)</span>
        ) : null}
      </Label>
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
      <FieldErrors messages={errors} />
    </div>
  );
}
