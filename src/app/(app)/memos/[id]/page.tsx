import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Alert } from "@/components/alert";
import { RoleBadge } from "@/components/badge";
import { SectionCard } from "@/components/card";
import { DeleteMemoButton } from "@/components/delete-memo-button";
import { PencilIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ButtonLink } from "@/components/ui/button";
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
import { formatDate, formatDateTime } from "@/lib/dates";
import { getMemoDetail } from "@/lib/memo-queries";
import { formatMoney } from "@/lib/money";
import { summarizePartners } from "@/lib/partners";
import { canDeleteMemo, canEditMemo } from "@/lib/permissions";
import { parseUuid } from "@/lib/validation";

export const metadata: Metadata = { title: "Sale" };

type MemoDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const NOTICES: Record<string, { variant: "success" | "warning"; message: string }> = {
  created: { variant: "success", message: "Sale saved. Totals were verified on the server." },
  updated: { variant: "success", message: "Sale updated and totals recalculated." },
  readonly: {
    variant: "warning",
    message: "You can edit only the sales you recorded. An owner can edit any sale.",
  },
};

function first(value: string | string[] | undefined): string | null {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved ?? null;
}

export default async function MemoDetailPage({ params, searchParams }: MemoDetailPageProps) {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const memoId = parseUuid(id);
  if (!memoId) notFound();

  const profile = await requireProfile();
  if (profile.role === "salesman") redirect("/memos/new");

  const detail = await getMemoDetail(memoId);
  if (!detail) notFound();

  const { memo, items } = detail;
  const notice = NOTICES[first(queryParams.notice) ?? ""];
  const editable = canEditMemo(profile.role, memo.created_by, profile.id);
  const deletable = canDeleteMemo(profile.role);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sale"
        title={formatDate(memo.sale_date)}
        description={`${summarizePartners(items)} · Recorded by ${memo.created_by_name}`}
        actions={
          <>
            <ButtonLink href="/memos" variant="secondary">
              Back to sales
            </ButtonLink>
            {editable ? (
              <ButtonLink href={`/memos/${memo.id}/edit`}>
                <PencilIcon className="size-4" />
                Edit sale
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {notice ? (
        <Alert variant={notice.variant}>{notice.message}</Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Grand total" value={formatMoney(memo.grand_total)} tone="accent" />
        <StatCard label="Line items" value={String(items.length)} hint="Number of item rows" />
        <StatCard label="Total qty" value={String(totalUnits)} hint="Sum of quantities" />
        <StatCard label="Sale date" value={formatDate(memo.sale_date)} hint={`Sale ${memo.id.slice(0, 8)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Customer"
          description="Optional details recorded with this sale."
        >
          {memo.customer_name || memo.customer_phone ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {memo.customer_name ?? <span className="text-slate-400">Not recorded</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone
                </dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {memo.customer_phone ?? <span className="text-slate-400">Not recorded</span>}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                No customer details were recorded on this sale.
              </p>
              <Alert variant="info">
                Sales without customer information still count in every history view and report.
              </Alert>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Sale details">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Partners
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {summarizePartners(items)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recorded by
              </dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                {memo.created_by_name}
                <RoleBadge role={memo.created_by_role} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Created
              </dt>
              <dd className="mt-1 text-sm text-slate-700">{formatDateTime(memo.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Updated
              </dt>
              <dd className="mt-1 text-sm text-slate-700">{formatDateTime(memo.updated_at)}</dd>
            </div>
          </dl>
        </SectionCard>
      </div>

      <SectionCard
        title="Line items"
        description="Every total below is produced by the database from the stored quantity and unit price."
        contentClassName="p-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeadCell>Item</TableHeadCell>
              <TableHeadCell>Partner</TableHeadCell>
              <TableHeadCell align="right">Qty</TableHeadCell>
              <TableHeadCell align="right">Unit price</TableHeadCell>
              <TableHeadCell align="right">Line total</TableHeadCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-slate-900">
                  {item.item_name}
                </TableCell>
                <TableCell className="text-slate-600">
                  {item.partner_name ?? (
                    <span className="text-slate-400">No partner</span>
                  )}
                </TableCell>
                <TableCell align="right" className="tabular-nums">
                  {item.quantity}
                </TableCell>
                <TableCell align="right" className="tabular-nums">
                  {formatMoney(item.unit_price)}
                </TableCell>
                <TableCell align="right" className="font-medium tabular-nums text-slate-900">
                  {formatMoney(item.line_total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="border-t border-slate-200 bg-slate-50/80">
              <TableCell
                colSpan={4}
                align="right"
                className="text-sm font-semibold text-slate-700"
              >
                Grand total
              </TableCell>
              <TableCell
                align="right"
                className="text-base font-semibold tabular-nums text-brand-800"
              >
                {formatMoney(memo.grand_total)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </SectionCard>

      {deletable ? (
        <SectionCard
          title="Delete this sale"
          description="Deleting removes the sale and all of its line items. This cannot be undone."
          className="border-red-200"
        >
          <DeleteMemoButton memoId={memo.id} />
        </SectionCard>
      ) : null}
    </div>
  );
}
