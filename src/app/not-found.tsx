import { Brand } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <Brand href="/" />
      <div className="card mt-8 w-full max-w-md p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ocean-600">
          404 · Off the map
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          The link may be outdated, or the record may not be available to your account.
        </p>
        <ButtonLink href="/dashboard" className="mt-6 w-full">
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
