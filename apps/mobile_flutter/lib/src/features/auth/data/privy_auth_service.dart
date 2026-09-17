import 'privy_auth_service_native.dart'
    if (dart.library.js_interop) 'privy_auth_service_web.dart';

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
