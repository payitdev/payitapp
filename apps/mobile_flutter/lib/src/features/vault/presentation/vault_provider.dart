import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_provider.dart';
import '../data/vault_repository.dart';
import '../domain/vault_models.dart';

final vaultRepositoryProvider = Provider<VaultRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return VaultRepository(apiClient: apiClient);
});

/// Savings summary — total balance, APY, strategy list
final savingsSummaryProvider = FutureProvider.autoDispose<SavingsSummary>((ref) async {
  final repo = ref.watch(vaultRepositoryProvider);
  return repo.getSummary();
});

/// Live yield routes (Kamino + NEAR Intent Earn) with real APYs —
/// GET /api/kamino/yield-options. Errors resolve to an empty list so the
/// UI shows '—' instead of a promotional number.
final vaultYieldOptionsProvider =
    FutureProvider.autoDispose<List<VaultYieldOption>>((ref) async {
  final repo = ref.watch(vaultRepositoryProvider);
  return repo.getYieldOptions();
});

/// Best user-facing rate currently available across the yield routes
/// (max userNetApy); null when no route is live.
final bestVaultApyProvider = Provider.autoDispose<double?>((ref) {
  final optionsAsync = ref.watch(vaultYieldOptionsProvider);
  final options = optionsAsync.value ?? const <VaultYieldOption>[];
  double? best;
  for (final option in options) {
    if (option.userNetApy > 0 && (best == null || option.userNetApy > best)) {
      best = option.userNetApy;
    }
  }
  return best;
});

/// Auto-save configuration for the active entity — GET /api/kamino/auto-save.
/// Errors resolve to disabled so the badge never claims an unverified state.
final autoSaveStatusProvider = FutureProvider.autoDispose<AutoSaveStatus>((ref) async {
  final entity = ref.watch(activeEntityProvider);
  if (entity == null) {
    throw StateError('No active entity selected.');
  }
  final repo = ref.watch(vaultRepositoryProvider);
  return repo.getAutoSave(entityId: entity.id);
});
