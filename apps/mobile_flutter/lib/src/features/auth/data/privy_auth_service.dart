import 'package:dio/dio.dart';

import '../../../core/config/app_config.dart';
import '../../../core/network/api_config.dart';
import 'privy_auth_service_native.dart'
    if (dart.library.js_interop) 'privy_auth_service_web.dart';

/// Fills [AppConfig.privyAppId] / [AppConfig.privyClientId] from the backend's
/// public `GET /api/config` when they weren't supplied via `--dart-define`.
/// Safe to call repeatedly — resolves only once, and dart-define always wins.
Future<void> resolvePrivyConfig() async {
  if (AppConfig.privyAppId.isNotEmpty) return;
  try {
    final dio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.baseUrl,
        connectTimeout: ApiConfig.connectTimeout,
        receiveTimeout: ApiConfig.receiveTimeout,
      ),
    );
    final response = await dio.get<Map<String, dynamic>>('/api/config');
    final data = response.data;
    if (data == null) return;
    final appId = data['privyAppId'] as String?;
    if (appId != null && appId.isNotEmpty) {
      AppConfig.privyAppId = appId;
      AppConfig.privyClientId =
          (data['privyClientId'] as String?) ?? AppConfig.privyClientId;
    }
  } catch (_) {
    // Unreachable backend → leave values empty; the login screen shows a
    // "not configured" notice and the demo account remains available.
  }
}

/// Result of a successful Privy authentication, carrying the identifiers the
/// backend needs to mint a Proxim session.
class PrivySession {
  final String userId;
  final String accessToken;

  const PrivySession({required this.userId, required this.accessToken});
}

/// Platform abstraction over Privy authentication.
///
/// Two implementations exist:
/// - Native (Android/iOS): wraps the `privy_flutter` plugin.
/// - Web (browser / Telegram Mini App): bridges to `@privy-io/js-sdk-core`
///   loaded in `web/privy_bridge.js` via JS interop.
abstract class PrivyAuthService {
  Future<void> init();

  /// Returns an active Privy session without user interaction, or null.
  Future<PrivySession?> restoreSession();

  Future<void> sendEmailCode(String email);

  Future<PrivySession> loginWithEmailCode({
    required String email,
    required String code,
  });

  Future<PrivySession> loginWithGoogle();

  Future<void> logout();
}

PrivyAuthService createPrivyAuthService() => createPrivyAuthServiceImpl();
