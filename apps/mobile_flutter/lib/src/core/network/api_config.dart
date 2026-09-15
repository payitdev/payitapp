import 'package:flutter/foundation.dart';

/// ─────────────────────────────────────────────────────────────────────────────
/// API Configuration — compile-time dart-define flags
/// ─────────────────────────────────────────────────────────────────────────────
///
/// Local development (backend must run on port 3001):
///   flutter run --dart-define=API_BASE_URL=http://localhost:3001
///
/// Android emulator (localhost maps to 10.0.2.2):
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001
///
/// Staging:
///   flutter run --dart-define=API_BASE_URL=https://api-staging.proxim.app
///
/// Production:
///   flutter build apk --dart-define=API_BASE_URL=https://api.proxim.app
///
/// Demo / offline mode (falls back to mock data when API unreachable):
///   flutter run --dart-define=DEMO_MODE=true
///
class ApiConfig {
  ApiConfig._();

  /// Whether to enable offline demo fallbacks.
  /// Set --dart-define=DEMO_MODE=true for local development without a backend.
  static const bool isDemoMode =
      bool.fromEnvironment('DEMO_MODE', defaultValue: false);

  /// The backend base URL, resolved from dart-define flags.
  static String get baseUrl {
    // Explicit override takes top priority
    const fromBaseUrl = String.fromEnvironment('API_BASE_URL');
    if (fromBaseUrl.isNotEmpty) {
      _assertNotLocalhostInRelease(fromBaseUrl);
      return fromBaseUrl;
    }

    const fromApiUrl = String.fromEnvironment('API_URL');
    if (fromApiUrl.isNotEmpty) {
      _assertNotLocalhostInRelease(fromApiUrl);
      return fromApiUrl;
    }

    // Platform-specific dev defaults — backend runs on port 3001
    if (kIsWeb) return 'http://localhost:3001';
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3001';
    }
    return 'http://localhost:3001';
  }

  static void _assertNotLocalhostInRelease(String url) {
    assert(
      !kReleaseMode || !url.contains('localhost'),
      'Release builds must not point at localhost. '
      'Supply a real API_BASE_URL via --dart-define.',
    );
  }

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);
}

class ProximException implements Exception {
  final String message;
  final int? statusCode;
  final String? code;

  const ProximException(this.message, {this.statusCode, this.code});

  @override
  String toString() => message;
}
