# PayIT App — Gap Tracker

Living document. Every gap found during sweeps is logged here with its status.
Update statuses as items close; add new findings at the bottom of the open list.

**Branch discipline:** backend changes → `feat/proxim-due-turnkey` ONLY (Render
auto-deploys it). Flutter/app changes → `main` + merge to `feat/proxim-due-turnkey`.
Never push backend-only work to `main`.

**Verification gates before marking anything done:** `flutter analyze` clean,
`flutter test` all green, backend `tsc --noEmit` clean, and live verification
against https://payit-backend-td53.onrender.com where the change is user-visible.

---

## Closed (full app sweep — Nov 2025)

| # | Gap | Fix | Verified |
|---|-----|-----|----------|
| 1 | Cards freeze/unfreeze called non-existent path routes (`/api/cards/:id/freeze`) | Client now uses body-based `POST /api/cards/freeze`, checks success | analyze/tests green; live pending deploy |
| 2 | Card top-up same path-route mismatch | `POST /api/cards/top-up` with cardId in body, success check | analyze/tests green; live pending deploy |
| 3 | Card transactions had no backend route at all | Added `GET /api/cards/:cardId/transactions` (ownership + Brails provider) | tsc green; live pending deploy + needs real-card check |
| 4 | Vault deposit/withdraw hit non-existent `/api/savings/*` (fake flow) | Rewired to `/api/kamino/lock` + `/api/kamino/withdraw`; PIN via new `TransactionPinSheet`; amount input; Flexible locks blocked honestly | analyze/tests green; live pending deploy |
| 5 | `notificationService.ts` implicit-`any` — would fail Render build | Typed senviok callbacks; rebuilt stale `@payit/db` + `@payit/integrations` dist | tsc green |
| 6 | Invoice builder prefilled fake client/amount and showed fake success with fabricated invoice number | Real validation (name/email/amount), errors on failure, no fabricated defaults | analyze/tests/web build green |
| 7 | Payroll seeded 3 demo recipients (Sarah Jenkins / David Miller / Elena Rostova) | Queue starts empty; Add Employee remains | analyze/tests green |
| 8 | Checkout route fell back to fabricated `INV-2026-095` | No fallback; empty id fails honestly | analyze/tests green |
| 9 | Widget tests hit prod backend → 401 → logout (config default flipped to prod URL) | Tests hermetic via `FakeApiClient` override | 46/46 |
| 10 | `initializeSession()` logged users out on transient restore failure; Receive screen called it | New `refreshSession()` never logs out; Receive uses it | ⚠ code in working tree, see OPEN-1 |

---

## Open

### OPEN-1 — Ship the logout-on-refresh fix (HIGH)
The `refreshSession()` fix for the Receive screen (`receive_deposit_screen.dart`)
sits **uncommitted in the working tree**, mixed into the active Yellow Card WIP.
Coordinate with whoever owns that branch of work and commit it with the Yellow
Card changes — do not let it rot: it fixes a real production logout bug.
Owner: whoever is building Yellow Card. Status: blocked on WIP coordination.

### OPEN-2 — Verify new card + savings flows live (HIGH, after next deploy)
- Card freeze/top-up/transactions against a real issued Brails card
  (transactions route is new; provider payload mapping is best-effort).
- Kamino lock with a real 6-digit PIN and a small real amount; confirm
  `term_vaults` row, on-chain shares, and summary refresh.
Any provider-shape surprises → fix the mapping, add regression tests.

### OPEN-3 — Vault withdrawal UI (MEDIUM)
Backend `POST /api/kamino/withdraw` exists and the repo method is wired, but no
screen flow calls it. Build a "Your positions / matured locks" section with
withdraw CTA + PIN prompt, or deliberately defer and hide the repo method.

### OPEN-4 — Flexible (no-lock) savings deposits (MEDIUM)
Backend only supports 30/60/90/365-day locks. UI currently blocks Flexible with
an honest message. Decide: build flexible deposits (different product shape —
needs backend design) or remove the Flexible chip so users can't select
something that can never work.

### OPEN-5 — Ondo/Pods investing enabled (MEDIUM, needs credentials)
Routes exist behind `ENABLE_ONDO_FINANCE` / `ENABLE_PODS_FINANCE` (off in prod;
app shows honest empty state). When business-ready: set env vars on Render,
whitelist origins if needed, then remove the 404-as-empty handling in the
invest repository and verify live quotes/positions/buy/sell.

### OPEN-6 — Payroll CSV import (LOW — verify)
The old "Upload CSV" affordance was replaced by "Add Employee" in the Oct 10
redesign. Confirm CSV bulk import is intentionally gone (or re-add it) before
launch marketing mentions it.

### OPEN-7 — Precomputed treasury metrics (LOW)
Burn rate / runway / 30D inflow are derived client-side from history (now
ISO-timestamped, limit honored up to 500). A backend `/api/treasury/metrics`
would make them exact and cheaper. Nice-to-have, not blocking.

### OPEN-8 — Website/mobile-web/telegram-bot parity (LOW)
This sweep covered `apps/mobile_flutter` + `apps/backend`. The other three apps
have not had the same endpoint cross-check / fake-data sweep. Run the same
batches against them (endpoint cross-check → demo-data grep → scoping) before
calling the platform gap-free.

---

## Sweep method (rerun after any big merge)

1. **Endpoint cross-check:** extract every `/api/...` path the app calls; diff
   against `server.(get|post|put|delete)` registrations in `apps/backend/src`;
   classify flag-gated routes separately from true gaps.
2. **Demo-data grep:** search `lib/src` for known fake signatures (names,
   amounts, invoice numbers) and confirm each hit sits behind `isDemoMode`.
3. **Entity scoping:** every entity-scoped backend route must receive
   `entityId` from the client; every client repository must send it.
4. **Fake-success audit:** every execution flow must read a success flag /
   returned record from the backend before showing success UI.
5. Run the four gates at the top, then live-verify in Chrome via CDP against
   the deployed backend (persistent profile at `localhost:8083` harness).
