import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-surface-50/60 px-6 py-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="size-6">
          <path d="M4 7h16v13H4zM8 7V5a4 4 0 0 1 8 0v2" strokeLinejoin="round" />
          <path d="M8 12h8M8 16h5" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
