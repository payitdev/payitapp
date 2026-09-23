import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_provider.dart';
import '../data/cards_repository.dart';
import '../domain/card_models.dart';

final cardsRepositoryProvider = Provider<CardsRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return CardsRepository(apiClient: apiClient);
});

/// All cards for the active entity
final cardsListProvider = FutureProvider.autoDispose<List<ProximCard>>((ref) async {
  final repo = ref.watch(cardsRepositoryProvider);
  return repo.getCards();
});

/// Transactions for a specific card
final cardTransactionsProvider =
    FutureProvider.autoDispose.family<List<CardTransaction>, String>((ref, cardId) async {
  final repo = ref.watch(cardsRepositoryProvider);
  return repo.getCardTransactions(cardId);
});
