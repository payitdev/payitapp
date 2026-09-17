import 'package:flutter/foundation.dart';

/// ─────────────────────────────────────────────────────────────────────────────
/// AppConfig — Compile-time environment configuration via `--dart-define` flags
/// ─────────────────────────────────────────────────────────────────────────────
///
/// ## Environment Profiles
///
/// **Development** (local backend on port 3001):
/// ```
/// flutter run \
///   --dart-define=API_BASE_URL=http://localhost:3001 \
///   --dart-define=DEMO_MODE=true
/// ```
///
/// **Android Emulator** (localhost maps to 10.0.2.2):
/// ```
/// flutter run \
///   --dart-define=API_BASE_URL=http://10.0.2.2:3001
/// ```
///
/// **Staging**:
/// ```
/// flutter run \
///   --dart-define=API_BASE_URL=https://api-staging.proxim.app
/// ```
///
/// **Production** (e.g. from CI):
/// ```
/// flutter build apk \
///   --dart-define=API_BASE_URL=https://api.proxim.app
/// flutter build web \
///   --dart-define=API_BASE_URL=https://api.proxim.app
/// ```
///
/// ## Telegram Mini App
/// ```
/// flutter build web \
///   --dart-define=API_BASE_URL=https://api.proxim.app
/// ```
///
class AppConfig {
  const AppConfig._();

  /// Backend base URL. Defaults to localhost:3001 for local dev.
  /// MUST be overridden in staging/production builds.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3001',
  );

  /// When true, the app shows offline/demo data when the API is unreachable.
  /// Never enabled by default — only with explicit --dart-define=DEMO_MODE=true.
  static const bool isDemoMode =
      bool.fromEnvironment('DEMO_MODE', defaultValue: false);

  /// Privy app ID (Dashboard → Settings). Required for sign-in.
  static const String privyAppId = String.fromEnvironment('PRIVY_APP_ID');

  /// Privy client ID (Dashboard → Settings → Clients).
  static const String privyClientId = String.fromEnvironment('PRIVY_CLIENT_ID');

  /// Guard that fires in debug mode when a release build is misconfigured.
  static void validateConfig() {
    assert(
      !kReleaseMode || !apiBaseUrl.contains('localhost'),
      '[AppConfig] Release build is pointing at localhost. '
      'Add --dart-define=API_BASE_URL=https://api.proxim.app to your build command.',
    );
  }
}
