import Link from "next/link";

import { WaveIcon } from "@/components/icons";

export function Brand({
  href = "/dashboard",
  inverse = false,
}: {
  href?: string;
  inverse?: boolean;
}) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5">
      <span
        className={`flex size-9 items-center justify-center rounded-xl ${
          inverse ? "bg-white/10 text-white ring-1 ring-white/20" : "bg-ocean-700 text-white"
        }`}
      >
        <WaveIcon className="size-5" />
      </span>
      <span className="leading-tight">
        <span
          className={`block text-sm font-semibold tracking-tight ${
            inverse ? "text-white" : "text-slate-900"
          }`}
        >
          Surf
        </span>
        <span
          className={`block text-[11px] font-medium uppercase tracking-[0.16em] ${
            inverse ? "text-ocean-200" : "text-slate-500"
          }`}
        >
          Daily Sales
        </span>
      </span>
    </Link>
  );
}
