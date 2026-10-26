# Uttam Niketan — notes for Claude

Read `docs/PROJECT_ROADMAP.md` before planning or changing anything; it is the source of truth
for scope, priorities, the working method (Goal → Scope → Implementation → Security → Tests →
Acceptance → Follow-up) and the Definition of Done. Update its status tracker, progress log,
defect register and decision log when milestones change.

- Priority order: database integrity → auth/permissions → students → attendance → testing → WhatsApp.
- Never add scope silently; raise a change request (roadmap §24).
- Fictional data only. No secrets in code, docs or commits.
- Schema changes go in a new file in `supabase/migrations/`; never edit an applied migration.
- Security is enforced server-side and by RLS; UI checks are convenience only.
- Before committing: `npm run check` (needs PostgreSQL for `test:db`, see README).
