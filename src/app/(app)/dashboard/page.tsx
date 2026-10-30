import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Alert } from "@/components/alert";
import { EmptyState } from "@/components/empty-state";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { MemoTable } from "@/components/memo-table";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import {
  formatDate,
  formatReportPeriodLabel,
  formatMonth,
  resolveReportRange,
  todayIso,
} from "@/lib/dates";
import { listSalesMemos } from "@/lib/memo-queries";
import { formatMoney, formatNumber } from "@/lib/money";
import { canViewAllSales } from "@/lib/permissions";
import { getSalesReport, getSalesSummary } from "@/lib/report-queries";

export const metadata: Metadata = { title: "Dashboard" };

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | null {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved ?? null;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const profile = await requireProfile();
  if (profile.role === "salesman") redirect("/memos/new");

  const params = await searchParams;
  const today = todayIso();

  const todayRange = { from: today, to: today };
  const weekRange = resolveReportRange("week", { today })!;
  const monthRange = resolveReportRange("month", { today })!;

  const [todaySummary, weekSummary, monthReport, recent] = await Promise.all([
    getSalesSummary(todayRange),
    getSalesSummary(weekRange),
    getSalesReport(monthRange),
    listSalesMemos({ pageSize: 5 }),
  ]);

  const failed =
    todaySummary === null ||
    weekSummary === null ||
    monthReport === null ||
    recent.failed;

  const firstName = profile.full_name.split(/\s+/)[0] ?? profile.full_name;
  const notice = first(params.notice);
  const scopeLabel = canViewAllSales(profile.role) ? "Company-wide view" : "Your sales only";

  const monthLabel = formatReportPeriodLabel("month", monthRange);
  const monthPartners = monthReport?.partners ?? [];
  const monthTotal = monthReport?.summary.grand_total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={formatDate(today)}
        title={`Welcome back, ${firstName}`}
        description={`${scopeLabel} · ${monthLabel}. Record the day, then check how the month is tracking.`}
        actions={
          <ButtonLink href="/memos/new">
            <PlusIcon className="size-4" />
            Add sale
          </ButtonLink>
        }
      />

      {notice === "forbidden" ? (
        <Alert variant="warning">
          That area is restricted to owners. You still have access to everything your role permits.
        </Alert>
      ) : null}

      {failed ? (
        <Alert variant="error" title="Some dashboard data could not be loaded">
          Refresh the page to try again. Anything shown below may be incomplete.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today"
          value={todaySummary ? formatMoney(todaySummary.grand_total) : "—"}
          hint={
            todaySummary
              ? `${formatNumber(todaySummary.memo_count)} ${
                  todaySummary.memo_count === 1 ? "sale" : "sales"
                }`
              : undefined
          }
          tone="accent"
        />
        <StatCard
          label="This week"
          value={weekSummary ? formatMoney(weekSummary.grand_total) : "—"}
          hint={weekSummary ? `${formatNumber(weekSummary.memo_count)} sales` : undefined}
        />
        <StatCard
          label="This month"
          value={monthReport ? formatMoney(monthReport.summary.grand_total) : "—"}
          hint={monthReport ? `${formatNumber(monthReport.summary.memo_count)} sales` : undefined}
        />
        <StatCard
          label="Line items this month"
          value={monthReport ? formatNumber(monthReport.summary.item_count) : "—"}
          hint="Item rows across the month's sales"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <section className="card" aria-label="Recent sales">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                Recent sales
              </h2>
              <p className="mt-1 text-sm text-slate-500">The latest five sales in your scope.</p>
            </div>
            <Link
              href="/memos"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              View all
              <ChevronRightIcon className="size-3.5" />
            </Link>
          </div>

          {recent.failed ? (
            <div className="p-5">
              <Alert variant="error">Recent sales could not be loaded. Refresh to try again.</Alert>
            </div>
          ) : recent.rows.length > 0 ? (
            <MemoTable rows={recent.rows} />
          ) : (
            <div className="p-5">
              <EmptyState
                title="No sales recorded yet"
                description="Record the first sale of the day. Totals, history, and reports update immediately."
                action={<ButtonLink href="/memos/new">Add sale</ButtonLink>}
              />
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="card" aria-label="Monthly partner breakdown">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-slate-900">
                  This month by partner
                </h2>
                <p className="mt-1 text-sm text-slate-500">{formatMonth(monthRange.from)}</p>
              </div>
              <Link
                href="/reports?period=month"
                className="text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                Reports
              </Link>
            </div>

            <div className="p-5">
              {monthPartners.length === 0 ? (
                <p className="text-sm text-slate-500">No partner sales this month yet.</p>
              ) : (
                <ul className="space-y-4">
                  {monthPartners.slice(0, 5).map((partner) => {
                    const share = monthTotal > 0 ? (partner.grand_total / monthTotal) * 100 : 0;

                    return (
                      <li key={partner.partner_id ?? "unassigned"}>
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {partner.partner_name}
                          </p>
                          <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                            {formatMoney(partner.grand_total)}
                          </p>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-brand-500"
                              style={{ width: `${Math.max(Math.min(share, 100), 0)}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-xs tabular-nums text-slate-500">
                            {share.toFixed(0)}%
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {monthPartners.length > 5 ? (
                <Link
                  href="/reports?period=month"
                  className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-700"
                >
                  View {monthPartners.length - 5} more
                  <ChevronRightIcon className="size-3" />
                </Link>
              ) : null}
            </div>
          </section>

          <section className="card p-5" aria-label="Quick actions">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">Quick actions</h2>
            <div className="mt-3 space-y-1">
              {[
                { href: "/memos/new", label: "Add sale" },
                { href: "/memos", label: "Browse sales" },
                { href: "/reports", label: "Open reports" },
                ...(profile.role === "owner"
                  ? [
                      { href: "/partners", label: "Manage partners" },
                      { href: "/team", label: "Manage team roles" },
                    ]
                  : []),
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  {action.label}
                  <ChevronRightIcon className="size-4 text-slate-300" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
