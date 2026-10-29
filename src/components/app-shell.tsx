"use client";

import { usePathname } from "next/navigation";

import { signOutAction } from "@/app/(auth)/actions";
import { Brand } from "@/components/brand";
import { RoleBadge } from "@/components/badge";
import { LogOutIcon } from "@/components/icons";
import { NavLinks } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/types/database";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const isSaleEditor =
    pathname === "/memos/new" || /^\/memos\/[^/]+\/edit$/.test(pathname);

  if (isSaleEditor) {
    return (
      <main className="min-h-dvh w-full px-4 py-4 sm:px-6 lg:h-dvh lg:overflow-hidden lg:px-8 lg:py-5">
        {children}
      </main>
    );
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-slate-200 bg-white/80 px-4 py-6 backdrop-blur md:flex">
        <Brand />

        <nav className="mt-8 flex-1" aria-label="Main navigation">
          <NavLinks role={profile.role} variant="desktop" />
        </nav>

        <div className="rounded-2xl border border-slate-200 bg-sand-50 p-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ocean-100 text-xs font-bold text-ocean-800">
              {initials(profile.full_name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{profile.full_name}</p>
              <div className="mt-1">
                <RoleBadge role={profile.role} />
              </div>
            </div>
          </div>

          <form action={signOutAction} className="mt-3">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
            >
              <LogOutIcon className="size-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-sand-50/95 px-4 pt-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3">
            <Brand />
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-ocean-100 text-[11px] font-bold text-ocean-800">
                {initials(profile.full_name)}
              </span>
              <form action={signOutAction}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  aria-label="Sign out"
                >
                  <LogOutIcon className="size-4" />
                </Button>
              </form>
            </div>
          </div>

          <nav className="mt-3" aria-label="Main navigation">
            <NavLinks role={profile.role} variant="mobile" />
          </nav>
        </header>

        <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-10 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
