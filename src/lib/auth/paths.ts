export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/students",
  "/attendance",
  "/reports",
  "/staff",
  "/settings",
  "/homework",
  // Pre-existing gap found while fixing the one above: /parents (Phase 2's
  // admin guardians screen) was never added here either, so it's relied
  // entirely on requireAdmin()'s own redirect rather than the middleware's
  // edge-level one. Not a security hole (same reasoning as the file's top
  // comment), but the same class of bug -- fixed alongside it.
  "/parents",
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Where to send a user after login. Only same-site paths inside the staff app
 * are allowed, so a crafted ?next= link cannot redirect to another website.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/dashboard";
  }
  const pathname = next.split(/[?#]/)[0];
  return isProtectedPath(pathname) ? next : "/dashboard";
}

// Parent portal (Phase 3). Deliberately a separate list, not folded into
// PROTECTED_PREFIXES above -- a signed-out visitor on a parent path must land
// on /parent/login, not the staff /login page, and vice versa.
export const PARENT_PROTECTED_PREFIXES = ["/parent/dashboard", "/parent/notices", "/parent/homework"];

export function isParentProtectedPath(pathname: string): boolean {
  return PARENT_PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Mirrors safeNextPath for the parent portal. */
export function safeParentNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/parent/dashboard";
  }
  const pathname = next.split(/[?#]/)[0];
  return isParentProtectedPath(pathname) ? next : "/parent/dashboard";
}
