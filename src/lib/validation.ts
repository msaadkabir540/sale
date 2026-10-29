import { z } from "zod";

import {
  daysInclusive,
  isReportPeriod,
  parseIsoDate,
  REPORT_MAX_DAYS,
  type ReportPeriod,
} from "@/lib/dates";
import { roundMoney } from "@/lib/money";
import { phoneDigitCount } from "@/lib/phone";
import { firstParam, type RawSearchParams } from "@/lib/search-params";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const emptyStringToUndefined = (value: unknown): unknown =>
  value === null || (typeof value === "string" && value.trim() === "") ? undefined : value;

export const uuidSchema = z
  .string()
  .trim()
  .regex(UUID_PATTERN, "Select a valid record.");

export const isoDateSchema = z
  .string()
  .trim()
  .refine((value) => parseIsoDate(value) !== null, "Enter a valid date.");

export const customerNameSchema = z
  .string()
  .trim()
  .max(120, "Customer name must be 120 characters or fewer.")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

export const customerPhoneSchema = z
  .string()
  .trim()
  .max(40, "Customer phone must be 40 characters or fewer.")
  .optional()
  .superRefine((value, context) => {
    if (value && value.length > 0 && phoneDigitCount(value) < 5) {
      context.addIssue({
        code: "custom",
        message: "Enter a phone number with at least 5 digits.",
      });
    }
  })
  .transform((value) => (value && value.length > 0 ? value : null));

export const optionalPartnerIdSchema = z
  .preprocess(
    emptyStringToUndefined,
    z.string().trim().regex(UUID_PATTERN, "Select a valid partner.").optional(),
  )
  .transform((value) => value ?? null);

export const memoItemSchema = z.object({
  partnerId: optionalPartnerIdSchema,
  itemName: z
    .string()
    .trim()
    .min(1, "Enter an item name.")
    .max(120, "Item name must be 120 characters or fewer."),
  quantity: z.preprocess(
    emptyStringToUndefined,
    z.coerce
      .number("Enter a quantity.")
      .int("Quantity must be a whole number.")
      .min(1, "Quantity must be at least 1.")
      .max(100_000, "Quantity must be 100,000 or fewer."),
  ),
  unitPrice: z.preprocess(
    emptyStringToUndefined,
    z.coerce
      .number("Enter a unit price.")
      .min(0, "Unit price cannot be negative.")
      .max(1_000_000, "Unit price must be 1,000,000 or less.")
      .transform(roundMoney),
  ),
});

export const memoInputSchema = z.object({
  saleDate: isoDateSchema,
  customerName: customerNameSchema,
  customerPhone: customerPhoneSchema,
  items: z
    .array(memoItemSchema)
    .min(1, "Add at least one line item.")
    .max(100, "A memo can have at most 100 line items."),
});

export type MemoInput = z.infer<typeof memoInputSchema>;
export type MemoItemInput = z.infer<typeof memoItemSchema>;

export const expenseInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter an expense name.")
    .max(120, "Expense name must be 120 characters or fewer."),
  price: z.preprocess(
    emptyStringToUndefined,
    z.coerce
      .number("Enter a price.")
      .min(0, "Price cannot be negative.")
      .max(100_000_000, "Price must be 100,000,000 or less.")
      .transform(roundMoney),
  ),
});

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export type MemoFormParseResult =
  | { ok: true; data: MemoInput }
  | { ok: false; message: string; fieldErrors: Record<string, string[]> };

export function parseMemoFormData(formData: FormData): MemoFormParseResult {
  const rawItems = formData.get("items");
  let items: unknown;

  try {
    items = JSON.parse(typeof rawItems === "string" ? rawItems : "[]");
  } catch {
    return {
      ok: false,
      message: "The line items could not be read. Please try again.",
      fieldErrors: { items: ["Line items are invalid."] },
    };
  }

  const result = memoInputSchema.safeParse({
    saleDate: formData.get("saleDate") ?? undefined,
    customerName: formData.get("customerName") ?? undefined,
    customerPhone: formData.get("customerPhone") ?? undefined,
    items,
  });

  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};

    for (const issue of result.error.issues) {
      let key = issue.path.length > 0 ? String(issue.path[0]) : "form";
      let message = issue.message;

      if (issue.path[0] === "items" && typeof issue.path[1] === "number") {
        key = "items";
        message = `Item ${issue.path[1] + 1}: ${issue.message}`;
      }

      (fieldErrors[key] ??= []).push(message);
    }

    return {
      ok: false,
      message: "Please fix the highlighted fields and try again.",
      fieldErrors,
    };
  }

  return { ok: true, data: result.data };
}

export const partnerNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a partner name.")
  .max(120, "Partner name must be 120 characters or fewer.");

export function parsePartnerName(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const result = partnerNameSchema.safeParse(value);
  return result.success ? result.data : null;
}

export const roleSchema = z.enum(["owner", "admin", "salesman"]);

export function parseRole(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const result = roleSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseUuid(value: string | null | undefined): string | null {
  if (!value) return null;
  const result = uuidSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parsePartnerActive(value: FormDataEntryValue | null): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export type HistoryQuery = {
  from: string | null;
  to: string | null;
  query: string | null;
  partnerId: string | null;
  page: number;
  dateError: string | null;
};

export function parseHistorySearchParams(params: RawSearchParams): HistoryQuery {
  const rawFrom = firstParam(params, "from");
  const rawTo = firstParam(params, "to");
  const from = rawFrom && parseIsoDate(rawFrom) ? rawFrom : null;
  const to = rawTo && parseIsoDate(rawTo) ? rawTo : null;

  let dateError: string | null = null;
  if ((rawFrom && !from) || (rawTo && !to)) {
    dateError = "Enter valid dates (YYYY-MM-DD).";
  } else if (from && to && from > to) {
    dateError = "The start date must be on or before the end date.";
  }

  const pageValue = Number.parseInt(firstParam(params, "page") ?? "1", 10);
  const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;

  return {
    from: dateError ? null : from,
    to: dateError ? null : to,
    query: (firstParam(params, "q") ?? "").trim().slice(0, 120) || null,
    partnerId: parseUuid(firstParam(params, "partner")),
    page,
    dateError,
  };
}

export type ReportQuery = {
  period: ReportPeriod;
  from: string | null;
  to: string | null;
  partnerId: string | null;
  dateError: string | null;
};

export function parseReportSearchParams(params: RawSearchParams): ReportQuery {
  const rawPeriod = firstParam(params, "period");
  const period: ReportPeriod = isReportPeriod(rawPeriod) ? rawPeriod : "month";
  const rawFrom = firstParam(params, "from");
  const rawTo = firstParam(params, "to");
  const from = rawFrom && parseIsoDate(rawFrom) ? rawFrom : null;
  const to = rawTo && parseIsoDate(rawTo) ? rawTo : null;

  let dateError: string | null = null;
  if (period === "custom") {
    if (!from || !to) {
      dateError = "Choose both a start date and an end date.";
    } else if (from > to) {
      dateError = "The start date must be on or before the end date.";
    } else if (daysInclusive(from, to) > REPORT_MAX_DAYS) {
      dateError = `Choose a range of ${REPORT_MAX_DAYS} days or fewer.`;
    }
  }

  return {
    period,
    from,
    to,
    partnerId: parseUuid(firstParam(params, "partner")),
    dateError,
  };
}
