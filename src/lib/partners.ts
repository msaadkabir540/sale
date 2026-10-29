type PartnerNamedItem = {
  partner_name?: string | null;
};

/** Distinct partner names across line items, with a compact overflow label. */
export function summarizePartners(items: readonly PartnerNamedItem[]): string {
  const names = Array.from(
    new Set(
      items
        .map((item) => item.partner_name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  );

  if (names.length === 0) return "No partner";
  if (names.length <= 2) return names.join(", ");
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}
