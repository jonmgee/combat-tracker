[Wed 2026-06-10 07:53 GMT+1] Verified — revert confirmed live, matched bundle filenames, good work on the directory catch.

State:

Mobile compact condition summary is live and working as of 216834d: single icon + +N badge at <=640px, bottom sheet (portal-rendered to #popover-root) with ordered condition list, descriptions, and working removal synced to Supabase.
Known open defect: compact icon overlaps Bloodied pillbox on mobile. Fix deferred to a mockup-first pass.
Slide-up animation for the sheet: approved as future polish, not yet built.

Hard rules (these caused the failures when skipped):

Never push without a passing local build (npm run build). Every build failure — TS6133, two JSX syntax breaks — would have been caught locally.
Deploy verification: production must serve the bundle filename matching your local build output. Bundle hashes are content-based — they do NOT vary between local and Vercel. Production serving the previous filename means the deploy hasn't landed; poll until it matches or report notyetlive. Never report deployed on the old filename.
The production domain is combat-tracker-one.vercel.app — not combat-tracker.vercel.app. All verification against this domain only.
Revert targets come from the Vercel dashboard (last green/Ready build), never from memory.
When re-applying reverted work, re-apply ALL files — the layout re-attempt shipped the TSX without the CSS because the revert had rolled back both.
React components: all hooks above any conditional return (the #310 crash).
Element visibility is controlled by stylesheet only — no inline display styles (the inline display:none bug).

Confirm the revert is live and verified, then stop and wait for me
