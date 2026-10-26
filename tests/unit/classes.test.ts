import { describe, expect, it } from "vitest";
import { academicYearSchema, classSchema, sectionSchema } from "@/lib/validation/classes";

describe("class and year validation", () => {
  it("accepts typical names in English and Hindi", () => {
    expect(classSchema.safeParse({ name: "Class 1", sort_order: "3" }).data).toEqual({
      name: "Class 1",
      sort_order: 3,
    });
    expect(classSchema.safeParse({ name: "कक्षा 1", sort_order: 0 }).success).toBe(true);
    expect(sectionSchema.safeParse({ name: " B " }).data).toEqual({ name: "B" });
  });

  it("rejects empty, too long and odd characters", () => {
    expect(classSchema.safeParse({ name: "  ", sort_order: 0 }).success).toBe(false);
    expect(classSchema.safeParse({ name: "<script>", sort_order: 0 }).success).toBe(false);
    expect(classSchema.safeParse({ name: "Class 1", sort_order: 1.5 }).success).toBe(false);
    expect(sectionSchema.safeParse({ name: "ABCDEFGHIJK" }).success).toBe(false);
  });

  it("requires a year to end after it starts", () => {
    const year = { name: "2027-28", start_date: "2027-04-01", end_date: "2028-03-31", copy_structure: true };
    expect(academicYearSchema.safeParse(year).success).toBe(true);
    const backwards = academicYearSchema.safeParse({ ...year, end_date: "2027-03-31" });
    expect(backwards.success).toBe(false);
    expect(backwards.error?.issues[0].path).toEqual(["end_date"]);
    expect(academicYearSchema.safeParse({ ...year, start_date: "2027-02-30" }).success).toBe(false);
  });
});
