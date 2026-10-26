import type { Metadata } from "next";
import { Button } from "@/components/ui/form";
import { requireAdmin } from "@/lib/auth/staff";
import { listStaff } from "@/services/staff";
import { listSectionOptions } from "@/services/students";
import { removeAssignment, setStaffActive } from "./actions";
import { AddStaffForm, AssignSectionForm, ResetPasswordForm } from "./forms";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const admin = await requireAdmin();
  const [staff, sections] = await Promise.all([listStaff(admin), listSectionOptions(admin)]);
  const activeTeachers = staff.filter((s) => s.role === "teacher" && s.isActive);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Staff</h1>
        <p className="text-muted">Accounts, access and class assignments</p>
      </div>

      <section aria-labelledby="add-staff" className="rounded-xl border border-border bg-surface p-5">
        <h2 id="add-staff" className="mb-4 text-lg font-bold">
          Add a staff account
        </h2>
        <AddStaffForm />
      </section>

      <section aria-labelledby="assign" className="rounded-xl border border-border bg-surface p-5">
        <h2 id="assign" className="text-lg font-bold">
          Assign a teacher to a section
        </h2>
        <p className="mb-4 text-muted">Teachers can only see and take attendance for their assigned sections.</p>
        <AssignSectionForm teachers={activeTeachers.map((t) => ({ id: t.id, name: t.fullName }))} sections={sections} />
      </section>

      <section aria-labelledby="staff-list">
        <h2 id="staff-list" className="mb-3 text-lg font-bold">
          All staff ({staff.length})
        </h2>
        <ul className="space-y-3">
          {staff.map((member) => {
            const isSelf = member.id === admin.id;
            return (
              <li key={member.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {member.fullName} {isSelf ? <span className="text-sm font-normal text-muted">(you)</span> : null}
                    </p>
                    <p className="text-sm break-all text-muted">{member.email ?? "No email"}</p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <span className="rounded-full border border-border px-2.5 py-0.5 capitalize">{member.role}</span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 ${
                        member.isActive
                          ? "border-green-200 bg-green-50 text-green-800"
                          : "border-gray-200 bg-gray-100 text-gray-700"
                      }`}
                    >
                      {member.isActive ? "Active" : "Disabled"}
                    </span>
                  </div>
                </div>

                {member.role === "teacher" ? (
                  <div className="mt-3">
                    <p className="text-sm text-muted">Sections</p>
                    {member.assignments.length === 0 ? (
                      <p className="text-sm">None assigned</p>
                    ) : (
                      <ul className="mt-1 flex flex-wrap gap-2">
                        {member.assignments.map((a) => (
                          <li
                            key={a.id}
                            className="flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pr-1 pl-3 text-sm"
                          >
                            {a.sectionLabel}
                            <form action={removeAssignment.bind(null, a.id)}>
                              <button
                                type="submit"
                                aria-label={`Remove ${member.fullName} from ${a.sectionLabel}`}
                                className="flex size-8 items-center justify-center rounded-full hover:bg-white"
                              >
                                ✕
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}

                {!isSelf ? (
                  <div className="mt-4 flex flex-wrap items-start gap-3">
                    <form action={setStaffActive.bind(null, member.id, !member.isActive)}>
                      <Button type="submit" variant={member.isActive ? "danger" : "secondary"}>
                        {member.isActive ? "Disable account" : "Re-enable account"}
                      </Button>
                    </form>
                    {member.isActive ? <ResetPasswordForm profileId={member.id} name={member.fullName} /> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
