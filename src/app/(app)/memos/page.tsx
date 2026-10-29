import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert } from "@/components/alert";
import { EmptyState } from "@/components/empty-state";
import { ChevronRightIcon, SearchIcon } from "@/components/icons";
import { MemoTable } from "@/components/memo-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requireProfile } from "@/lib/auth";
import { formatDate, formatDateRange } from "@/lib/dates";
import { listSalesMemos, MEMO_PAGE_SIZE } from "@/lib/memo-queries";
import { listPartnerOptions } from "@/lib/partner-queries";
import { canViewAllSales } from "@/lib/permissions";
import { parseHistorySearchParams } from "@/lib/validation";

export const metadata: Metadata = { title: "Sales history" };

type MemosPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const NOTICES: Record<string, { variant: "success" | "warning"; message: string }> = {
  created: { variant: "success", message: "Sale saved." },
  updated: { variant: "success", message: "Sale updated." },
  deleted: { variant: "success", message: "Sale deleted along with its line items." },
  readonly: { variant: "warning", message: "You can edit only the sales you recorded." },
};

function first(value: string | string[] | undefined): string | null {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved ?? null;
}

export default async function MemosPage({ searchParams }: MemosPageProps) {
  const profile = await requireProfile();
  if (profile.role === "salesman") redirect("/memos/new");

  const params = await searchParams;
  const query = parseHistorySearchParams(params);

  const [{ partners }, result] = await Promise.all([
    listPartnerOptions(),
    listSalesMemos({
      from: query.from,
      to: query.to,
      query: query.query,
      partnerId: query.partnerId,
      page: query.page,
      pageSize: MEMO_PAGE_SIZE,
    }),
  ]);

  const selectedPartner = partners.find((partner) => partner.id === query.partnerId) ?? null;
  const notice = NOTICES[first(params.notice) ?? ""];
  const hasFilters = Boolean(query.query || query.from || query.to || query.partnerId);

  const buildHref = (targetPage: number) => {
    const search = new URLSearchParams();
    if (query.query) search.set("q", query.query);
    if (query.from) search.set("from", query.from);
    if (query.to) search.set("to", query.to);
    if (query.partnerId) search.set("partner", query.partnerId);
    if (targetPage > 1) search.set("page", String(targetPage));
    const suffix = search.toString();
    return suffix ? `/memos?${suffix}` : "/memos";
  };

  const dateDescription =
    query.from && query.to
      ? formatDateRange(query.from, query.to)
      : query.from
        ? `From ${formatDate(query.from)}`
        : query.to
          ? `Through ${formatDate(query.to)}`
          : null;

  const resultDescription = [
    query.query ? `Customer search “${query.query}”` : null,
    dateDescription,
    selectedPartner ? selectedPartner.name : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sales history"
        title="Every sale, searchable"
        description={
          canViewAllSales(profile.role)
            ? "Review the team's sales, filter by date or partner, and find a sale by customer name or phone number."
            : "Review your recorded sales and find a sale by customer name or phone number. Your history is private to your account."
        }
        actions={<ButtonLink href="/memos/new">Add sale</ButtonLink>}
      />

      {notice ? <Alert variant={notice.variant}>{notice.message}</Alert> : null}
      {query.dateError ? <Alert variant="error">{query.dateError}</Alert> : null}

      <section className="card p-5" aria-label="History filters">
        <form
          method="get"
          action="/memos"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_10rem_10rem_auto] xl:items-end"
        >
          <Field
            label="Search customer"
            htmlFor="history-search"
            className="sm:col-span-2 xl:col-span-1"
          >
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                id="history-search"
                name="q"
                defaultValue={query.query ?? ""}
                maxLength={120}
                placeholder="Name or phone number"
                autoComplete="off"
              />
            </div>
          </Field>

          <Field label="Partner" htmlFor="history-partner">
            <Select
              id="history-partner"
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

          <Field label="From" htmlFor="history-from">
            <Input
              id="history-from"
              name="from"
              type="date"
              defaultValue={query.from ?? ""}
            />
          </Field>

          <Field label="To" htmlFor="history-to">
            <Input
              id="history-to"
              name="to"
              type="date"
              defaultValue={query.to ?? ""}
            />
          </Field>

          <div className="flex items-center gap-2 sm:col-span-2 xl:col-span-1">
            <Button type="submit">Apply</Button>
            {hasFilters || query.dateError ? (
              <ButtonLink href="/memos" variant="secondary">
                Clear
              </ButtonLink>
            ) : null}
          </div>
        </form>

        <p className="hint mt-3 flex items-center gap-1">
          <ChevronRightIcon className="size-3" />
          Customer search covers all dates unless you add a range. Sales without customer details
          still appear in the normal date-based history.
        </p>
      </section>

      {result.failed ? (
        <Alert variant="error" title="Sales history could not be loaded">
          Refresh the page to try again. If this continues, check the Supabase connection.
        </Alert>
      ) : (
        <section className="card" aria-label="Sales history results">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                {query.query ? "Search results" : "Sales history"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {result.total} {result.total === 1 ? "sale" : "sales"}
                {resultDescription ? ` · ${resultDescription}` : ""}
              </p>
            </div>
            <span className="badge badge-admin self-start">
              {canViewAllSales(profile.role) ? "Company scope" : "Your sales only"}
            </span>
          </div>

          {result.rows.length > 0 ? <MemoTable rows={result.rows} /> : null}

          {result.rows.length === 0 ? (
            <div className="p-5">
              {query.page > 1 ? (
                <EmptyState
                  title="No sales on this page"
                  description="The page number is beyond the available results."
                  action={
                    <ButtonLink href={buildHref(1)}>Back to first page</ButtonLink>
                  }
                />
              ) : hasFilters ? (
                <EmptyState
                  title="No matching sales"
                  description="Try a different name, phone number, partner, or date range. Customer fields are optional, so a sale may exist without them."
                  action={
                    <ButtonLink href="/memos" variant="secondary">
                      Clear filters
                    </ButtonLink>
                  }
                />
              ) : (
                <EmptyState
                  title="No sales recorded yet"
                  description="Record your first sale to see it here, along with daily, weekly, and monthly totals."
                  action={
                    <ButtonLink href="/memos/new">Add sale</ButtonLink>
                  }
                />
              )}
            </div>
          ) : null}

          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            pageSize={MEMO_PAGE_SIZE}
            buildHref={buildHref}
          />
        </section>
      )}
    </div>
  );
}
