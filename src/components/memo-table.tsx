import Link from "next/link";

import { ChevronRightIcon } from "@/components/icons";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { summarizePartners } from "@/lib/partners";
import { ROLE_LABELS } from "@/lib/permissions";
import type { MemoItemSummary, SalesMemoListRow } from "@/types/database";

function itemsSummary(items: MemoItemSummary[]): string {
  if (items.length === 0) return "No line items";
  return items.map((item) => `${item.item_name} ×${item.quantity}`).join(", ");
}

export function MemoTable({ rows }: { rows: SalesMemoListRow[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((row) => {
        const customer = row.customer_name ?? row.customer_phone;
        const items = itemsSummary(row.items);

        return (
          <li key={row.id}>
            <Link
              href={`/memos/${row.id}`}
              className="group grid gap-3 px-5 py-4 transition hover:bg-surface-50 sm:grid-cols-[8rem_minmax(0,1fr)_10rem_7.5rem] sm:items-center sm:gap-4"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{formatDate(row.sale_date)}</p>
                <p className="truncate text-xs text-slate-500">{summarizePartners(row.items)}</p>
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {customer ?? <span className="text-slate-400">No customer details</span>}
                </p>
                <p className="truncate text-xs text-slate-500" title={items}>
                  {row.customer_name && row.customer_phone ? `${row.customer_phone} · ` : null}
                  {items}
                </p>
              </div>

              <div className="text-xs text-slate-500">
                <p className="truncate font-medium text-slate-700">
                  {row.created_by_name}
                  <span className="font-normal text-slate-400">
                    {" "}
                    · {ROLE_LABELS[row.created_by_role]}
                  </span>
                </p>
                <p>{formatDate(row.created_at.slice(0, 10))}</p>
              </div>

              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <span className="text-sm font-semibold tabular-nums text-slate-900">
                  {formatMoney(row.grand_total)}
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-slate-300 group-hover:text-brand-600" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
