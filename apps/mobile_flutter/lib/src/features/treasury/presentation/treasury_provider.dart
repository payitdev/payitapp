import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_provider.dart';
import '../data/treasury_repository.dart';

final treasuryRepositoryProvider = Provider<TreasuryRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return TreasuryRepository(apiClient: apiClient);
});

final balanceSheetProvider = FutureProvider.autoDispose.family<BalanceSheetData, ({String entityId, String period})>((ref, arg) async {
  final repo = ref.watch(treasuryRepositoryProvider);
  return repo.getBalanceSheet(entityId: arg.entityId, period: arg.period);
});

final activeBalanceSheetProvider = FutureProvider.autoDispose<BalanceSheetData>((ref) async {
  final entity = ref.watch(activeEntityProvider);
  final repo = ref.watch(treasuryRepositoryProvider);
  return repo.getBalanceSheet(entityId: entity?.id ?? 'demo-business-entity');
});

