import { describe, expect, it } from "vitest";

import {
  calculateGrandTotal,
  calculateLineTotal,
  formatMoney,
  roundMoney,
} from "./money";

describe("money", () => {
  it("rounds half up to two decimals", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(10.994)).toBe(10.99);
    expect(roundMoney(10.995)).toBe(11);
    expect(roundMoney(-0.004)).toBe(0);
  });

  it("treats non-finite values as zero", () => {
    expect(roundMoney(Number.NaN)).toBe(0);
    expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("calculates line totals", () => {
    expect(calculateLineTotal(2, 25.5)).toBe(51);
    expect(calculateLineTotal(3, 10.99)).toBe(32.97);
    expect(calculateLineTotal(0, 10)).toBe(0);
    expect(calculateLineTotal(1, 0)).toBe(0);
  });

  it("sums line totals with cent precision", () => {
    expect(
      calculateGrandTotal([
        { quantity: 2, unitPrice: 25.5 },
        { quantity: 1, unitPrice: 100 },
      ]),
    ).toBe(151);

    expect(
      calculateGrandTotal([
        { quantity: 1, unitPrice: 5.99 },
        { quantity: 3, unitPrice: 0.01 },
      ]),
    ).toBe(6.02);

    expect(
      calculateGrandTotal([
        { quantity: 100000, unitPrice: 1000000 },
      ]),
    ).toBe(100_000_000_000);
  });

  it("formats amounts for display", () => {
    expect(formatMoney(151)).toBe("Rs 151.00");
    expect(formatMoney(5.9)).toBe("Rs 5.90");
    expect(formatMoney("12.345")).toBe("Rs 12.35");
    expect(formatMoney(null)).toBe("Rs 0.00");
    expect(formatMoney(Number.NaN)).toBe("Rs 0.00");
  });
});
