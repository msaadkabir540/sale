import { Brand } from "@/components/brand";
import { CheckIcon } from "@/components/icons";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-brand-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.28),transparent_55%)]"
        />

        <Brand href="/login" inverse />

        <div className="relative max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-300">
            Sales ledger
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight">
            A clearer way to keep the khata.
          </h1>
          <p className="mt-4 text-base leading-7 text-brand-100/80">
            Record the day&apos;s sales against partners, keep customer details optional, and watch
            the totals add up as you type.
          </p>

          <ul className="mt-10 space-y-3 text-sm text-brand-100/90">
            {[
              "Line items with live totals and server-side validation",
              "Daily, weekly, and monthly reports you can trust",
              "Customer search by name or phone, scoped by role",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                  <CheckIcon className="size-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-brand-300">
          Private workspace · Authorized staff only
        </p>
      </aside>

      <div className="flex items-center justify-center bg-surface-50 px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Brand href="/login" />
          </div>
          {children}
          <p className="mt-8 text-center text-xs text-slate-400">
            Darwaesh Khata · Secure session access
          </p>
        </div>
      </div>
    </div>
  );
}
