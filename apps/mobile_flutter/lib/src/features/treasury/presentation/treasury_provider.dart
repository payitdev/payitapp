import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_provider.dart';
import '../../transfers/domain/transfers_models.dart';
import '../data/treasury_repository.dart';
import '../domain/treasury_metrics.dart';
import '../domain/treasury_models.dart';

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
  if (entity == null) {
    throw StateError('No active entity selected.');
  }
  final repo = ref.watch(treasuryRepositoryProvider);
  return repo.getBalanceSheet(entityId: entity.id);
});

/// Live consolidated balance for the active entity — GET /api/transfers/balance
final treasuryBalanceProvider = FutureProvider.autoDispose<TreasuryBalance>((ref) async {
  final entity = ref.watch(activeEntityProvider);
  if (entity == null) {
    throw StateError('No active entity selected.');
  }
  final repo = ref.watch(treasuryRepositoryProvider);
  return repo.getBalance(entityId: entity.id);
});

/// Transfer history for the active entity — GET /api/transfers/history
final treasuryHistoryProvider =
    FutureProvider.autoDispose<List<TreasuryTransaction>>((ref) async {
  final entity = ref.watch(activeEntityProvider);
  if (entity == null) {
    throw StateError('No active entity selected.');
  }
  final repo = ref.watch(treasuryRepositoryProvider);
  return repo.getHistory(entityId: entity.id);
});

/// Connected deposit accounts ("vaults") — GET /api/transfers/accounts
final treasuryAccountsProvider =
    FutureProvider.autoDispose<List<DepositAccount>>((ref) async {
  final entity = ref.watch(activeEntityProvider);
  if (entity == null) {
    throw StateError('No active entity selected.');
  }
  final repo = ref.watch(treasuryRepositoryProvider);
  return repo.getAccounts(entityId: entity.id);
});

/// Live FX rates — GET /api/fx/rates
final fxRatesProvider = FutureProvider.autoDispose<List<FxRate>>((ref) async {
  final repo = ref.watch(treasuryRepositoryProvider);
  return repo.getFxRates();
});

/// Pending executive approvals for the active entity —
/// GET /api/approvals/pending. Errors resolve to an empty list (the
/// endpoint has not shipped on the backend yet), so the multi-sig banner
/// simply stays hidden until approvals exist.
final pendingApprovalsProvider =
    FutureProvider.autoDispose<List<PendingApproval>>((ref) async {
  final entity = ref.watch(activeEntityProvider);
  if (entity == null) {
    throw StateError('No active entity selected.');
  }
  final repo = ref.watch(treasuryRepositoryProvider);
  return repo.getPendingApprovals(entityId: entity.id);
});

/// Derived hero-card metrics (burn rate, runway, 30D inflow, NGN equivalent,
/// vault count) computed purely from the live data above. A failure in any
/// upstream call surfaces here as an error state scoped to the hero card.
final treasuryMetricsProvider = FutureProvider.autoDispose<TreasuryMetrics>((ref) async {
  final entity = ref.watch(activeEntityProvider);
  if (entity == null) {
    throw StateError('No active entity selected.');
  }
  final repo = ref.watch(treasuryRepositoryProvider);

  final balance = await repo.getBalance(entityId: entity.id);
  final history = await repo.getHistory(entityId: entity.id);
  final accounts = await repo.getAccounts(entityId: entity.id);
  final rates = await repo.getFxRates();

  FxRate? usdRate;
  for (final rate in rates) {
    if (rate.currency == 'USD') {
      usdRate = rate;
      break;
    }
  }

  return computeTreasuryMetrics(
    balance: balance.balance,
    currency: balance.currency,
    history: history,
    vaultCount: accounts.length,
    rateToNgn: usdRate?.rateToNgn,
  );
});
