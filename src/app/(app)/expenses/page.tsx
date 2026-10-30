import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Alert } from "@/components/alert";
import { EmptyState } from "@/components/empty-state";
import { ExpenseDialog } from "@/components/expense-dialog";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
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
  formatDateRange,
  resolveReportRange,
  todayIso,
  type DateRange,
} from "@/lib/dates";
import { listExpenses } from "@/lib/expense-queries";
import { formatMoney, roundMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Expenses" };

type ExpensePeriod = "today" | "week" | "month";

const PERIODS: { value: ExpensePeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

type ExpensesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parsePeriod(value: string | string[] | undefined): ExpensePeriod {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved === "today" || resolved === "week" ? resolved : "month";
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const profile = await requireProfile();
  if (profile.role === "salesman") redirect("/memos/new");

  const params = await searchParams;
  const period = parsePeriod(params.period);
  const today = todayIso();

  const todayRange: DateRange = { from: today, to: today };
  const weekRange = resolveReportRange("week", { today })!;
  const monthRange = resolveReportRange("month", { today })!;
  const fetchFrom = monthRange.from < weekRange.from ? monthRange.from : weekRange.from;

  const { expenses, failed } = await listExpenses(fetchFrom, today);

  const sumRange = (range: DateRange) =>
    roundMoney(
      expenses
        .filter(
          (expense) =>
            expense.expense_date >= range.from && expense.expense_date <= range.to,
        )
        .reduce((sum, expense) => sum + Number(expense.amount), 0),
    );

  const countRange = (range: DateRange) =>
    expenses.filter(
      (expense) =>
        expense.expense_date >= range.from && expense.expense_date <= range.to,
    ).length;

  const selectedRange =
    period === "today" ? todayRange : period === "week" ? weekRange : monthRange;
  const selectedExpenses = expenses.filter(
    (expense) =>
      expense.expense_date >= selectedRange.from &&
      expense.expense_date <= selectedRange.to,
  );
  const selectedTotal = roundMoney(
    selectedExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0),
  );
  const selectedLabel =
    period === "today" ? "Today" : period === "week" ? "This week" : "This month";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Spending"
        title="Expenses"
        description="Record day-to-day spending and review daily, weekly, and monthly totals."
        actions={<ExpenseDialog label="Add expense" variant="primary" refreshOnSuccess />}
      />

      {failed ? (
        <Alert variant="error" title="Expenses could not be loaded">
          Refresh the page to try again. If the problem continues, check the Supabase connection.
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Today"
              value={formatMoney(sumRange(todayRange))}
              hint={`${countRange(todayRange)} ${
                countRange(todayRange) === 1 ? "expense" : "expenses"
              }`}
              tone="accent"
            />
            <StatCard
              label="This week"
              value={formatMoney(sumRange(weekRange))}
              hint={`${countRange(weekRange)} ${
                countRange(weekRange) === 1 ? "expense" : "expenses"
              }`}
            />
            <StatCard
              label="This month"
              value={formatMoney(sumRange(monthRange))}
              hint={`${countRange(monthRange)} ${
                countRange(monthRange) === 1 ? "expense" : "expenses"
              }`}
            />
          </div>

          <section className="card" aria-label="Expense entries">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-slate-900">
                  Expense entries
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedLabel} · {formatDateRange(selectedRange.from, selectedRange.to)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
                {PERIODS.map((option) => (
                  <Link
                    key={option.value}
                    href={`/expenses?period=${option.value}`}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      period === option.value
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </div>

            {selectedExpenses.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title={`No expenses for ${selectedLabel.toLowerCase()}`}
                  description="Add an expense with the button above. Salesmen can also add expenses from their sale screen."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHeadCell>Date</TableHeadCell>
                    <TableHeadCell>Expense</TableHeadCell>
                    <TableHeadCell>Recorded by</TableHeadCell>
                    <TableHeadCell align="right">Amount</TableHeadCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="whitespace-nowrap text-slate-500">
                        {formatDate(expense.expense_date)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {expense.name}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {expense.created_by_name}
                      </TableCell>
                      <TableCell align="right" className="font-medium tabular-nums text-slate-900">
                        {formatMoney(expense.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="border-t border-slate-200 bg-slate-50/80">
                    <TableCell
                      colSpan={3}
                      align="right"
                      className="text-sm font-semibold text-slate-700"
                    >
                      {selectedLabel} total
                    </TableCell>
                    <TableCell
                      align="right"
                      className="text-base font-semibold tabular-nums text-brand-800"
                    >
                      {formatMoney(selectedTotal)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
