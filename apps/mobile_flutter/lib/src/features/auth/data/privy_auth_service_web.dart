import 'dart:js_interop';

import '../../../core/config/app_config.dart';
import 'privy_auth_service.dart';

@JS('proximPrivy')
external _ProximPrivyBridge? get _globalBridge;

/// Web (browser / Telegram Mini App) Privy implementation that bridges to
/// `@privy-io/js-sdk-core` through the wrapper exposed by `web/privy_bridge.js`.
///
/// Native builds use `privy_auth_service_native.dart` instead.
PrivyAuthService createPrivyAuthServiceImpl() => WebPrivyAuthService();

@JS('proximPrivy')
extension type _ProximPrivyBridge(JSObject _) implements JSObject {
  external JSPromise<JSObject?> init(String appId, String clientId);
  external JSPromise<_PrivySessionJs?> restore();
  external JSPromise<JSObject?> sendCode(String email);
  external JSPromise<_PrivySessionJs> loginWithCode(String email, String code);
  external JSPromise<_PrivySessionJs> loginWithGoogle();
  external JSPromise<JSObject?> logout();
}

extension type _PrivySessionJs(JSObject _) implements JSObject {
  external String get userId;
  external String get accessToken;
}

class WebPrivyAuthService implements PrivyAuthService {
  bool _initialized = false;

  Future<_ProximPrivyBridge> _ensureBridge() async {
    // web/privy_bridge.js is an ES module that imports the Privy SDK from a
    // CDN — it lands asynchronously, often after the app's first frame. Wait
    // for it instead of failing sign-in on a cold start.
    final sw = Stopwatch()..start();
    while (_globalBridge == null && sw.elapsed < const Duration(seconds: 15)) {
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    final bridge = _globalBridge;
    if (bridge == null) {
      throw Exception(
        'Sign-in is unavailable right now. Please check your connection and reload the app.',
      );
    }
    return bridge;
  }

  Future<T> _call<T>(Future<T> Function(_ProximPrivyBridge bridge) invoke) async {
    final bridge = await _ensureBridge();
    try {
      return await invoke(bridge);
    } catch (e) {
      throw Exception('Authentication failed: $e');
    }
  }

  @override
  Future<void> init() async {
    if (_initialized) return;
    await resolvePrivyConfig();
    await _call((bridge) async {
      await bridge.init(AppConfig.privyAppId, AppConfig.privyClientId).toDart;
    });
    _initialized = true;
  }

  @override
  Future<PrivySession?> restoreSession() {
    return _call((bridge) async {
      final session = await bridge.restore().toDart;
      if (session == null) return null;
      return PrivySession(userId: session.userId, accessToken: session.accessToken);
    });
  }

  @override
  Future<void> sendEmailCode(String email) {
    return _call((bridge) async {
      await bridge.sendCode(email).toDart;
    });
  }

  @override
  Future<PrivySession> loginWithEmailCode({
    required String email,
    required String code,
  }) {
    return _call((bridge) async {
      final session = await bridge.loginWithCode(email, code).toDart;
      return PrivySession(userId: session.userId, accessToken: session.accessToken);
    });
  }

  @override
  Future<PrivySession> loginWithGoogle() {
    return _call((bridge) async {
      final session = await bridge.loginWithGoogle().toDart;
      return PrivySession(userId: session.userId, accessToken: session.accessToken);
    });
  }

  @override
  Future<void> logout() {
    return _call((bridge) async {
      await bridge.logout().toDart;
    });
  }
}
