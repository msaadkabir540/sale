"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

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
  const [collapsed, setCollapsed] = useState(false);

  const toggleSidebar = () => setCollapsed((current) => !current);

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
    <div
      className={`min-h-dvh md:grid transition-[grid-template-columns] duration-200 ${
        collapsed
          ? "md:grid-cols-[4.75rem_minmax(0,1fr)]"
          : "md:grid-cols-[16rem_minmax(0,1fr)]"
      }`}
    >
      <aside
        className={`sticky top-0 hidden h-dvh flex-col border-r border-slate-200 bg-white py-6 md:flex ${
          collapsed ? "px-2" : "px-4"
        }`}
      >
        <div className={collapsed ? "flex justify-center" : undefined}>
          <Brand onToggle={toggleSidebar} collapsed={collapsed} />
        </div>

        <nav
          id="sidebar-nav"
          className={`${collapsed ? "mt-6" : "mt-8"} flex-1`}
          aria-label="Main navigation"
        >
          <NavLinks role={profile.role} variant="desktop" collapsed={collapsed} />
        </nav>

        {collapsed ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-surface-50 p-2">
            <span
              title={profile.full_name}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800"
            >
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
        ) : (
          <div className="rounded-xl border border-slate-200 bg-surface-50 p-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
                {initials(profile.full_name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {profile.full_name}
                </p>
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
        )}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-surface-50/95 px-4 pt-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3">
            <Brand />
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-800">
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
