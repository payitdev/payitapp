# Full App Integration Plan — Zero Dummy Data

Goal: every screen in the Flutter app (`apps/mobile_flutter`) renders real backend
data. No hardcoded values visible in production, no fake success on failure.

## Definition of done (applies to every screen)

1. No hardcoded values outside `ApiConfig.isDemoMode` gates. Existing demo
   fallbacks in repositories may stay, but only execute in `DEMO_MODE=true` builds.
2. Every async screen has explicit loading / error / empty states — never renders
   data-shaped content while loading or on error.
3. Errors surface to the user. Never report success when the API call failed.
4. `DEMO_MODE` remains available as a demo environment; production never uses it.

## Audit summary (2026-09-26)

- Backend (`apps/backend`): ~90% of needed endpoints already exist and are real.
  Stubs/removed: `/api/invoices/public/:id/pay` (409 by design), KYC tier1/tier2
  submit, `/api/transfers/dynamic-pay-in`. Fabrications: transfer-status UETR,
  `/api/savings/three-tiers`, payroll fake employees, `/api/fx/rates` fallback.
  Feature-flagged off unless env set: `ENABLE_LIVE_FINANCE`, `ENABLE_ONDO_FINANCE`,
  `ENABLE_PODS_FINANCE`.
- Flutter: repositories for transfers, cards, vault, invest, invoices, developer,
  treasury are real. Worst violations are in the presentation layer: fake success
  handlers, dead providers (`fxQuoteProvider`, `apiKeysProvider`, invoice list),
  hardcoded identity strings, and fully fake screens (payroll, multi-sig,
  payment hub, public invoice checkout).

## Phase 1 — Correctness bugs (fake success + identity)

| Fix | File |
|---|---|
| Remove fake-success on API failure; surface real errors | `send_payout_screen.dart:96`, `swap_convert_screen.dart:96` |
| Sign out must actually log out (currently a SnackBar; session survives) | `profile_screen.dart:393` |
| Remove fake name/email/KYB fallbacks; `kybTier` from entity data | `home_screen.dart:38`, `profile_screen.dart:79`, `auth_models.dart:102` |
| KYC banner driven by real `GET /api/kyc/status` | `kyc_banner.dart` (+ new kyc repository) |
| Remove `1595.20` FX fallback in `FxQuote.fromJson`; wire `fxQuoteProvider` into swap; delete hardcoded rate/balances/counterparty in send & swap | transfers feature |
| Receive screen: real `evmDepositAddress`, bank accounts via `GET /api/transfers/accounts`, real QR | `receive_deposit_screen.dart` |

## Phase 2 — Wire the dead plumbing (endpoints + repos already exist)

- **Cards**: real loading state (not demo card), PAN from card object, wire
  top-up sheet to existing endpoint.
- **Developer console**: consume `apiKeysProvider`; real entity ID (not
  `ent_demo_business_01`); wire webhooks/deliveries/logs or cut fake rows.
- **Invoices**: consume `GET /api/invoices` (list + metrics from real data);
  client picker instead of hardcoded Acme Corp; public checkout fetches
  `GET /api/invoices/public/:id`.
- **Vault**: APYs/lock options from `/api/savings/summary` + `/api/kamino/yield-options`;
  "Save now" calls real deposit; un-hide strategy error state.
- **Invest**: market-open badge from `/api/ondo/market-status/:symbol`.
- **Home**: savings APY teaser from real savings summary.
- **Treasury dashboard & balance sheet**: proper `.when` handling; delete
  `?? 482950.00` fallbacks, fake burn rate, fake dispatches, fake multi-sig alert.

## Phase 3 — Backend gaps

| Screen | Work |
|---|---|
| Payroll | Client wiring to `GET /api/payroll` / `POST /api/payroll/run`; backend must stop fabricating "Employee 1..n" and stop marking runs completed on item failures |
| Payment request hub | Client wiring to `/api/payments/requests`, `/fulfill`, `/decline` |
| Multi-sig approvals | **Decision needed**: build approvals model + endpoints, or hide screen until post-launch |
| Invoice public payment | Client redirects payer to Brails collection link (`POST /api/invoices/generate-collection-link`); settle via webhook |
| Transfer status | Backend: store real provider refs instead of fabricated UETR (`transfers.ts:1662`) |

## Phase 4 — Production flags

Set on Render (payit-backend): `ENABLE_LIVE_FINANCE`, `ENABLE_ONDO_FINANCE`,
`ENABLE_PODS_FINANCE` — otherwise `/api/ondo/*` and `/api/pods/*` return 503
demo-mode stubs and Invest/Vault can never show live data.

## Phase 5 — Verification

- Per-screen checklist with a real account: loading → real data → error state
  (kill backend locally to verify error UI).
- `grep -rn "482950\|Acme Global\|Alex Rivera\|1595.20" lib/ --include=*.dart`
  returns only `isDemoMode`-gated code.
- Puppeteer E2E (harness from login test): auth + one transfer + one invoice.
