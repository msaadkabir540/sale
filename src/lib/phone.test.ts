import { describe, expect, it } from "vitest";

import { normalizePhone, phoneDigitCount } from "./phone";

describe("phone normalization", () => {
  it("keeps digits in order", () => {
    expect(normalizePhone("+1 (555) 010-2030")).toBe("15550102030");
    expect(normalizePhone("555.010.2030")).toBe("5550102030");
    expect(normalizePhone(" 555 0102 ")).toBe("5550102");
  });

  it("returns null when there are no digits", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
    expect(normalizePhone("call me")).toBeNull();
  });

  it("counts digits consistently with normalization", () => {
    expect(phoneDigitCount("+1 (555) 010-2030")).toBe(11);
    expect(phoneDigitCount("1234")).toBe(4);
    expect(phoneDigitCount("no digits")).toBe(0);
  });
});
