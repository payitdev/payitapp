import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/auth/auth_guard.dart';
import '../../../core/network/api_client.dart';
import '../data/auth_repository.dart';
import '../data/privy_auth_service.dart';
import '../domain/auth_models.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────────────────────

final apiClientProvider = Provider<ProximApiClient>((ref) {
  return ProximApiClient();
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return AuthRepository(apiClient: apiClient);
});

final privyAuthServiceProvider = Provider<PrivyAuthService>((ref) {
  return createPrivyAuthService();
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth State
// ─────────────────────────────────────────────────────────────────────────────

class AuthState {
  final bool isLoading;
  final bool isSendingCode;
  final ProximUser? user;
  final String? activeEntityId;
  final String? errorMessage;

  const AuthState({
    this.isLoading = false,
    this.isSendingCode = false,
    this.user,
    this.activeEntityId,
    this.errorMessage,
  });

  bool get isAuthenticated => user != null;

  ProximEntity? get activeEntity {
    if (user == null || user!.entities.isEmpty) return null;
    if (activeEntityId != null) {
      try {
        return user!.entities.firstWhere((e) => e.id == activeEntityId);
      } catch (_) {}
    }
    return user!.activeEntity;
  }

  bool get isBusinessMode => activeEntity?.isBusiness ?? true;

  AuthState copyWith({
    bool? isLoading,
    bool? isSendingCode,
    ProximUser? user,
    String? activeEntityId,
    String? errorMessage,
    bool clearError = false,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      isSendingCode: isSendingCode ?? this.isSendingCode,
      user: user ?? this.user,
      activeEntityId: activeEntityId ?? this.activeEntityId,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Notifier
// ─────────────────────────────────────────────────────────────────────────────

class AuthNotifier extends Notifier<AuthState> with WidgetsBindingObserver {
  late final AuthRepository _repository;
  late final PrivyAuthService _privy;

  @override
  AuthState build() {
    _repository = ref.watch(authRepositoryProvider);
    _privy = ref.watch(privyAuthServiceProvider);

    // Wire 401 callback: when api_client sees a 401, log the user out
    _repository.apiClient.onUnauthorized = () async {
      _setState(const AuthState());
    };

    // Register lifecycle observer so we can validate the session on resume
    WidgetsBinding.instance.addObserver(this);
    ref.onDispose(() => WidgetsBinding.instance.removeObserver(this));

    Future.microtask(() => initializeSession());
    return const AuthState(isLoading: true);
  }

  /// Single funnel for state transitions — keeps the router's auth guard in
  /// sync with the Riverpod state.
  void _setState(AuthState next) {
    state = next;
    authGuard.setAuthenticated(next.isAuthenticated);
  }

  /// Called by WidgetsBindingObserver when the app comes back to the foreground.
  /// Telegram JWTs expire in 1h — re-check the session every time the user
  /// returns to the app.
  @override
  Future<void> didChangeAppLifecycleState(AppLifecycleState appState) async {
    if (appState == AppLifecycleState.resumed && state.isAuthenticated) {
      final valid = await _repository.checkSession();
      if (!valid) {
        await logout();
      }
    }
  }

  /// App start: restore the stored session, then try a silent Privy
  /// re-authentication before giving up and showing the login screen.
  Future<void> initializeSession() async {
    _setState(state.copyWith(isLoading: true, clearError: true));
    try {
      final user = await _repository.restoreSession();
      if (user != null) {
        _setState(state.copyWith(
          isLoading: false,
          user: user,
          activeEntityId: user.activeEntityId,
        ));
        return;
      }

      // Stored app JWT missing/invalid — if Privy still has a session,
      // exchange it for a fresh Proxim JWT without user interaction.
      try {
        await _privy.init();
        final session = await _privy.restoreSession();
        if (session != null) {
          final privyUser = await _repository.loginPrivy(
            privyUserId: session.userId,
            accessToken: session.accessToken,
          );
          _setState(state.copyWith(
            isLoading: false,
            user: privyUser,
            activeEntityId: privyUser.activeEntityId,
          ));
          return;
        }
      } catch (e) {
        debugPrint('[AuthNotifier] Silent Privy restore failed: $e');
      }

      _setState(const AuthState(isLoading: false));
    } catch (e) {
      _setState(AuthState(isLoading: false, errorMessage: e.toString()));
    }
  }

  // ── Sign-in flows ──────────────────────────────────────────────────────────

  /// Step 1 of email sign-in / sign-up: send a one-time code.
  Future<bool> sendEmailCode(String email) async {
    _setState(state.copyWith(isSendingCode: true, clearError: true));
    try {
      await _privy.init();
      await _privy.sendEmailCode(email.trim());
      _setState(state.copyWith(isSendingCode: false));
      return true;
    } catch (e) {
      _setState(state.copyWith(isSendingCode: false, errorMessage: e.toString()));
      return false;
    }
  }

  /// Step 2 of email sign-in / sign-up: verify the code. First-time emails
  /// are registered automatically by the backend — there is no separate
  /// sign-up endpoint.
  Future<bool> loginWithEmailCode({required String email, required String code}) async {
    _setState(state.copyWith(isLoading: true, clearError: true));
    try {
      final session = await _privy.loginWithEmailCode(email: email.trim(), code: code.trim());
      final user = await _repository.loginPrivy(
        privyUserId: session.userId,
        accessToken: session.accessToken,
      );
      _setState(state.copyWith(isLoading: false, user: user, activeEntityId: user.activeEntityId));
      return true;
    } catch (e) {
      _setState(AuthState(isLoading: false, errorMessage: e.toString()));
      return false;
    }
  }

  Future<bool> loginWithGoogle() async {
    _setState(state.copyWith(isLoading: true, clearError: true));
    try {
      await _privy.init();
      final session = await _privy.loginWithGoogle();
      final user = await _repository.loginPrivy(
        privyUserId: session.userId,
        accessToken: session.accessToken,
      );
      _setState(state.copyWith(isLoading: false, user: user, activeEntityId: user.activeEntityId));
      return true;
    } catch (e) {
      _setState(AuthState(isLoading: false, errorMessage: e.toString()));
      return false;
    }
  }

  /// Demo account — used by the "Explore the demo" button on the login screen.
  Future<bool> loginDemo() async {
    _setState(state.copyWith(isLoading: true, clearError: true));
    try {
      final user = await _repository.loginDemo();
      _setState(state.copyWith(isLoading: false, user: user, activeEntityId: user.activeEntityId));
      return true;
    } catch (e) {
      _setState(AuthState(isLoading: false, errorMessage: e.toString()));
      return false;
    }
  }

  // ── Session management ─────────────────────────────────────────────────────

  Future<void> toggleEntityMode() async {
    final user = state.user;
    if (user == null || user.entities.length < 2) return;

    final currentKind = state.activeEntity?.kind;
    final targetEntity = user.entities.firstWhere(
      (e) => e.kind != currentKind,
      orElse: () => user.entities.first,
    );

    await _repository.switchActiveEntity(targetEntity.id);
    _setState(state.copyWith(activeEntityId: targetEntity.id));
  }

  Future<void> setMode(bool isBusiness) async {
    final user = state.user;
    if (user == null) return;

    final targetKind = isBusiness ? 'BUSINESS' : 'PERSONAL';
    final targetEntity = user.entities.firstWhere(
      (e) => e.kind == targetKind,
      orElse: () => user.entities.first,
    );

    await _repository.switchActiveEntity(targetEntity.id);
    _setState(state.copyWith(activeEntityId: targetEntity.id));
  }

  Future<void> selectEntity(String entityId) async {
    await _repository.switchActiveEntity(entityId);
    _setState(state.copyWith(activeEntityId: entityId));
  }

  Future<void> logout() async {
    try {
      await _privy.logout();
    } catch (e) {
      debugPrint('[AuthNotifier] Privy logout note: $e');
    }
    await _repository.logout();
    _setState(const AuthState());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level convenience providers
// ─────────────────────────────────────────────────────────────────────────────

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

final currentUserProvider = Provider<ProximUser?>((ref) {
  return ref.watch(authProvider).user;
});

final activeEntityProvider = Provider<ProximEntity?>((ref) {
  return ref.watch(authProvider).activeEntity;
});

final isBusinessModeProvider = Provider<bool>((ref) {
  return ref.watch(authProvider).isBusinessMode;
});
