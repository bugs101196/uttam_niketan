import { describe, expect, it } from "vitest";
import {
  addCounts,
  attendanceRate,
  attendanceRecordsSchema,
  correctionSchema,
  countStatuses,
  describeAttendanceError,
  startSessionSchema,
} from "@/lib/attendance";
import { formatDate, isIsoDate, isIsoMonth, monthRange, todayIn } from "@/lib/dates";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("dates", () => {
  it("uses the school timezone for today", () => {
    // 20:00 UTC on 25 Oct is already 26 Oct in India (UTC+5:30).
    expect(todayIn("Asia/Kolkata", new Date("2026-10-25T20:00:00Z"))).toBe("2026-10-26");
    expect(todayIn("Asia/Kolkata", new Date("2026-10-25T18:00:00Z"))).toBe("2026-10-25");
  });

  it("validates real calendar dates and months", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("26-10-2026")).toBe(false);
    expect(isIsoMonth("2026-10")).toBe(true);
    expect(isIsoMonth("2026-13")).toBe(false);
  });

  it("computes month ranges including leap years", () => {
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("formats a date without shifting the day", () => {
    expect(formatDate("2026-10-26")).toContain("26");
  });
});

describe("attendance validation", () => {
  it("accepts a valid roster", () => {
    expect(attendanceRecordsSchema.safeParse([{ student_id: id(1), status: "present" }]).success).toBe(true);
  });

  it("rejects duplicates, unknown statuses and bad ids", () => {
    expect(
      attendanceRecordsSchema.safeParse([
        { student_id: id(1), status: "present" },
        { student_id: id(1), status: "absent" },
      ]).success,
    ).toBe(false);
    expect(attendanceRecordsSchema.safeParse([{ student_id: id(1), status: "asleep" }]).success).toBe(false);
    expect(attendanceRecordsSchema.safeParse([{ student_id: "1", status: "present" }]).success).toBe(false);
  });

  it("requires a real date and section to start", () => {
    expect(startSessionSchema.safeParse({ section_id: id(1), date: "2026-10-26" }).success).toBe(true);
    expect(startSessionSchema.safeParse({ section_id: id(1), date: "2026-02-30" }).success).toBe(false);
  });

  it("requires a reason for corrections", () => {
    expect(correctionSchema.safeParse({ student_id: id(1), status: "absent", reason: " " }).success).toBe(false);
    expect(correctionSchema.safeParse({ student_id: id(1), status: "absent", reason: "Wrong child" }).success).toBe(
      true,
    );
  });
});

describe("summaries", () => {
  it("counts statuses and rates attendance", () => {
    const c = countStatuses(["present", "present", "late", "absent", "excused"]);
    expect(c).toEqual({ present: 2, absent: 1, late: 1, excused: 1, total: 5 });
    // (2 present + 1 late) / (2 + 1 + 1 absent); excused left out.
    expect(attendanceRate(c)).toBe(75);
    expect(attendanceRate(countStatuses(["excused"]))).toBeNull();
    expect(addCounts(c, c).total).toBe(10);
  });
});

describe("describeAttendanceError", () => {
  it("turns database messages into staff-friendly text", () => {
    expect(describeAttendanceError({ code: "22023", message: "Attendance is missing for 2 student(s)" })).toBe(
      "Mark every student before submitting (2 students are not marked).",
    );
    expect(describeAttendanceError({ code: "22023", message: "Attendance cannot be taken for a future date" })).toBe(
      "Attendance cannot be taken for a future date.",
    );
    expect(describeAttendanceError({ code: "42501", message: "Not allowed to take attendance for this section" })).toBe(
      "You do not have permission to do this.",
    );
    expect(describeAttendanceError({ code: "XX000", message: "internal detail" })).not.toContain("internal");
  });
});
