import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Alert } from "@/components/alert";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHeadCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireProfile } from "@/lib/auth";
import {
  formatDate,
  formatReportPeriodLabel,
  formatDateRange,
  resolveReportRange,
  todayIso,
  REPORT_PERIODS,
  type ReportPeriod,
} from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/money";
import { listPartnerOptions } from "@/lib/partner-queries";
import { canViewAllSales } from "@/lib/permissions";
import { getSalesReport } from "@/lib/report-queries";
import { parseReportSearchParams } from "@/lib/validation";

export const metadata: Metadata = { title: "Reports" };

type ReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const profile = await requireProfile();
  if (profile.role === "salesman") redirect("/memos/new");

  const params = await searchParams;
  const query = parseReportSearchParams(params);
  const today = todayIso();

  const fallbackRange = resolveReportRange("month", { today })!;
  const resolvedRange = resolveReportRange(query.period, {
    today,
    from: query.from,
    to: query.to,
  });
  const range = resolvedRange ?? fallbackRange;
  const rangeLabel = formatReportPeriodLabel(resolvedRange ? query.period : "month", range);

  const [{ partners, failed: partnersFailed }, report] = await Promise.all([
    listPartnerOptions(),
    getSalesReport(range, query.partnerId),
  ]);

  const rangeError = query.dateError ?? (resolvedRange ? null : "Check the custom date range.");
  const selectedPartner = partners.find((partner) => partner.id === query.partnerId) ?? null;

  const quickRangeHref = (period: ReportPeriod) => {
    const search = new URLSearchParams({ period });
    if (query.partnerId) search.set("partner", query.partnerId);
    return `/reports?${search.toString()}`;
  };

  const totalSales = report?.summary.grand_total ?? 0;
  const memoCount = report?.summary.memo_count ?? 0;
  const itemCount = report?.summary.item_count ?? 0;
  const averageMemo = memoCount > 0 ? totalSales / memoCount : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Performance"
        title="Sales reports"
        description={
          canViewAllSales(profile.role)
            ? "Company-wide totals for day, week, month, or a custom range, with a partner breakdown."
            : "Your own sales for day, week, month, or a custom range. Other salesmen's sales are never included."
        }
      />

      {rangeError ? <Alert variant="error">{rangeError} Showing this month instead.</Alert> : null}

      <section className="card p-5" aria-label="Report filters">
        <form
          method="get"
          action="/reports"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[11rem_minmax(0,1fr)_10rem_10rem_auto] xl:items-end"
        >
          <Field label="Period" htmlFor="report-period">
            <Select id="report-period" name="period" defaultValue={query.period}>
              {REPORT_PERIODS.map((period) => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Partner" htmlFor="report-partner">
            <Select
              id="report-partner"
              name="partner"
              defaultValue={query.partnerId ?? ""}
            >
              <option value="">All partners</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                  {partner.is_active ? "" : " (inactive)"}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="From" htmlFor="report-from">
            <Input
              id="report-from"
              name="from"
              type="date"
              defaultValue={query.from ?? range.from}
            />
          </Field>

          <Field label="To" htmlFor="report-to">
            <Input
              id="report-to"
              name="to"
              type="date"
              defaultValue={query.to ?? range.to}
            />
          </Field>

          <div className="flex items-center gap-2 sm:col-span-2 xl:col-span-1">
            <Button type="submit">Apply</Button>
            <ButtonLink href="/reports" variant="secondary">
              Reset
            </ButtonLink>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Quick ranges:</span>
          {REPORT_PERIODS.filter((period) => period.value !== "custom").map((period) => (
            <Link
              key={period.value}
              href={quickRangeHref(period.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                query.period === period.value
                  ? "bg-ocean-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {period.label}
            </Link>
          ))}
          <span className="text-xs text-slate-400">
            · Use “Custom range” with the date fields.
          </span>
        </div>

        {partnersFailed ? (
          <p className="hint text-amber-700">Partner filter unavailable. Refresh to try again.</p>
        ) : null}
      </section>

      {report === null ? (
        <Alert variant="error" title="Reports could not be loaded">
          Refresh the page to try again. If this continues, check the Supabase connection.
        </Alert>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-admin">
              {canViewAllSales(profile.role) ? "Company scope" : "Your sales only"}
            </span>
            <span className="text-sm text-slate-500">
              {rangeLabel} · {formatDateRange(range.from, range.to)}
              {selectedPartner ? ` · ${selectedPartner.name}` : ""}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total sales" value={formatMoney(totalSales)} tone="accent" hint={rangeLabel} />
            <StatCard
              label="Sales recorded"
              value={formatNumber(memoCount)}
              hint={`${formatNumber(itemCount)} line items`}
            />
            <StatCard
              label="Line items"
              value={formatNumber(itemCount)}
              hint="Item rows across these sales"
            />
            <StatCard
              label="Average sale"
              value={formatMoney(averageMemo)}
              hint="Total sales ÷ sales recorded"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <section className="card" aria-label="Partner breakdown">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-semibold tracking-tight text-slate-900">
                  Sales by partner
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedPartner ? selectedPartner.name : "All partners in this period"}.
                </p>
              </div>

              {report.partners.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="No partner sales in this period"
                    description="Try a wider date range or a different partner filter."
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHeadCell>Partner</TableHeadCell>
                      <TableHeadCell align="right">Sales</TableHeadCell>
                      <TableHeadCell align="right">Amount</TableHeadCell>
                      <TableHeadCell>Share</TableHeadCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.partners.map((partner) => {
                      const share =
                        totalSales > 0 ? (Number(partner.grand_total) / totalSales) * 100 : 0;

                      return (
                        <TableRow key={partner.partner_id ?? "unassigned"}>
                          <TableCell className="font-medium text-slate-900">
                            {partner.partner_name}
                          </TableCell>
                          <TableCell align="right" className="tabular-nums">
                            {formatNumber(partner.memo_count)}
                          </TableCell>
                          <TableCell align="right" className="tabular-nums">
                            {formatMoney(partner.grand_total)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-ocean-500"
                                  style={{ width: `${Math.max(Math.min(share, 100), 0)}%` }}
                                />
                              </div>
                              <span className="text-xs tabular-nums text-slate-500">
                                {share.toFixed(0)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </section>

            <section className="card" aria-label="Daily breakdown">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-semibold tracking-tight text-slate-900">
                  Daily breakdown
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {formatDate(range.from)} – {formatDate(range.to)} · {rangeLabel}
                </p>
              </div>

              <Table wrapperClassName="max-h-[26rem] overflow-auto">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow>
                    <TableHeadCell>Day</TableHeadCell>
                    <TableHeadCell align="right">Sales</TableHeadCell>
                    <TableHeadCell align="right">Amount</TableHeadCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.days.map((day) => (
                    <TableRow key={day.day}>
                      <TableCell
                        className={
                          day.memo_count === 0
                            ? "text-slate-400"
                            : "font-medium text-slate-900"
                        }
                      >
                        {formatDate(day.day)}
                      </TableCell>
                      <TableCell align="right" className="tabular-nums text-slate-500">
                        {formatNumber(day.memo_count)}
                      </TableCell>
                      <TableCell
                        align="right"
                        className={`tabular-nums ${
                          day.memo_count === 0 ? "text-slate-400" : "text-slate-800"
                        }`}
                      >
                        {formatMoney(day.grand_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="border-t border-slate-200 bg-slate-50/80">
                    <TableCell className="text-sm font-semibold text-slate-700">
                      Total
                    </TableCell>
                    <TableCell
                      align="right"
                      className="text-sm font-semibold tabular-nums text-slate-700"
                    >
                      {formatNumber(memoCount)}
                    </TableCell>
                    <TableCell
                      align="right"
                      className="text-sm font-semibold tabular-nums text-ocean-800"
                    >
                      {formatMoney(totalSales)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
