# Proxim Flutter App — Agent Guide

## Quick orientation

| Layer | Location | Notes |
|---|---|---|
| App shell / routing | `lib/src/app/` | go_router with auth guard |
| Core networking | `lib/src/core/network/` | Dio + JWT interceptor + idempotency |
| Feature modules | `lib/src/features/<feature>/` | data / domain / presentation |
| Theme | `lib/src/core/theme/proxim_theme.dart` | dark-only design system |

## Backend connection

The Flutter app talks to the **Fastify backend** (`apps/backend`).

### Port alignment
- Local backend **must run on port 3001** (`PORT=3001`).
- The Flutter client defaults to `http://localhost:3001` (web/macOS) and `http://10.0.2.2:3001` (Android emulator).

### Environment Profiles

| Environment | Run command |
|---|---|
| **Local dev** (web/macOS) | `flutter run --dart-define=API_BASE_URL=http://localhost:3001` |
| **Android emulator** | `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001` |
| **Demo mode** (no backend needed) | `flutter run --dart-define=API_BASE_URL=http://localhost:3001 --dart-define=DEMO_MODE=true` |
| **Email/Google sign-in** (add to any profile) | `--dart-define=PRIVY_APP_ID=<app-id> --dart-define=PRIVY_CLIENT_ID=<client-id>` |
| **Staging** | `flutter run --dart-define=API_BASE_URL=https://api-staging.proxim.app` |
| **Production APK** | `flutter build apk --dart-define=API_BASE_URL=https://api.proxim.app --dart-define=PRIVY_APP_ID=<app-id> --dart-define=PRIVY_CLIENT_ID=<client-id>` |
| **Telegram Mini App (web build)** | `flutter build web --dart-define=API_BASE_URL=https://api.proxim.app --dart-define=PRIVY_APP_ID=<app-id> --dart-define=PRIVY_CLIENT_ID=<client-id>` |

## Sign-in architecture (Privy, passwordless)

There are no passwords — email OTP and Google sign-in go through Privy, and
the backend auto-registers first-time emails (login = sign-up).

- **Native (Android/iOS/APK):** `privy_flutter` plugin → `privy_auth_service_native.dart`.
- **Web / Telegram Mini App:** `privy_flutter` is native-only, so web builds
  bridge to `@privy-io/js-sdk-core` via JS interop — `web/privy_bridge.js`
  exposes `window.proximPrivy`, consumed by `privy_auth_service_web.dart`.
- Flow: Privy login → `{privyUserId, accessToken}` → `POST /api/auth/privy/login`
  with `Authorization: Bearer <privy access token>` → backend mints a 7-day
  Proxim JWT (`{success, token, user}`).
- Android: `minSdk 27` (privy_flutter requirement); OAuth redirect scheme
  `proxim://` registered in `AndroidManifest.xml`.
- Router guard: `core/auth/auth_guard.dart` — `AuthNotifier` updates it on
  every state change; go_router redirects unauthenticated users to `/login`
  (except public `/checkout/*`).
- "Forgot password" UX = resend a one-time code (no passwords exist).
- Demo account remains reachable via "Explore the demo account" on the login
  screen (still calls the real `POST /api/auth/demo`).

### Starting the full local stack
```bash
# Terminal 1 — backend on port 3001
cd apps/backend && PORT=3001 pnpm dev

# Terminal 2 — Flutter app
cd apps/mobile_flutter
flutter run --dart-define=API_BASE_URL=http://localhost:3001
```

## Endpoint map (client → backend)

| Feature | Client call | Backend route |
|---|---|---|
| Session restore | `GET /api/auth/session` | ✅ |
| Demo login | `POST /api/auth/demo` | ✅ |
| Telegram auth | `POST /api/auth/telegram/mini-app` | ✅ |
| Privy login | `POST /api/auth/privy/login` | ✅ |
| Passcode verify | `POST /api/auth/passcode/verify` | ✅ |
| Entity switch | `POST /api/entities/switch-context` | ✅ |
| FX quote | `GET /api/transfers/fx-quote` | ✅ |
| Send money | `POST /api/transfers/execute` | ✅ (was `/send`) |
| Internal swap | `POST /api/transfers/internal` | ✅ (was `/internal-convert`) |
| Transfer history | `GET /api/transfers/history` | ✅ |
| Balance | `GET /api/transfers/balance` | ✅ |
| Cards list | `GET /api/cards` | ✅ |
| Card freeze | `POST /api/cards/:id/freeze` | ✅ |
| Card top-up | `POST /api/cards/:id/top-up` | ✅ |
| Stocks watchlist | `GET /api/ondo/stocks` | ✅ |
| Positions | `GET /api/ondo/positions/:entityId` | ✅ |
| Buy stock | `POST /api/ondo/buy` | ✅ |
| Sell stock | `POST /api/ondo/sell` | ✅ |
| Savings summary | `GET /api/savings/summary` | ✅ |
| Deposit | `POST /api/savings/deposit` | ✅ |
| Withdraw | `POST /api/savings/withdraw` | ✅ |
| Balance sheet | `GET /api/reports/balance-sheet` | ✅ |
| Invoices list | `GET /api/invoices` | ✅ |
| Create invoice | `POST /api/invoices` | ✅ |
| API keys list | `GET /api/developer/keys` | ✅ |
| Roll API key | `POST /api/developer/keys` | ✅ |

## Authentication & Session handling

- Auth header: `Authorization: Bearer <jwt>` on every request.
- Entity context: `x-entity-id: <entityId>` on every request.
- **Idempotency-Key**: UUID v4 on every POST/PUT/PATCH — generated in `idempotency.dart`.
- **401 handling**: `api_client.dart` interceptor clears token storage and fires `onUnauthorized` callback → `AuthNotifier` sets state to unauthenticated → go_router redirects to login.
- **Session expiry**: Telegram JWTs live 1h. `AuthNotifier` implements `WidgetsBindingObserver` and calls `GET /api/auth/session` on every app resume. Failed check logs user out.
- **App start**: stored JWT → `GET /api/auth/session`; if invalid, a silent Privy session restore re-mints a JWT before the login screen is shown.
- **DEMO_MODE**: Compile with `--dart-define=DEMO_MODE=true` to enable offline fallbacks in all repositories. Never enabled by default.

## DEMO_MODE vs production

| Behaviour | Default (prod) | DEMO_MODE=true |
|---|---|---|
| API error | Surfaces typed `ProximException` to UI | Returns mock data |
| Passcode | Real API call | Also accepts `123456` |
| Demo login fail | Throws error | Returns offline user |
| Balance load fail | Shows error + retry | Returns fake balance |

## Code conventions

- All repositories: real errors propagate; demo fallbacks only when `ApiConfig.isDemoMode`.
- Never use `try { ... } catch (e) { return fakeData; }` — this is the pattern we replaced.
- Error messages follow Proxim tone: "We couldn't complete your payment. Please try again."
- No crypto/blockchain jargon in user-facing copy (see root `AGENTS.md`).
- `flutter analyze` must pass clean before merging. Run `flutter test` for widget tests.

## Build commands

```bash
# Analyze
flutter analyze

# Test
flutter test

# Web build (Telegram Mini App)
flutter build web --dart-define=API_BASE_URL=https://api.proxim.app

# Android debug
flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:3001

# Android release
flutter build apk --dart-define=API_BASE_URL=https://api.proxim.app
```
