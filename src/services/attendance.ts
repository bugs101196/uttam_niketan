import "server-only";
import { countStatuses, isFinalStatus, type AttendanceStatus, type StatusCounts } from "@/lib/attendance";
import type { Staff } from "@/lib/auth/staff";
import { SCHOOL_TIMEZONE } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { listSectionOptions, type SectionOption } from "./students";

// Everything here reads through the signed-in user's client, so RLS limits
// teachers to their assigned sections. Attendance is written only by the
// database functions called from the server actions.

export type SessionStatus = Database["public"]["Enums"]["attendance_session_status"];

export async function getSchoolTimezone(staff: Staff): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("schools").select("timezone").eq("id", staff.schoolId).maybeSingle();
  return data?.timezone ?? SCHOOL_TIMEZONE;
}

function byRollThenName(a: { rollNo: number | null; name: string }, b: { rollNo: number | null; name: string }) {
  if (a.rollNo !== b.rollNo) return (a.rollNo ?? Number.MAX_SAFE_INTEGER) - (b.rollNo ?? Number.MAX_SAFE_INTEGER);
  return a.name.localeCompare(b.name);
}

// ---------------------------------------------------------------------------
// One day across sections
// ---------------------------------------------------------------------------

export interface DaySection extends SectionOption {
  activeStudents: number;
  session: { id: string; status: SessionStatus; counts: StatusCounts } | null;
}

export async function listDaySections(staff: Staff, date: string): Promise<DaySection[]> {
  const sections = await listSectionOptions(staff);
  if (sections.length === 0) return [];
  const ids = sections.map((s) => s.id);
  const supabase = await createClient();

  const [{ data: sessions, error }, { data: students, error: studentsError }] = await Promise.all([
    supabase
      .from("attendance_sessions")
      .select("id, section_id, status, attendance_records(status)")
      .eq("attendance_date", date)
      .in("section_id", ids),
    supabase.from("students").select("section_id").eq("enrollment_status", "active").in("section_id", ids),
  ]);
  if (error) throw error;
  if (studentsError) throw studentsError;

  return sections.map((section) => {
    const session = sessions.find((s) => s.section_id === section.id);
    return {
      ...section,
      activeStudents: students.filter((s) => s.section_id === section.id).length,
      session: session
        ? {
            id: session.id,
            status: session.status,
            counts: countStatuses(session.attendance_records.map((r) => r.status)),
          }
        : null,
    };
  });
}

// ---------------------------------------------------------------------------
// A single session with its roster
// ---------------------------------------------------------------------------

export interface RosterRow {
  studentId: string;
  name: string;
  rollNo: number | null;
  admissionNo: string | null;
  status: AttendanceStatus | null;
}

export interface SessionDetail {
  id: string;
  sectionId: string;
  sectionLabel: string;
  date: string;
  status: SessionStatus;
  submittedAt: string | null;
  lockedAt: string | null;
  roster: RosterRow[];
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  const supabase = await createClient();
  const { data: session, error } = await supabase
    .from("attendance_sessions")
    .select(
      "id, section_id, attendance_date, status, submitted_at, locked_at, sections!inner(name, classes!inner(name)), attendance_records(student_id, status)",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!session) return null;

  const recorded = new Map(session.attendance_records.map((r) => [r.student_id, r.status]));
  let roster: RosterRow[];

  if (session.status === "draft") {
    // A draft covers the section's current active roster.
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id, full_name, roll_no, admission_no")
      .eq("section_id", session.section_id)
      .eq("enrollment_status", "active");
    if (studentsError) throw studentsError;
    roster = students.map((s) => ({
      studentId: s.id,
      name: s.full_name,
      rollNo: s.roll_no,
      admissionNo: s.admission_no,
      status: recorded.get(s.id) ?? null,
    }));
  } else {
    // A submitted day is exactly what was saved, even if students have since moved.
    const ids = [...recorded.keys()];
    const { data: students, error: studentsError } = ids.length
      ? await supabase.from("students").select("id, full_name, roll_no, admission_no").in("id", ids)
      : { data: [], error: null };
    if (studentsError) throw studentsError;
    const info = new Map(students.map((s) => [s.id, s]));
    roster = ids.map((id) => {
      const s = info.get(id);
      return {
        studentId: id,
        // Visible to admins always; teachers lose sight of students who left their section.
        name: s?.full_name ?? "Student no longer in your sections",
        rollNo: s?.roll_no ?? null,
        admissionNo: s?.admission_no ?? null,
        status: recorded.get(id) ?? null,
      };
    });
  }

  return {
    id: session.id,
    sectionId: session.section_id,
    sectionLabel: `${session.sections.classes.name} – ${session.sections.name}`,
    date: session.attendance_date,
    status: session.status,
    submittedAt: session.submitted_at,
    lockedAt: session.locked_at,
    roster: roster.sort(byRollThenName),
  };
}

export interface HistoryEntry {
  at: string;
  action: string;
  actor: string;
  details: Record<string, unknown>;
}

/** Submission, corrections and lock for a session. Admins only (RLS on audit_logs). */
export async function getSessionHistory(sessionId: string): Promise<HistoryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("created_at, action, details, actor_id, profiles(full_name)")
    .or(`entity_id.eq.${sessionId},details->>session_id.eq.${sessionId}`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((row) => ({
    at: row.created_at,
    action: row.action,
    actor: row.profiles?.full_name ?? "Staff member",
    details: (row.details ?? {}) as Record<string, unknown>,
  }));
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface MonthlyRow {
  studentId: string;
  name: string;
  rollNo: number | null;
  counts: StatusCounts;
}

/**
 * Per-student totals for one section and month, from submitted and locked
 * sessions only. Days still in draft are reported separately, never as absences.
 */
export async function getMonthlyReport(sectionId: string, from: string, to: string) {
  const supabase = await createClient();
  const { data: sessions, error } = await supabase
    .from("attendance_sessions")
    .select("id, attendance_date, status, attendance_records(student_id, status)")
    .eq("section_id", sectionId)
    .gte("attendance_date", from)
    .lte("attendance_date", to)
    .order("attendance_date");
  if (error) throw error;

  const finalSessions = sessions.filter((s) => isFinalStatus(s.status));
  const draftDates = sessions.filter((s) => !isFinalStatus(s.status)).map((s) => s.attendance_date);

  const perStudent = new Map<string, AttendanceStatus[]>();
  for (const session of finalSessions) {
    for (const r of session.attendance_records) {
      const list = perStudent.get(r.student_id) ?? [];
      list.push(r.status);
      perStudent.set(r.student_id, list);
    }
  }

  // Include current active students with no records yet, so nobody is silently missing.
  const { data: active } = await supabase
    .from("students")
    .select("id")
    .eq("section_id", sectionId)
    .eq("enrollment_status", "active");
  for (const s of active ?? []) if (!perStudent.has(s.id)) perStudent.set(s.id, []);

  const ids = [...perStudent.keys()];
  const { data: students, error: studentsError } = ids.length
    ? await supabase.from("students").select("id, full_name, roll_no").in("id", ids)
    : { data: [], error: null };
  if (studentsError) throw studentsError;
  const info = new Map(students.map((s) => [s.id, s]));

  const rows: MonthlyRow[] = ids
    .map((id) => ({
      studentId: id,
      name: info.get(id)?.full_name ?? "Student no longer in your sections",
      rollNo: info.get(id)?.roll_no ?? null,
      counts: countStatuses(perStudent.get(id) ?? []),
    }))
    .sort(byRollThenName);

  return { rows, daysTaken: finalSessions.length, draftDates };
}

export interface StudentHistoryEntry {
  date: string;
  status: AttendanceStatus;
}

/** A student's recorded attendance on submitted days, newest first. */
export async function getStudentHistory(studentId: string, from: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_records")
    .select("status, attendance_sessions!inner(attendance_date, status)")
    .eq("student_id", studentId)
    .gte("attendance_sessions.attendance_date", from)
    .in("attendance_sessions.status", ["submitted", "locked"]);
  if (error) throw error;
  const entries: StudentHistoryEntry[] = data
    .map((r) => ({ date: r.attendance_sessions.attendance_date, status: r.status }))
    .sort((a, b) => b.date.localeCompare(a.date));
  return { entries, counts: countStatuses(entries.map((e) => e.status)) };
}
