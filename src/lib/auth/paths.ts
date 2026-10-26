export const PROTECTED_PREFIXES = ["/dashboard", "/students", "/attendance", "/reports", "/staff", "/settings"];

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
