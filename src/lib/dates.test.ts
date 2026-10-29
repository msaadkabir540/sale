import { describe, expect, it } from "vitest";

import {
  addDays,
  daysInclusive,
  endOfMonth,
  formatDate,
  formatReportPeriodLabel,
  parseIsoDate,
  resolveReportRange,
  startOfMonth,
  startOfWeek,
  toIsoDate,
  todayIso,
} from "./dates";

describe("date parsing", () => {
  it("accepts valid calendar dates", () => {
    expect(parseIsoDate("2026-10-28")?.toISOString()).toBe("2026-10-28T00:00:00.000Z");
    expect(parseIsoDate("2024-02-29")).not.toBeNull();
  });

  it("rejects invalid or normalized dates", () => {
    expect(parseIsoDate("2026-02-29")).toBeNull();
    expect(parseIsoDate("2026-13-01")).toBeNull();
    expect(parseIsoDate("2026-1-1")).toBeNull();
    expect(parseIsoDate("not-a-date")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
  });

  it("formats UTC dates", () => {
    expect(toIsoDate(new Date("2026-10-28T23:59:59Z"))).toBe("2026-10-28");
    expect(formatDate("2026-10-28")).toBe("Oct 28, 2026");
    expect(formatDate(null)).toBe("—");
  });
});

describe("calendar math", () => {
  it("adds days across months and leap years", () => {
    expect(addDays("2026-10-28", 5)).toBe("2026-11-02");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("counts inclusive days", () => {
    expect(daysInclusive("2026-10-01", "2026-10-01")).toBe(1);
    expect(daysInclusive("2026-10-01", "2026-10-31")).toBe(31);
    expect(daysInclusive("2024-02-01", "2024-02-29")).toBe(29);
    expect(daysInclusive("2026-10-31", "2026-10-01")).toBe(0);
  });

  it("starts weeks on Monday", () => {
    expect(startOfWeek("2026-10-28")).toBe("2026-10-26");
    expect(startOfWeek("2026-10-26")).toBe("2026-10-26");
    expect(startOfWeek("2026-11-01")).toBe("2026-10-26");
    expect(startOfWeek("2026-11-02")).toBe("2026-11-02");
  });

  it("finds month boundaries", () => {
    expect(startOfMonth("2026-10-28")).toBe("2026-10-01");
    expect(endOfMonth("2026-10-28")).toBe("2026-10-31");
    expect(endOfMonth("2024-02-10")).toBe("2024-02-29");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(endOfMonth("2026-12-15")).toBe("2026-12-31");
  });

  it("computes today in UTC", () => {
    expect(todayIso(new Date("2026-10-28T23:30:00Z"))).toBe("2026-10-28");
    expect(todayIso(new Date("2026-10-29T00:30:00Z"))).toBe("2026-10-29");
  });
});

describe("report ranges", () => {
  const today = "2026-10-28";

  it("resolves presets", () => {
    expect(resolveReportRange("today", { today })).toEqual({ from: today, to: today });
    expect(resolveReportRange("week", { today })).toEqual({
      from: "2026-10-26",
      to: "2026-11-01",
    });
    expect(resolveReportRange("month", { today })).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(resolveReportRange("last_month", { today })).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("handles last month across a year boundary", () => {
    expect(resolveReportRange("last_month", { today: "2026-01-15" })).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("accepts a valid custom range", () => {
    expect(resolveReportRange("custom", { today, from: "2026-10-01", to: "2026-10-15" })).toEqual({
      from: "2026-10-01",
      to: "2026-10-15",
    });
  });

  it("rejects invalid custom ranges", () => {
    expect(resolveReportRange("custom", { today })).toBeNull();
    expect(resolveReportRange("custom", { today, from: "2026-10-20" })).toBeNull();
    expect(
      resolveReportRange("custom", { today, from: "2026-10-20", to: "2026-10-01" }),
    ).toBeNull();
    expect(
      resolveReportRange("custom", { today, from: "2025-01-01", to: "2026-10-28" }),
    ).toBeNull();
    expect(
      resolveReportRange("custom", { today, from: "2026-02-30", to: "2026-03-01" }),
    ).toBeNull();
  });

  it("accepts a 366-day custom range", () => {
    expect(
      resolveReportRange("custom", { today, from: "2025-10-28", to: "2026-10-28" }),
    ).not.toBeNull();
  });

  it("labels periods", () => {
    expect(formatReportPeriodLabel("month", { from: "2026-10-01", to: "2026-10-31" })).toBe(
      "October 2026",
    );
    expect(formatReportPeriodLabel("today", { from: today, to: today })).toBe(
      "Today · Oct 28, 2026",
    );
    expect(
      formatReportPeriodLabel("custom", { from: "2026-10-01", to: "2026-10-15" }),
    ).toBe("Custom range");
  });
});
