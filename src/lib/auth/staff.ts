import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = "admin" | "teacher";

export interface Staff {
  id: string;
  schoolId: string;
  fullName: string;
  role: StaffRole;
}

type StaffLookup = { status: "signed-out" } | { status: "inactive" } | { status: "active"; staff: Staff };

// Cached per request so layouts, pages and actions share one lookup.
const lookupStaff = cache(async (): Promise<StaffLookup> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "signed-out" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, school_id, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return { status: "inactive" };

  return {
    status: "active",
    staff: { id: profile.id, schoolId: profile.school_id, fullName: profile.full_name, role: profile.role },
  };
});

/** The signed-in, active staff member, or null. */
export async function getStaff(): Promise<Staff | null> {
  const result = await lookupStaff();
  return result.status === "active" ? result.staff : null;
}

/**
 * Use at the top of every protected page and server action. Signed-out users go
 * to the login page; users whose account is disabled (or has no profile) are
 * signed out so their session cannot be reused.
 */
export async function requireStaff(): Promise<Staff> {
  const result = await lookupStaff();
  if (result.status === "signed-out") redirect("/login");
  if (result.status === "inactive") redirect("/auth/signout?reason=inactive");
  return result.staff;
}

/** Admin-only pages. Teachers get a 404 rather than a hint that the page exists. */
export async function requireAdmin(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== "admin") notFound();
  return staff;
}
