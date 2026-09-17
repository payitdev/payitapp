import 'package:flutter/foundation.dart';

/// Global authentication gate consumed by the router (`redirect` +
/// `refreshListenable`).
///
/// Lives outside Riverpod so the top-level `router` instance can read it
/// without a ProviderScope. [AuthNotifier] updates it on every auth state
/// transition; tests can authenticate it directly.
class AuthGuard extends ChangeNotifier {
  bool _isAuthenticated = false;

  bool get isAuthenticated => _isAuthenticated;

  void setAuthenticated(bool value) {
    if (_isAuthenticated == value) return;
    _isAuthenticated = value;
    notifyListeners();
  }
}

final authGuard = AuthGuard();
