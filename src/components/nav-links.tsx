"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ChartIcon,
  GridIcon,
  PlusIcon,
  ReceiptIcon,
  StoreIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";
import type { UserRole } from "@/types/database";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function navItemsForRole(role: UserRole): NavItem[] {
  if (role === "salesman") {
    return [{ href: "/memos/new", label: "Add sale", icon: PlusIcon }];
  }

  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: GridIcon },
    { href: "/memos/new", label: "Add sale", icon: PlusIcon },
    { href: "/memos", label: "Sales", icon: ReceiptIcon },
    { href: "/reports", label: "Reports", icon: ChartIcon },
    { href: "/expenses", label: "Expenses", icon: WalletIcon },
  ];

  if (role === "owner") {
    items.push(
      { href: "/partners", label: "Partners", icon: StoreIcon },
      { href: "/team", label: "Team", icon: UsersIcon },
    );
  }

  return items;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/memos/new") return pathname === "/memos/new";
  if (href === "/memos") {
    return pathname === "/memos" || (pathname.startsWith("/memos/") && pathname !== "/memos/new");
  }
  return pathname === href;
}

export function NavLinks({
  role,
  variant,
  collapsed = false,
}: {
  role: UserRole;
  variant: "desktop" | "mobile";
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const items = navItemsForRole(role);

  if (variant === "mobile") {
    return (
      <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
                  active
                    ? "bg-brand-700 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-brand-700"
                }`}
              >
                <item.icon className="size-3.5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg text-sm font-medium transition ${
                collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
              } ${
                active
                  ? "bg-brand-700 text-white shadow-sm"
                  : "text-slate-600 hover:bg-surface-100 hover:text-slate-900"
              }`}
            >
              <item.icon
                className={`size-4 shrink-0 ${active ? "text-white" : "text-slate-400"}`}
              />
              <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
