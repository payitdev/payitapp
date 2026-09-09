# Proxim Flutter App

Flutter client for the payit/proxim fintech monorepo. Targets Android APK,
web, and Telegram Mini App from one codebase. Consumes the Fastify backend
(`apps/backend`, port 3001).

## Commands

Run from `apps/mobile_flutter` (or prefix with `cd apps/mobile_flutter`):

```bash
flutter pub get
flutter analyze            # must be clean (CI treats infos as fatal)
flutter test
flutter build web
flutter build apk --debug  # release signing comes later; never commit signing keys
```

## Configuration (dart-define)

All configuration is compile-time via `--dart-define` (see
`lib/src/core/config/app_config.dart`):

```bash
flutter run --dart-define=API_BASE_URL=http://localhost:3001   # default (dev)
flutter run --dart-define=API_BASE_URL=https://<staging-host>  # staging
```

- `API_BASE_URL` — backend base URL. Default: `http://localhost:3001`.
  Staging/prod hosts come from the domains in `render.yaml`.

## Architecture

- **State management:** Riverpod (`flutter_riverpod`). App is wrapped in
  `ProviderScope` in `lib/main.dart`; widgets use `ConsumerWidget`.
- **Navigation:** `go_router`, defined in `lib/src/app/router.dart`.
  Auth redirects/guards arrive in Phase 4.
- **Layout:** all screens render inside `CenteredAppContainer`
  (`lib/src/core/widgets/`) — a 440px-max-width centered wrapper shared by
  phone, web, and Mini App.
- **Theme:** dark-only (`ProximTheme.darkTheme`), built from the design
  tokens in `lib/src/core/theme/proxim_theme.dart`.
- **Feature-first folders:** `lib/src/features/<feature>/{data,domain,presentation}`.
  Only `home` exists so far (placeholder).
- **Networking:** dio is a declared dependency, but no API calls exist yet.
  The plan (documented in `lib/src/core/network/api_client.dart`):
  - Repository classes are the only place dio may be used — never call it
    from widgets.
  - Requests get `Authorization: Bearer <jwt>` and, on POSTs, an
    `Idempotency-Key` header (backend enforces idempotency).
  - Errors map to a typed `ApiFailure`; 401 triggers re-login.

## Monorepo integration

This app is **standalone**: it is NOT a pnpm workspace package. Repo-root
`pnpm-workspace.yaml` matches `apps/*`, but pnpm ignores
`apps/mobile_flutter` because it has no `package.json` — verified on
2026-09-09: `pnpm ls --depth -1` from the repo root exited 0 and did not
list the Flutter app. No exclusion needed. Use Flutter's own tooling here
(`flutter pub get`, not pnpm/pnpm-lock).

## CI

`.github/workflows/flutter.yml` runs on pushes/PRs touching
`apps/mobile_flutter/**`: `flutter analyze --fatal-infos`, `flutter test`,
`flutter build web` (artifact uploaded) on every run; `flutter build apk
--debug` (artifact uploaded) only on `main` branch pushes.
