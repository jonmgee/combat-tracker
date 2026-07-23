# Torch & Turn — project context

Combat/encounter tracker for D&D 5e. Live at **torchandturn.com** (Vercel
project `combat-tracker`, auto-deploys `main`). Supabase project
`rtiklwyvnlfcgsefctut` — production and preview deploys share this one
database. No user accounts: sessions are anonymous, joined by two-word room
codes, so RLS is deliberately open per-table (see `supabase/migration-013` for
the push-subscription lockdown that is the exception).

## Hard rules (each of these has caused a real failure when skipped)

- **Never push without a passing local build** (`npm run build` — it runs the
  real `tsc -b` typecheck first).
- **Deploy verification**: production must serve the bundle filename matching
  the local build output. Bundle hashes are content-based and identical
  between local and Vercel — production serving an older filename means the
  deploy hasn't landed. Poll until it matches or report it as not yet live;
  never report "deployed" on the old filename.
- **Reverts**: pick revert targets from the Vercel dashboard (last green
  build), never from memory. When re-applying reverted work, re-apply ALL
  files — a partial re-apply once shipped TSX without its CSS.
- **React hooks above any conditional return** (caused a #310 crash in prod).
- **Element visibility via stylesheet only** — no inline `display` styles.
- Judge all visual work at iPhone size (375px) first, iPad second; desktop
  barely matters.
