import { Brand } from "@/components/brand";
import { WaveIcon } from "@/components/icons";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ocean-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-ocean-700/50 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-coral-600/20 blur-3xl"
        />

        <Brand href="/login" inverse />

        <div className="relative max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ocean-300">
            Surf shop operations
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight">
            Every sale, one clean line.
          </h1>
          <p className="mt-4 text-base leading-7 text-ocean-100">
            Record the day&apos;s sales against partners, keep customer details optional, and see
            the numbers add up as you type.
          </p>

          <ul className="mt-10 space-y-4 text-sm text-ocean-100">
            {[
              "Line items with live totals and server-side validation",
              "Daily, weekly, and monthly reports you can trust",
              "Customer search by name or phone, scoped by role",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                  <WaveIcon className="size-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-ocean-300">
          Private workspace · Authorized staff only
        </p>
      </aside>

      <div className="flex items-center justify-center bg-sand-50 px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Brand href="/login" />
          </div>
          {children}
          <p className="mt-8 text-center text-xs text-slate-400">
            Surf Daily Sales · Secure session access
          </p>
        </div>
      </div>
    </div>
  );
}
