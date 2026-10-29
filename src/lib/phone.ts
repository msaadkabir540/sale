export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

export function phoneDigitCount(value: string): number {
  return value.replace(/\D/g, "").length;
}
