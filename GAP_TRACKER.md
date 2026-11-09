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

### ~~OPEN-1~~ — CLOSED. The logout-on-refresh fix shipped in commit 838d350
(`refreshSession()` replacing the state-wiping `initializeSession()` on the
Receive screen). Confirmed present at HEAD; only Yellow Card WIP remains in the
working tree for that file.

### OPEN-2 — Partially verified; remainder needs real funds/cards (HIGH)
- Route existence confirmed live: `GET /api/cards/:cardId/transactions` returns
  401-unauthenticated (route registered behind auth), as do the approvals routes.
- Still needs: card freeze/top-up/transactions against a real issued Brails
  card (provider payload mapping is best-effort), and a kamino lock with a real
  PIN + small amount (confirm term_vaults row, on-chain shares, summary refresh).
Any provider-shape surprises → fix the mapping, add regression tests.

### ~~OPEN-3~~ — CLOSED. The vault screen now has a "Your Locks" section:
live positions from `GET /api/kamino/positions/:entityId` (status, days
remaining, current value + net APY), and matured locks get a Withdraw CTA
that prompts for the transaction PIN and calls `POST /api/kamino/withdraw`.
Honest empty and error states; widget-tested. Note: backend rejects early
withdrawals by design — only MATURED locks show the CTA.

### ~~OPEN-4~~ — CLOSED (removed). The Flexible chip is gone from the vault
lock options — only 30/90/365-day locks are offered, matching what the backend
can actually fulfil. If flexible deposits become a product priority, design the
backend flow first, then re-add the chip.

### OPEN-5 — Wiring complete; needs credentials to enable (MEDIUM)
podsRoutes/ondoRoutes are now registered unconditionally and self-gate: with
the flags off they return a clean 503 "disabled" (no more bare 404s), and the
invest repository maps 404+503 to honest empty states. Enabling is now a pure
env flip on Render: `ENABLE_ONDO_FINANCE=true` (+ `ONDO_API_KEY` and the
relayer credentials) or `ENABLE_PODS_FINANCE=true` (+ `PODS_API_KEY`,
`PODS_BASE_URL`). After flipping: verify quotes/positions/buy/sell live, then
revisit the 503-as-empty mapping if the product should surface the error
state differently.

### ~~OPEN-6~~ — CLOSED (re-added). Payroll has an "Import CSV" button next to
"Add Employee" — a paste-based dialog (`name, account, bank code, amount` per
line, header row tolerated, bad rows skipped with a count report). Covered by
the 'Payroll CSV import adds recipients to the queue' widget test.

### OPEN-7 — Precomputed treasury metrics (LOW)
Burn rate / runway / 30D inflow are derived client-side from history (now
ISO-timestamped, limit honored up to 500). A backend `/api/treasury/metrics`
would make them exact and cheaper. Nice-to-have, not blocking.

### ~~OPEN-8~~ — CLOSED. The other three apps swept with the same batches:
- **mobile-web**: endpoint cross-check found `/api/transfers/internal-convert`
  had no backend route — BUILT IT: server-side priced conversion (live FX,
  balance check, ledger double-entry, ownership check) + extracted a shared
  `getFxRateRows()` used by /api/fx/rates too. Demo-login fake-session
  fallback (fabricated 'demo-user-1' on any backend failure) removed — errors
  surface honestly now.
- **website**: all API calls matched backend routes; remaining 'Acme' hits are
  marketing-page sample visuals and documentation code examples — acceptable.
- **telegram-bot**: backend calls matched (link/confirm exists); no gaps.
Note: the same convert endpoint is available to the Flutter swap screen if it
should move off fx-quote+execute for pure conversions.

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
