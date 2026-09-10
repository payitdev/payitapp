import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../data/auth_repository.dart';
import '../domain/auth_models.dart';

final apiClientProvider = Provider<ProximApiClient>((ref) {
  return ProximApiClient();
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return AuthRepository(apiClient: apiClient);
});

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

class AuthNotifier extends Notifier<AuthState> {
  late final AuthRepository _repository;

  @override
  AuthState build() {
    _repository = ref.watch(authRepositoryProvider);
    Future.microtask(() => initializeSession());
    return const AuthState(isLoading: true);
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

    // Auto-login to demo session so all screens function immediately out of the box
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

    final targetKind = isBusiness ? 'business' : 'individual';
    final targetEntity = user.entities.firstWhere(
      (e) => e.kind.toLowerCase() == targetKind,
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
