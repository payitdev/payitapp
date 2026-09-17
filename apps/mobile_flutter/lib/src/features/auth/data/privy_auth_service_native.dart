import 'package:privy_flutter/privy_flutter.dart';

import '../../../core/config/app_config.dart';
import 'privy_auth_service.dart';

/// Native (Android/iOS) Privy implementation backed by the `privy_flutter`
/// plugin. Web builds use `privy_auth_service_web.dart` instead.
PrivyAuthService createPrivyAuthServiceImpl() => NativePrivyAuthService();

class NativePrivyAuthService implements PrivyAuthService {
  late final Privy _privy;

  @override
  Future<void> init() async {
    _privy = Privy.init(
      config: PrivyConfig(
        appId: AppConfig.privyAppId,
        appClientId: AppConfig.privyClientId,
      ),
    );
    // Resolves once the SDK is ready; also restores any persisted session.
    await _privy.getAuthState();
  }

  @override
  Future<PrivySession?> restoreSession() async {
    final user = await _privy.getUser();
    if (user == null) return null;
    return PrivySession(userId: user.id, accessToken: await _accessToken(user));
  }

  @override
  Future<void> sendEmailCode(String email) async {
    final result = await _privy.email.sendCode(email);
    if (result is Failure<void>) {
      throw Exception(result.error.message);
    }
  }

  @override
  Future<PrivySession> loginWithEmailCode({
    required String email,
    required String code,
  }) async {
    final result = await _privy.email.loginWithCode(code: code, email: email);
    switch (result) {
      case Success<PrivyUser>(:final value):
        return PrivySession(
          userId: value.id,
          accessToken: await _accessToken(value),
        );
      case Failure<PrivyUser>(:final error):
        throw Exception(error.message);
    }
  }

  @override
  Future<PrivySession> loginWithGoogle() async {
    final result = await _privy.oAuth.login(
      provider: OAuthProvider.google,
      appUrlScheme: 'proxim',
    );
    switch (result) {
      case Success<PrivyUser>(:final value):
        return PrivySession(
          userId: value.id,
          accessToken: await _accessToken(value),
        );
      case Failure<PrivyUser>(:final error):
        throw Exception(error.message);
    }
  }

  @override
  Future<void> logout() async {
    await _privy.logout();
  }

  Future<String> _accessToken(PrivyUser user) async {
    final result = await user.getAccessToken();
    switch (result) {
      case Success<String>(:final value):
        return value;
      case Failure<String>(:final error):
        throw Exception(error.message);
    }
  }
}
