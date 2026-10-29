"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

export function Modal({
  open,
  onClose,
  labelledBy,
  align = "center",
  className = "w-full max-w-md p-5",
  children,
}: {
  open: boolean;
  onClose?: () => void;
  labelledBy: string;
  align?: "center" | "top";
  className?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="presentation"
      className={cn(
        "fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-950/50 p-4",
        align === "top" ? "items-start pt-[10vh]" : "items-center",
      )}
      onMouseDown={(event) => {
        if (onClose && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn("card shadow-xl", className)}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
