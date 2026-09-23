import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_provider.dart';
import '../data/transfers_repository.dart';
import '../domain/transfers_models.dart';

final transfersRepositoryProvider = Provider<TransfersRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return TransfersRepository(apiClient: apiClient);
});

/// Live FX quote — auto-disposes when not in use
final fxQuoteProvider = FutureProvider.autoDispose
    .family<FxQuote, ({String from, String to, double amount})>((ref, arg) async {
  final repo = ref.watch(transfersRepositoryProvider);
  return repo.getFxQuote(
    fromCurrency: arg.from,
    toCurrency: arg.to,
    fromAmount: arg.amount,
  );
});

/// Consolidated balance for the home screen balance card
final transfersBalanceProvider = FutureProvider.autoDispose<TransfersBalance>((ref) async {
  final repo = ref.watch(transfersRepositoryProvider);
  return repo.getBalance();
});

/// Paginated transfer history for the activity feed
final transfersHistoryProvider =
    FutureProvider.autoDispose<List<TransferHistoryItem>>((ref) async {
  final repo = ref.watch(transfersRepositoryProvider);
  return repo.getHistory(limit: 30);
});
