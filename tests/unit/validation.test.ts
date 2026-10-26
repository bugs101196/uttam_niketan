import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/paths";
import { describeDbError } from "@/lib/db-errors";
import { fieldErrors, normalizePhone, parseStudentForm } from "@/lib/validation/student";

describe("normalizePhone", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["098765-43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["+44 7700 900123", "+447700900123"],
  ])("accepts %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "12345", "5876543210", "+91 12345 67890", "98765abc10", "+0123456789"])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

function form(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const values = {
    admission_no: "UN-2026/001",
    full_name: "  Test Child ",
    section_id: "00000000-0000-4000-8000-000000000999",
    roll_no: "4",
    guardian_name: "",
    guardian_phone: "98765 43210",
    preferred_language: "hi",
    ...overrides,
  };
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe("student form validation", () => {
  it("normalises valid input", () => {
    const result = parseStudentForm(form());
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      full_name: "Test Child",
      roll_no: 4,
      guardian_name: null,
      guardian_phone: "+919876543210",
      guardian_notifications_consent: false,
      enrollment_status: "active",
    });
  });

  it("reports a message per invalid field", () => {
    const result = parseStudentForm(
      form({
        admission_no: "",
        full_name: "A",
        section_id: "nope",
        roll_no: "2.5",
        guardian_phone: "123",
        preferred_language: "fr",
      }),
    );
    expect(result.success).toBe(false);
    expect(Object.keys(fieldErrors(result.error!)).sort()).toEqual(
      ["admission_no", "full_name", "guardian_phone", "preferred_language", "roll_no", "section_id"].sort(),
    );
  });

  it("rejects characters that do not belong in an admission number", () => {
    expect(parseStudentForm(form({ admission_no: "UN 1; drop" })).success).toBe(false);
  });

  it("reads the consent checkbox", () => {
    const fd = form();
    fd.set("guardian_notifications_consent", "on");
    expect(parseStudentForm(fd).data?.guardian_notifications_consent).toBe(true);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/students?q=a", "/students?q=a"],
    ["/staff", "/staff"],
    ["//evil.example", "/dashboard"],
    ["https://evil.example", "/dashboard"],
    ["/\\evil.example", "/dashboard"],
    ["/about", "/dashboard"],
    [undefined, "/dashboard"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("describeDbError", () => {
  it("maps duplicate admission numbers to the field", () => {
    const result = describeDbError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "students_unique_admission_no"',
    });
    expect(result.fieldErrors).toEqual({ admission_no: "Another student already has this admission number." });
  });

  it("never echoes raw database text", () => {
    const result = describeDbError({ code: "XX000", message: "secret internal detail" });
    expect(result.message).not.toContain("secret");
  });
});
