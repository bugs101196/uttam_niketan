import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { closePool, createGuardian, createSchool, createUser, Tx, withTx } from "./helpers";

afterAll(closePool);

async function insertFeeHead(tx: Tx, schoolId: string, name = "Tuition") {
  const [row] = await tx.query<{ id: string }>(
    "system",
    "insert into public.fee_heads (school_id, name) values ($1, $2) returning id",
    [schoolId, name],
  );
  return row.id;
}

async function insertFeeStructure(
  tx: Tx,
  f: { schoolId: string; yearId: string; classId: string; feeHeadId: string },
  amount = 1000,
) {
  await tx.query(
    "system",
    "insert into public.fee_structures (school_id, academic_year_id, class_id, fee_head_id, amount) values ($1, $2, $3, $4, $5)",
    [f.schoolId, f.yearId, f.classId, f.feeHeadId, amount],
  );
}

async function createInvoiceDirect(
  tx: Tx,
  f: { schoolId: string; studentId: string; yearId: string },
  label = "Term 1",
  totalAmount = 1000,
) {
  const [row] = await tx.query<{ id: string }>(
    "system",
    `insert into public.student_invoices (school_id, student_id, academic_year_id, label, total_amount)
     values ($1, $2, $3, $4, $5) returning id`,
    [f.schoolId, f.studentId, f.yearId, label, totalAmount],
  );
  return row.id;
}

async function insertCashPayment(tx: Tx, f: { schoolId: string; invoiceId: string; receivedBy: string }, amount = 1000) {
  const [row] = await tx.query<{ id: string }>(
    "system",
    `insert into public.fee_payments (school_id, invoice_id, amount, method, received_by, recorded_via)
     values ($1, $2, $3, 'cash', $4, $4) returning id`,
    [f.schoolId, f.invoiceId, amount, f.receivedBy],
  );
  return row.id;
}

// Phase 6 (online payments) does not exist yet -- this inserts the row shape
// the schema already supports, to prove reverse_payment() handles it before
// any real gateway integration ever writes one.
async function insertOnlinePayment(tx: Tx, f: { schoolId: string; invoiceId: string; recordedVia: string }, amount = 1000) {
  const [row] = await tx.query<{ id: string }>(
    "system",
    `insert into public.fee_payments (school_id, invoice_id, amount, method, gateway, gateway_payment_id, recorded_via)
     values ($1, $2, $3, 'online', 'test-gateway', $4, $5) returning id`,
    [f.schoolId, f.invoiceId, amount, randomUUID(), f.recordedVia],
  );
  return row.id;
}

describe("fee RLS and functions", () => {
  // -------------------------------------------------------------------------
  // create_invoice
  // -------------------------------------------------------------------------

  it("lets an admin create an invoice from the student's class fee structure", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const headId = await insertFeeHead(tx, f.schoolId);
      await insertFeeStructure(tx, { ...f, classId: f.class1Id, feeHeadId: headId }, 1500);

      const [invoice] = await tx.query<{ total_amount: string; status: string }>(
        f.adminId,
        "select * from public.create_invoice($1, $2)",
        [f.students1A[0], "Term 1, 2026-27"],
      );
      expect(invoice.total_amount).toBe("1500.00");
      expect(invoice.status).toBe("unpaid");
    }));

  it("blocks office and teachers from creating an invoice", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const officeId = await createUser(tx, f.schoolId, "office");
      const headId = await insertFeeHead(tx, f.schoolId);
      await insertFeeStructure(tx, { ...f, classId: f.class1Id, feeHeadId: headId });

      for (const actor of [officeId, f.teacherId]) {
        const error = await tx.fails(actor, "select * from public.create_invoice($1, $2)", [f.students1A[0], "Term 1"]);
        expect(error.code).toBe("42501");
      }
    }));

  it("blocks creating an invoice for a student in another school", () =>
    withTx(async (tx) => {
      const a = await createSchool(tx);
      const b = await createSchool(tx);
      const error = await tx.fails(b.adminId, "select * from public.create_invoice($1, $2)", [a.students1A[0], "Term 1"]);
      expect(error.code).toBe("P0002");
    }));

  it("fails clearly when no fee structure is set for the student's class", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const error = await tx.fails(f.adminId, "select * from public.create_invoice($1, $2)", [f.students1A[0], "Term 1"]);
      expect(error.code).toBe("55000");
      expect(error.message).toMatch(/no fee structure/i);
    }));

  // -------------------------------------------------------------------------
  // record_cash_payment
  // -------------------------------------------------------------------------

  it("records a cash payment and moves the invoice through partial to paid", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const invoiceId = await createInvoiceDirect(tx, { ...f, studentId: f.students1A[0] }, "Term 1", 1000);

      const [p1] = await tx.query<{ amount: string }>(f.adminId, "select * from public.record_cash_payment($1, $2, $3)", [
        invoiceId,
        400,
        "first installment",
      ]);
      expect(p1.amount).toBe("400.00");
      let [row] = await tx.query<{ status: string }>("system", "select status from public.student_invoices where id = $1", [
        invoiceId,
      ]);
      expect(row.status).toBe("partial");

      await tx.query(f.adminId, "select * from public.record_cash_payment($1, $2, $3)", [invoiceId, 600, "final"]);
      [row] = await tx.query<{ status: string }>("system", "select status from public.student_invoices where id = $1", [
        invoiceId,
      ]);
      expect(row.status).toBe("paid");
    }));

  it("blocks office and teachers from recording a cash payment", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const officeId = await createUser(tx, f.schoolId, "office");
      const invoiceId = await createInvoiceDirect(tx, { ...f, studentId: f.students1A[0] });

      for (const actor of [officeId, f.teacherId]) {
        const error = await tx.fails(actor, "select * from public.record_cash_payment($1, $2, $3)", [invoiceId, 100, ""]);
        expect(error.code).toBe("42501");
      }
    }));

  it("blocks recording a payment against another school's invoice", () =>
    withTx(async (tx) => {
      const a = await createSchool(tx);
      const b = await createSchool(tx);
      const invoiceId = await createInvoiceDirect(tx, { ...a, studentId: a.students1A[0] });
      const error = await tx.fails(b.adminId, "select * from public.record_cash_payment($1, $2, $3)", [invoiceId, 100, ""]);
      expect(error.code).toBe("P0002");
    }));

  // -------------------------------------------------------------------------
  // reverse_payment -- the append-only design: the original row is never
  // touched, only a new negative-amount row is written.
  // -------------------------------------------------------------------------

  it("reverses a payment without ever touching the original row", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const invoiceId = await createInvoiceDirect(tx, { ...f, studentId: f.students1A[0] }, "Term 1", 1000);
      const paymentId = await insertCashPayment(tx, { ...f, invoiceId, receivedBy: f.adminId }, 400);

      const [reversal] = await tx.query<{ amount: string; status: string; reversed_payment_id: string }>(
        f.adminId,
        "select * from public.reverse_payment($1, $2)",
        [paymentId, "recorded twice by mistake"],
      );
      expect(reversal.amount).toBe("-400.00");
      expect(reversal.status).toBe("reversed");
      expect(reversal.reversed_payment_id).toBe(paymentId);

      const [original] = await tx.query<{ amount: string; status: string }>(
        "system",
        "select amount, status from public.fee_payments where id = $1",
        [paymentId],
      );
      expect(original.amount).toBe("400.00");
      expect(original.status).toBe("completed");

      const [invoice] = await tx.query<{ status: string }>(
        "system",
        "select status from public.student_invoices where id = $1",
        [invoiceId],
      );
      expect(invoice.status).toBe("unpaid");
    }));

  it("blocks reversing a payment that was already reversed", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const invoiceId = await createInvoiceDirect(tx, { ...f, studentId: f.students1A[0] });
      const paymentId = await insertCashPayment(tx, { ...f, invoiceId, receivedBy: f.adminId }, 400);
      await tx.query(f.adminId, "select * from public.reverse_payment($1, $2)", [paymentId, "mistake"]);

      const error = await tx.fails(f.adminId, "select * from public.reverse_payment($1, $2)", [paymentId, "again"]);
      expect(error.code).toBe("55000");
      expect(error.message).toMatch(/already been reversed/i);
    }));

  it("blocks reversing a reversal entry itself", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const invoiceId = await createInvoiceDirect(tx, { ...f, studentId: f.students1A[0] });
      const paymentId = await insertCashPayment(tx, { ...f, invoiceId, receivedBy: f.adminId }, 400);
      const [reversal] = await tx.query<{ id: string }>(f.adminId, "select * from public.reverse_payment($1, $2)", [
        paymentId,
        "mistake",
      ]);

      const error = await tx.fails(f.adminId, "select * from public.reverse_payment($1, $2)", [reversal.id, "undo the undo"]);
      expect(error.code).toBe("55000");
    }));

  it("reverses an online-method payment without violating the gateway check constraint", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const invoiceId = await createInvoiceDirect(tx, { ...f, studentId: f.students1A[0] }, "Term 1", 1000);
      const paymentId = await insertOnlinePayment(tx, { ...f, invoiceId, recordedVia: f.adminId }, 400);

      const [reversal] = await tx.query<{ amount: string; method: string; gateway: string; gateway_payment_id: string | null }>(
        f.adminId,
        "select * from public.reverse_payment($1, $2)",
        [paymentId, "gateway refund issued"],
      );
      expect(reversal.amount).toBe("-400.00");
      expect(reversal.method).toBe("online");
      expect(reversal.gateway).toBe("test-gateway");
      expect(reversal.gateway_payment_id).toBeNull();
    }));

  // -------------------------------------------------------------------------
  // Select scoping: admin school-wide, a guardian only their own child's
  // invoice/items/payments, office and teachers see none of it.
  // -------------------------------------------------------------------------

  it("scopes student_invoices/invoice_items/fee_payments to admin and the invoice's own guardian", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const officeId = await createUser(tx, f.schoolId, "office");
      const headId = await insertFeeHead(tx, f.schoolId);
      const invoiceId = await createInvoiceDirect(tx, { ...f, studentId: f.students1A[0] });
      await tx.query("system", "insert into public.invoice_items (invoice_id, fee_head_id, amount) values ($1, $2, $3)", [
        invoiceId,
        headId,
        1000,
      ]);
      await insertCashPayment(tx, { ...f, invoiceId, receivedBy: f.adminId }, 400);

      const ownGuardian = await createGuardian(tx, f.schoolId, [f.students1A[0]]);
      const otherGuardian = await createGuardian(tx, f.schoolId, [f.students1B[0]]);

      for (const actor of [f.adminId, ownGuardian]) {
        expect(await tx.query(actor, "select id from public.student_invoices where id = $1", [invoiceId])).toHaveLength(1);
        expect(await tx.query(actor, "select * from public.invoice_items where invoice_id = $1", [invoiceId])).toHaveLength(
          1,
        );
        expect(await tx.query(actor, "select id from public.fee_payments where invoice_id = $1", [invoiceId])).toHaveLength(
          1,
        );
      }

      for (const actor of [officeId, f.teacherId, otherGuardian]) {
        expect(await tx.query(actor, "select id from public.student_invoices where id = $1", [invoiceId])).toHaveLength(0);
        expect(await tx.query(actor, "select * from public.invoice_items where invoice_id = $1", [invoiceId])).toHaveLength(
          0,
        );
        expect(await tx.query(actor, "select id from public.fee_payments where invoice_id = $1", [invoiceId])).toHaveLength(
          0,
        );
      }
    }));

  it("scopes fee_heads to admin's own school plus a guardian's own children's invoices only", () =>
    withTx(async (tx) => {
      const a = await createSchool(tx);
      const b = await createSchool(tx);
      const headA = await insertFeeHead(tx, a.schoolId, "Tuition A");
      await insertFeeHead(tx, b.schoolId, "Tuition B");
      const invoiceId = await createInvoiceDirect(tx, { ...a, studentId: a.students1A[0] });
      await tx.query("system", "insert into public.invoice_items (invoice_id, fee_head_id, amount) values ($1, $2, $3)", [
        invoiceId,
        headA,
        1000,
      ]);
      const guardianOfInvoicedChild = await createGuardian(tx, a.schoolId, [a.students1A[0]]);
      const unrelatedGuardian = await createGuardian(tx, a.schoolId, [a.students1B[0]]);

      expect(await tx.query(a.adminId, "select id from public.fee_heads")).toHaveLength(1);
      expect(await tx.query(b.adminId, "select id from public.fee_heads")).toHaveLength(1);
      expect(await tx.query(guardianOfInvoicedChild, "select id from public.fee_heads")).toHaveLength(1);
      expect(await tx.query(unrelatedGuardian, "select id from public.fee_heads")).toHaveLength(0);
    }));

  // -------------------------------------------------------------------------
  // fee_heads / fee_structures: admin-managed config via direct RLS writes
  // (not a security-definer function) -- see the 20261120000200 migration.
  // -------------------------------------------------------------------------

  it("lets an admin manage fee_heads directly, but not across schools or as office", () =>
    withTx(async (tx) => {
      const a = await createSchool(tx);
      const b = await createSchool(tx);
      const officeId = await createUser(tx, a.schoolId, "office");

      const [created] = await tx.query<{ id: string }>(
        a.adminId,
        "insert into public.fee_heads (school_id, name) values ($1, $2) returning id",
        [a.schoolId, "Tuition"],
      );

      await tx.query(a.adminId, "update public.fee_heads set name = $1 where id = $2", ["Tuition Fee", created.id]);
      const [renamed] = await tx.query<{ name: string }>("system", "select name from public.fee_heads where id = $1", [
        created.id,
      ]);
      expect(renamed.name).toBe("Tuition Fee");

      const crossSchoolInsert = await tx.fails(
        b.adminId,
        "insert into public.fee_heads (school_id, name) values ($1, $2)",
        [a.schoolId, "Sneaky"],
      );
      expect(crossSchoolInsert.code).toBe("42501");

      const officeInsert = await tx.fails(officeId, "insert into public.fee_heads (school_id, name) values ($1, $2)", [
        a.schoolId,
        "Office attempt",
      ]);
      expect(officeInsert.code).toBe("42501");

      await tx.query(a.adminId, "delete from public.fee_heads where id = $1", [created.id]);
      expect(await tx.query("system", "select id from public.fee_heads where id = $1", [created.id])).toHaveLength(0);
    }));

  it("ties fee_structures.fee_head_id to its real school via a composite FK", () =>
    withTx(async (tx) => {
      const a = await createSchool(tx);
      const b = await createSchool(tx);
      const headB = await insertFeeHead(tx, b.schoolId);

      // RLS alone would allow this (school_id = a's own school, admin of a)
      // -- the composite FK is what must catch it, since headB really
      // belongs to school b. Same lesson as homework_section_school_fk.
      const error = await tx.fails(
        a.adminId,
        "insert into public.fee_structures (school_id, academic_year_id, class_id, fee_head_id, amount) values ($1, $2, $3, $4, $5)",
        [a.schoolId, a.yearId, a.class1Id, headB, 500],
      );
      expect(["42501", "23503"]).toContain(error.code);
    }));
});
