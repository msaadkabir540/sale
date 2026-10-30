import Link from "next/link";

import { LedgerIcon } from "@/components/icons";
import { IconButton } from "@/components/ui/icon-button";

export function Brand({
  href = "/dashboard",
  inverse = false,
  onToggle,
  collapsed = false,
}: {
  href?: string;
  inverse?: boolean;
  onToggle?: () => void;
  collapsed?: boolean;
}) {
  const wordmark = (
    <span className="leading-tight">
      <span
        className={`block text-[15px] font-semibold tracking-tight ${
          inverse ? "text-white" : "text-slate-900"
        }`}
      >
        Darwaesh Khata
      </span>
      <span
        className={`block text-[10px] font-medium uppercase tracking-[0.18em] ${
          inverse ? "text-brand-200" : "text-slate-500"
        }`}
      >
        Sales Ledger
      </span>
    </span>
  );

  if (onToggle) {
    return (
      <div className="flex items-center gap-2.5">
        <IconButton
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls="sidebar-nav"
          size="lg"
          tone="brand"
          onClick={onToggle}
        >
          <LedgerIcon className="size-5" />
        </IconButton>
        {collapsed ? null : (
          <Link href={href} className="leading-tight">
            {wordmark}
          </Link>
        )}
      </div>
    );
  }

  return (
    <Link href={href} className="inline-flex items-center gap-2.5">
      <span
        className={`flex size-9 items-center justify-center rounded-lg ${
          inverse ? "bg-white/10 text-white ring-1 ring-white/15" : "bg-brand-700 text-white"
        }`}
      >
        <LedgerIcon className="size-5" />
      </span>
      {wordmark}
    </Link>
  );
}
