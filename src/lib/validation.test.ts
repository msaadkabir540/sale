import { describe, expect, it } from "vitest";

import {
  expenseInputSchema,
  parseHistorySearchParams,
  parseMemoFormData,
  parsePartnerName,
  parseReportSearchParams,
  parseRole,
} from "./validation";

const PARTNER_ID = "2f1c5f0e-9a1b-4c2d-8e3f-123456789abc";
const BASE_ITEMS = [{ itemName: "Jacket", quantity: "2", unitPrice: "25.50" }];

function memoForm(fields: {
  saleDate?: string;
  customerName?: string;
  customerPhone?: string;
  items?: unknown;
  omitItems?: boolean;
} = {}): FormData {
  const formData = new FormData();
  formData.set("saleDate", fields.saleDate ?? "2026-10-28");

  if (fields.customerName !== undefined) formData.set("customerName", fields.customerName);
  if (fields.customerPhone !== undefined) formData.set("customerPhone", fields.customerPhone);
  if (!fields.omitItems) formData.set("items", JSON.stringify(fields.items ?? BASE_ITEMS));

  return formData;
}

describe("memo form validation", () => {
  it("accepts both optional customer fields", () => {
    const result = parseMemoFormData(
      memoForm({ customerName: "  Ana Souza ", customerPhone: "+1 (555) 010-2030" }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.customerName).toBe("Ana Souza");
    expect(result.data.customerPhone).toBe("+1 (555) 010-2030");
    expect(result.data.items).toEqual([
      { partnerId: null, itemName: "Jacket", quantity: 2, unitPrice: 25.5 },
    ]);
  });

  it("accepts a name without a phone", () => {
    const result = parseMemoFormData(memoForm({ customerName: "Ana Souza" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.customerName).toBe("Ana Souza");
    expect(result.data.customerPhone).toBeNull();
  });

  it("accepts a phone without a name", () => {
    const result = parseMemoFormData(memoForm({ customerPhone: "555 0102" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.customerName).toBeNull();
    expect(result.data.customerPhone).toBe("555 0102");
  });

  it("accepts neither customer field", () => {
    const result = parseMemoFormData(memoForm());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.customerName).toBeNull();
    expect(result.data.customerPhone).toBeNull();
  });

  it("normalizes empty customer strings to null", () => {
    const result = parseMemoFormData(memoForm({ customerName: "   ", customerPhone: "  " }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.customerName).toBeNull();
    expect(result.data.customerPhone).toBeNull();
  });

  it("rejects a phone with fewer than five digits", () => {
    const result = parseMemoFormData(memoForm({ customerPhone: "1234" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.customerPhone?.[0]).toMatch(/at least 5 digits/);
    expect(result.fieldErrors.customerName).toBeUndefined();
  });

  it("rejects an empty item list", () => {
    const result = parseMemoFormData(memoForm({ items: [] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.items?.[0]).toMatch(/at least one line item/);
  });

  it("rejects more than 100 items", () => {
    const items = Array.from({ length: 101 }, (_, index) => ({
      itemName: `Item ${index}`,
      quantity: "1",
      unitPrice: "1",
    }));
    const result = parseMemoFormData(memoForm({ items }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.items?.[0]).toMatch(/at most 100/);
  });

  it("rejects invalid quantities", () => {
    for (const quantity of ["0", "-1", "1.5", "100001", ""]) {
      const result = parseMemoFormData(
        memoForm({ items: [{ itemName: "Jacket", quantity, unitPrice: "10" }] }),
      );
      expect(result.ok, `quantity ${quantity}`).toBe(false);
      if (result.ok) continue;
      expect(result.fieldErrors.items?.join(" ")).toMatch(/Item 1:/);
    }
  });

  it("rejects empty or oversized prices", () => {
    for (const unitPrice of ["", "-1", "1000000.01"]) {
      const result = parseMemoFormData(
        memoForm({ items: [{ itemName: "Jacket", quantity: "1", unitPrice }] }),
      );
      expect(result.ok, `price ${unitPrice}`).toBe(false);
    }
  });

  it("rounds unit prices to cents", () => {
    const result = parseMemoFormData(
      memoForm({ items: [{ itemName: "Jacket", quantity: "1", unitPrice: "10.999" }] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0]?.unitPrice).toBe(11);
  });

  it("rejects a blank item name", () => {
    const result = parseMemoFormData(
      memoForm({ items: [{ itemName: "   ", quantity: "1", unitPrice: "10" }] }),
    );
    expect(result.ok).toBe(false);
  });

  it("handles an optional partner on each item", () => {
    const withPartner = parseMemoFormData(
      memoForm({ items: [{ ...BASE_ITEMS[0], partnerId: PARTNER_ID }] }),
    );
    expect(withPartner.ok).toBe(true);
    if (withPartner.ok) {
      expect(withPartner.data.items[0]?.partnerId).toBe(PARTNER_ID);
    }

    const withoutPartner = parseMemoFormData(
      memoForm({ items: [{ ...BASE_ITEMS[0], partnerId: "" }] }),
    );
    expect(withoutPartner.ok).toBe(true);
    if (withoutPartner.ok) {
      expect(withoutPartner.data.items[0]?.partnerId).toBeNull();
    }

    const invalidPartner = parseMemoFormData(
      memoForm({ items: [{ ...BASE_ITEMS[0], partnerId: "not-a-uuid" }] }),
    );
    expect(invalidPartner.ok).toBe(false);
    if (!invalidPartner.ok) {
      expect(invalidPartner.fieldErrors.items?.join(" ")).toMatch(/valid partner/i);
    }

    const invalidDate = parseMemoFormData(memoForm({ saleDate: "2026-02-30" }));
    expect(invalidDate.ok).toBe(false);
    if (!invalidDate.ok) {
      expect(invalidDate.fieldErrors.saleDate).toBeTruthy();
    }
  });

  it("rejects missing or malformed item JSON", () => {
    const missing = parseMemoFormData(memoForm({ omitItems: true }));
    expect(missing.ok).toBe(false);

    const formData = memoForm();
    formData.set("items", "{not json");
    const malformed = parseMemoFormData(formData);
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) {
      expect(malformed.message).toMatch(/could not be read/);
    }
  });
});

describe("history search params", () => {
  it("defaults to page 1 with no filters", () => {
    expect(parseHistorySearchParams({})).toEqual({
      from: null,
      to: null,
      query: null,
      partnerId: null,
      page: 1,
      dateError: null,
    });
  });

  it("keeps valid filters and a query", () => {
    const result = parseHistorySearchParams({
      from: "2026-10-01",
      to: "2026-10-31",
      q: "  5550102 ",
      partner: PARTNER_ID,
      page: "3",
    });

    expect(result).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-31",
      query: "5550102",
      partnerId: PARTNER_ID,
      page: 3,
      dateError: null,
    });
  });

  it("reports invalid dates and ignores them", () => {
    const result = parseHistorySearchParams({ from: "yesterday", to: "2026-10-31" });
    expect(result.dateError).toBeTruthy();
    expect(result.from).toBeNull();
    expect(result.to).toBeNull();
  });

  it("reports an inverted range", () => {
    const result = parseHistorySearchParams({ from: "2026-10-31", to: "2026-10-01" });
    expect(result.dateError).toMatch(/on or before/);
    expect(result.from).toBeNull();
    expect(result.to).toBeNull();
  });

  it("normalizes the page and ignores invalid partners", () => {
    expect(parseHistorySearchParams({ page: "-2" }).page).toBe(1);
    expect(parseHistorySearchParams({ page: "abc" }).page).toBe(1);
    expect(parseHistorySearchParams({ partner: "nope" }).partnerId).toBeNull();
  });

  it("preserves LIKE wildcard characters for the database to escape", () => {
    expect(parseHistorySearchParams({ q: "%" }).query).toBe("%");
    expect(parseHistorySearchParams({ q: "_" }).query).toBe("_");
  });
});

describe("report search params", () => {
  it("defaults to this month", () => {
    expect(parseReportSearchParams({})).toMatchObject({
      period: "month",
      partnerId: null,
      dateError: null,
    });
  });

  it("falls back to month for an unknown period", () => {
    expect(parseReportSearchParams({ period: "decade" }).period).toBe("month");
  });

  it("validates a custom range", () => {
    expect(
      parseReportSearchParams({
        period: "custom",
        from: "2026-10-01",
        to: "2026-10-31",
      }).dateError,
    ).toBeNull();

    expect(parseReportSearchParams({ period: "custom" }).dateError).toMatch(/both/);
    expect(
      parseReportSearchParams({
        period: "custom",
        from: "2026-10-31",
        to: "2026-10-01",
      }).dateError,
    ).toMatch(/on or before/);
    expect(
      parseReportSearchParams({
        period: "custom",
        from: "2024-01-01",
        to: "2026-10-01",
      }).dateError,
    ).toMatch(/366 days/);
  });

  it("ignores dates for preset periods", () => {
    expect(
      parseReportSearchParams({ period: "week", from: "bad", to: "bad" }).dateError,
    ).toBeNull();
  });
});

describe("expense validation", () => {
  it("accepts a name and price, trimming and rounding", () => {
    const result = expenseInputSchema.safeParse({
      name: "  Shopping bag ",
      price: "1400.005",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toEqual({ name: "Shopping bag", price: 1400.01 });
  });

  it("rejects missing names and prices", () => {
    expect(expenseInputSchema.safeParse({ name: " ", price: "10" }).success).toBe(false);
    expect(expenseInputSchema.safeParse({ name: "Fuel", price: "" }).success).toBe(false);
    expect(expenseInputSchema.safeParse({ name: "Fuel" }).success).toBe(false);
  });

  it("rejects negative and oversized prices", () => {
    expect(expenseInputSchema.safeParse({ name: "Fuel", price: "-1" }).success).toBe(false);
    expect(
      expenseInputSchema.safeParse({ name: "Fuel", price: "100000001" }).success,
    ).toBe(false);
  });
});

describe("small form parsers", () => {
  it("parses partner names", () => {
    expect(parsePartnerName("  Sunset Surf Co ")).toBe("Sunset Surf Co");
    expect(parsePartnerName("   ")).toBeNull();
    expect(parsePartnerName(null)).toBeNull();
  });

  it("parses roles", () => {
    expect(parseRole("owner")).toBe("owner");
    expect(parseRole("admin")).toBe("admin");
    expect(parseRole("salesman")).toBe("salesman");
    expect(parseRole("superuser")).toBeNull();
    expect(parseRole(null)).toBeNull();
  });
});
