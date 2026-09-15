import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../data/auth_repository.dart';
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

// ─────────────────────────────────────────────────────────────────────────────
// Auth State
// ─────────────────────────────────────────────────────────────────────────────

class AuthState {
  final bool isLoading;
  final ProximUser? user;
  final String? activeEntityId;
  final String? errorMessage;

  const AuthState({
    this.isLoading = false,
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
    ProximUser? user,
    String? activeEntityId,
    String? errorMessage,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      user: user ?? this.user,
      activeEntityId: activeEntityId ?? this.activeEntityId,
      errorMessage: errorMessage,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Notifier
// ─────────────────────────────────────────────────────────────────────────────

class AuthNotifier extends Notifier<AuthState> with WidgetsBindingObserver {
  late final AuthRepository _repository;

  @override
  AuthState build() {
    _repository = ref.watch(authRepositoryProvider);

    // Wire 401 callback: when api_client sees a 401, log the user out
    _repository.apiClient.onUnauthorized = () async {
      state = const AuthState();
    };

    // Register lifecycle observer so we can validate the session on resume
    WidgetsBinding.instance.addObserver(this);
    ref.onDispose(() => WidgetsBinding.instance.removeObserver(this));

    Future.microtask(() => initializeSession());
    return const AuthState(isLoading: true);
  }

  /// Called by WidgetsBindingObserver when the app comes back to the foreground.
  /// Telegram JWTs expire in 1h — re-check the session every time the user
  /// returns to the app.
  @override
  Future<void> didChangeAppLifecycleState(AppLifecycleState appState) async {
    if (appState == AppLifecycleState.resumed && state.isAuthenticated) {
      final valid = await _repository.checkSession();
      if (!valid) {
        await _repository.logout();
        state = const AuthState();
      }
    }
  }

  Future<void> initializeSession() async {
    state = state.copyWith(isLoading: true);
    try {
      final user = await _repository.restoreSession();
      if (user != null) {
        state = state.copyWith(isLoading: false, user: user, activeEntityId: user.activeEntityId);
        return;
      }
    } catch (_) {}

    // Auto-login to demo session (calls the real /api/auth/demo endpoint;
    // falls back to offline data only if DEMO_MODE=true)
    try {
      final user = await _repository.loginDemo();
      state = state.copyWith(isLoading: false, user: user, activeEntityId: user.activeEntityId);
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
    }
  }

  Future<void> toggleEntityMode() async {
    final user = state.user;
    if (user == null || user.entities.length < 2) return;

    final currentKind = state.activeEntity?.kind;
    final targetEntity = user.entities.firstWhere(
      (e) => e.kind != currentKind,
      orElse: () => user.entities.first,
    );

    await _repository.switchActiveEntity(targetEntity.id);
    state = state.copyWith(activeEntityId: targetEntity.id);
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
    state = state.copyWith(activeEntityId: targetEntity.id);
  }

  Future<void> selectEntity(String entityId) async {
    await _repository.switchActiveEntity(entityId);
    state = state.copyWith(activeEntityId: entityId);
  }

  Future<void> logout() async {
    await _repository.logout();
    state = const AuthState();
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
