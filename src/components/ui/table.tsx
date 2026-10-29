import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Align = "left" | "right" | "center";

const ALIGN_CLASSES: Record<Align, string> = {
  left: "",
  right: "text-right",
  center: "text-center",
};

export function Table({
  children,
  className,
  wrapperClassName = "table-scroll",
}: {
  children: ReactNode;
  className?: string;
  wrapperClassName?: string;
}) {
  return (
    <div className={cn("table-scroll", wrapperClassName)}>
      <table className={cn("data-table", className)}>{children}</table>
    </div>
  );
}

export function TableHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <thead className={className}>{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableFooter({ children }: { children: ReactNode }) {
  return <tfoot>{children}</tfoot>;
}

export function TableRow({
  children,
  ...props
}: React.ComponentProps<"tr">) {
  return <tr {...props}>{children}</tr>;
}

export function TableHeadCell({
  children,
  align = "left",
  className,
  ...props
}: React.ComponentProps<"th"> & { align?: Align }) {
  return (
    <th scope="col" className={cn(ALIGN_CLASSES[align], className)} {...props}>
      {children}
    </th>
  );
}

export function TableCell({
  children,
  align = "left",
  className,
  ...props
}: React.ComponentProps<"td"> & { align?: Align }) {
  return (
    <td className={cn(ALIGN_CLASSES[align], className)} {...props}>
      {children}
    </td>
  );
}
