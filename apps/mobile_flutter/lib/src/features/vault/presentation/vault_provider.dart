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
