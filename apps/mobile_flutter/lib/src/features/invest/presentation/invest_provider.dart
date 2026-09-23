import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_provider.dart';
import '../data/invest_repository.dart';
import '../domain/invest_models.dart';

final investRepositoryProvider = Provider<InvestRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return InvestRepository(apiClient: apiClient);
});

/// All available Ondo stocks / watchlist
final ondoStocksProvider = FutureProvider.autoDispose<List<OndoStock>>((ref) async {
  final repo = ref.watch(investRepositoryProvider);
  return repo.getStocks();
});

/// Positions for the currently active entity
final ondoPositionsProvider = FutureProvider.autoDispose<List<OndoPosition>>((ref) async {
  final entity = ref.watch(activeEntityProvider);
  if (entity == null) return [];
  final repo = ref.watch(investRepositoryProvider);
  return repo.getPositions(entity.id);
});

/// Computed portfolio summary derived from live positions
final portfolioSummaryProvider = Provider.autoDispose<InvestPortfolioSummary>((ref) {
  final positionsAsync = ref.watch(ondoPositionsProvider);
  return positionsAsync.maybeWhen(
    data: InvestPortfolioSummary.fromPositions,
    orElse: () => const InvestPortfolioSummary(totalValue: 0, totalGain: 0, totalGainPercent: 0),
  );
});
