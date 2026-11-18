import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface Guardian {
  id: string;
  schoolId: string;
  fullName: string;
  preferredLanguage: "en" | "hi";
}

type GuardianLookup = { status: "signed-out" } | { status: "inactive" } | { status: "active"; guardian: Guardian };

// Cached per request, same reasoning as lib/auth/staff.ts's lookupStaff.
const lookupGuardian = cache(async (): Promise<GuardianLookup> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "signed-out" };

  const { data: guardian } = await supabase
    .from("guardians")
    .select("id, school_id, full_name, preferred_language, is_active")
    .eq("id", user.id)
    .maybeSingle();

  // No guardians row at all (e.g. a staff account, or a phone that somehow
  // authenticated without being provisioned by an admin first -- accounts
  // are never self-registered, see docs/ERP_ARCHITECTURE.md §18 Phase 3)
  // is treated the same as a disabled one: signed out, not given a session.
  if (!guardian || !guardian.is_active) return { status: "inactive" };

  return {
    status: "active",
    guardian: {
      id: guardian.id,
      schoolId: guardian.school_id,
      fullName: guardian.full_name,
      preferredLanguage: guardian.preferred_language,
    },
  };
});

/** The signed-in, active guardian, or null. */
export async function getGuardian(): Promise<Guardian | null> {
  const result = await lookupGuardian();
  return result.status === "active" ? result.guardian : null;
}

/** Use at the top of every protected parent-portal page and server action. */
export async function requireGuardian(): Promise<Guardian> {
  const result = await lookupGuardian();
  if (result.status === "signed-out") redirect("/parent/login");
  if (result.status === "inactive") redirect("/auth/signout-guardian?reason=inactive");
  return result.guardian;
}
