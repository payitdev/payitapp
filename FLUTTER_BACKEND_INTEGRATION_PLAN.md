# Flutter ↔ Backend Integration Plan

Date: 2026-09-14 · Scope: `apps/mobile_flutter` ↔ `apps/backend` (Fastify)

## Current state (verified)

**Partially integrated — "offline-first demo with a live API attempt."**

The app has a real networking layer (Dio, Riverpod, `lib/src/core/network/api_client.dart`)
with JWT auth interception and calls 10 real endpoints. But:

1. **Every repository method silently swallows connection errors and returns
   fabricated success data** — fake demo user, fake passcode (`123456`), fake
   `CLEARED` transfer receipts, fake FX rate (1595.20), fake balance sheet,
   fake API keys (`auth_repository.dart`, `transfers_repository.dart`,
   `treasury_repository.dart`, `developer_repository.dart` all follow the
   `try { ... } catch (e) { return <fake success>; }` pattern).
2. **Primary screens are hardcoded `static const` data with no repository at
   all**: home balance (`home_screen.dart:114`), activity feed, cards, invest,
   vault, receive-deposit, payroll, multi-sig approvals.
3. **Endpoint drift**: two Flutter paths don't exist on the backend
   (see mapping table below).
4. **Port mismatch**: client defaults to `http://localhost:3001`
   (`api_config.dart:9-23`); backend defaults to `4000` (`apps/backend/src/env.ts:11`),
   Render deploys with `PORT=10000` (`render.yaml:14-15`). Nothing lines up
   without manual `--dart-define`.
5. **No production base URL** is baked in anywhere; staging/prod hosts must be
   supplied via dart-define from `render.yaml` domains.
6. Backend has **no OpenAPI spec** and **no refresh-token flow** (Telegram JWTs
   expire in 1h, Privy/demo in 7d), so the client must handle expiry by
   re-authenticating.

## Backend surface the client should consume

Auth: `POST /api/auth/demo`, `POST /api/auth/telegram/mini-app`,
`POST /api/auth/passcode/verify`, `GET /api/auth/session`, `POST /api/auth/privy/login`.
Session context via `Authorization: Bearer <jwt>` + `x-entity-id` header
(`apps/backend/src/middleware/requireAuth.ts`).

Feature routes (all under `apps/backend/src/routes/`): transfers (`/execute`,
`/internal`, `/quote`, `/history`, `/balance`, `/fx-quote`, `/withdraw`,
`/:id/reverse`), cards, savings, pods/kamino vaults, ondo stocks, invoices,
payments, payroll, social, intents, developer keys/webhooks, reports
(`/api/reports/balance-sheet`), plus a structured `/v1` developer surface.

### Endpoint mapping — current client calls vs. backend

| Flutter call (repository) | Backend route | Status |
|---|---|---|
| `GET /api/auth/session` | `GET /api/auth/session` | ✅ matches |
| `POST /api/auth/demo` | `POST /api/auth/demo` | ✅ matches |
| `POST /api/auth/telegram/mini-app` | same | ✅ matches |
| `POST /api/auth/passcode/verify` | same | ✅ matches |
| `GET /api/transfers/fx-quote` | same (public) | ✅ matches |
| `POST /api/transfers/send` | `POST /api/transfers/execute` | ❌ path drift |
| `POST /api/transfers/internal-convert` | `POST /api/transfers/internal` | ❌ path drift |
| `GET /api/reports/balance-sheet` | same | ✅ matches |
| `GET/POST /api/invoices` | same | ✅ matches |
| `GET/POST /api/developer/keys` | same | ✅ matches |

## Plan

### Phase 0 — Contract alignment (backend truth, small)

1. Decide the canonical route names and fix the drift. Recommended: keep
   backend paths stable (they're used by web/telegram too) and change the two
   Flutter calls to `/api/transfers/execute` and `/api/transfers/internal`.
2. Align ports/document the runbook: either run local backend with
   `PORT=3001` (matches client default and `AGENTS.md`), or change the client
   default. Add a `melos`/script or Makefile target that boots backend +
   app together. Verify request/response field names against
   `packages/contracts/src/index.ts` schemas where they overlap; fix drift in
   the Dart models.
3. Produce a hand-maintained endpoint map (or add `@fastify/swagger` to the
   backend and generate one) so the client has a single source of truth.
   Code-gen from the zod contracts to Dart is optional follow-up.

### Phase 1 — Harden the networking layer (`lib/src/core/network/`)

4. **Remove silent fake-success fallbacks.** A failed call must surface a
   typed `ApiFailure` (already planned in `api_client.dart`) to the UI. Keep
   the demo/offline behavior only behind an explicit `DEMO_MODE` dart-define,
   never by default.
5. **401 handling**: interceptor catches 401 → clear `TokenStorage` → redirect
   to login via router redirect (Riverpod + go_router).
6. **Token expiry**: Telegram JWTs live 1h and there is no refresh endpoint —
   schedule a session check (`GET /api/auth/session`) on app resume and route
   to re-auth on failure. (Adding a refresh endpoint to the backend is an
   optional backend task.)
7. **Idempotency**: add the `Idempotency-Key` header on POSTs per backend
   enforcement (already documented in `AGENTS.md`, not yet implemented).
8. **Entity switching**: wire `POST /api/entities/switch-context` and send
   `x-entity-id` on every request; expose an active-entity provider in the UI
   (profile screen).

### Phase 2 — Feature integration (priority order)

Each feature = repository methods → Riverpod providers → replace hardcoded
screen data → widget test with mocked repository.

9. **Transfers** — fix paths; wire `GET /api/transfers/history` (activity
   feed replaces `activity_screen.dart` const list) and `GET /api/transfers/balance`
   (home balance replaces the hardcoded `48250.00` in `home_screen.dart:114`).
10. **Cards** — `GET /api/cards`, issue/freeze/top-up against
    `cards_screen.dart` static data.
11. **Invest** — `GET /api/ondo/stocks`, `GET /api/ondo/positions/:entityId`,
    buy/sell against `invest_screen.dart` static data.
12. **Vault / savings** — `GET /api/savings/summary`, pods strategies +
    deposit/withdraw against `vault_screen.dart`.
13. **Payroll & treasury** — `GET/POST /api/payroll`, treasury already calls
    balance-sheet; extend with `GET /api/reports/*` as needed.
14. **Invoices & developer** — existing repositories minus fallbacks; add
    invoice settle/pay and webhook delivery views.

### Phase 3 — Environments & release config

15. Define `dev` / `staging` / `prod` dart-define profiles using the domains
    in `render.yaml`; document in `apps/mobile_flutter/AGENTS.md`. Never ship a
    default that points at `localhost` in release builds (assert in `AppConfig`
    when `kReleaseMode && baseUrl.contains('localhost')`).
16. Telegram Mini App build (`flutter build web`) must point at the deployed
    backend URL.

### Phase 4 — Verification

17. `flutter analyze` clean (CI treats infos as fatal), `flutter test`,
    `flutter build web` and `flutter build apk --debug` green.
18. Manual end-to-end pass per feature against a local backend
    (`DATABASE_URL` + migrations) with network failures simulated (fake 500s,
    airplane mode) to confirm errors reach the UI and no fabricated data leaks.
19. Update `apps/mobile_flutter/AGENTS.md` (currently stale — it still says
    "no API calls exist yet").

## Out of scope (flagged, optional)

- Backend: OpenAPI/swagger generation, refresh-token endpoint, email/password auth.
- Code-generating Dart models from `packages/contracts` zod schemas.
- Push notifications / realtime for activity feed.
