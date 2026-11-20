import type { DbErrorLike } from "@/lib/db-errors";

// create_invoice/record_cash_payment/reverse_payment raise these messages
// (see the 20261120000200 migration). Map them to wording for school staff
// instead of showing database text directly -- same pattern as
// describeAttendanceError in lib/attendance.ts.
const knownMessages: { match: RegExp; message: string }[] = [
  { match: /label is required/i, message: "A label is required." },
  { match: /student not found/i, message: "That student could not be found." },
  { match: /no active academic year/i, message: "There is no active academic year set for this school." },
  {
    match: /no fee structure is set/i,
    message: "No fee structure is set for this student's class yet. Set fees before creating an invoice.",
  },
  { match: /amount must be a positive number/i, message: "Enter an amount greater than zero." },
  { match: /invoice not found/i, message: "That invoice could not be found." },
  { match: /invoice has been waived/i, message: "This invoice has been waived; no further payment can be recorded." },
  { match: /reason is required/i, message: "Give a short reason." },
  { match: /payment not found/i, message: "That payment could not be found." },
  { match: /only a completed payment can be reversed/i, message: "Only a completed payment can be reversed." },
  { match: /reversal entry cannot itself be reversed/i, message: "A reversal cannot itself be reversed." },
  { match: /already been reversed/i, message: "This payment has already been reversed." },
];

export function describeFeesError(error: DbErrorLike): string {
  const known = knownMessages.find((k) => k.match.test(error.message ?? ""));
  if (known) return known.message;
  if (error.code === "42501") return "You do not have permission to do this.";
  if (error.code === "P0002") return "That record could not be found.";
  return "Something went wrong. Please try again.";
}
