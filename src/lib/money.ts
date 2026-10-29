const CURRENCY = "PKR";

const moneyFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

export function calculateLineTotal(quantity: number, unitPrice: number): number {
  return roundMoney(quantity * unitPrice);
}

export function calculateGrandTotal(
  items: readonly { quantity: number; unitPrice: number }[],
): number {
  return roundMoney(
    items.reduce((sum, item) => sum + calculateLineTotal(item.quantity, item.unitPrice), 0),
  );
}

export function formatMoney(value: number | string | null | undefined): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  const formatted = moneyFormatter.format(Number.isFinite(numeric) ? (numeric as number) : 0);

  // Intl uses a non-breaking space between "Rs" and the amount.
  return formatted.replace(/\u00a0/g, " ");
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}
