import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';
import '../domain/card_models.dart';

class CardsRepository {
  final ProximApiClient _apiClient;

  CardsRepository({ProximApiClient? apiClient}) : _apiClient = apiClient ?? ProximApiClient();

  /// Fetch all cards for the active entity
  Future<List<ProximCard>> getCards() async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>('/api/cards');
      final data = response.data;
      if (data != null && data['cards'] is List && (data['cards'] as List).isNotEmpty) {
        return (data['cards'] as List)
            .map((c) => ProximCard.fromJson(c as Map<String, dynamic>))
            .toList();
      }
      if (ApiConfig.isDemoMode) return demoCards();
      return [];
    } catch (e) {
      if (ApiConfig.isDemoMode) return demoCards();
      rethrow;
    }
  }

  /// Fetch transactions for a specific card
  Future<List<CardTransaction>> getCardTransactions(String cardId) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/api/cards/$cardId/transactions',
      );
      final data = response.data;
      if (data != null && data['transactions'] is List) {
        return (data['transactions'] as List)
            .map((t) => CardTransaction.fromJson(t as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      if (ApiConfig.isDemoMode) return _demoTransactions();
      rethrow;
    }
  }

  /// Freeze or unfreeze a card
  Future<ProximCard> toggleFreeze(String cardId, {required bool freeze}) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '/api/cards/$cardId/${freeze ? 'freeze' : 'unfreeze'}',
    );
    final data = response.data;
    if (data != null && data['card'] != null) {
      return ProximCard.fromJson(data['card'] as Map<String, dynamic>);
    }
    throw const ProximException('Unable to update card status. Please try again.');
  }

  /// Top up a card with funds
  Future<void> topUpCard(String cardId, double amount, String currency) async {
    await _apiClient.post<Map<String, dynamic>>(
      '/api/cards/$cardId/top-up',
      data: {'amount': amount, 'currency': currency},
    );
  }

  // ── Demo fallbacks ─────────────────────────────────────────────────────────
  static List<ProximCard> demoCards() => [
        const ProximCard(
          id: 'card_demo_01',
          holderName: 'Alex Morgan',
          lastFour: '4829',
          expiryMonth: '08',
          expiryYear: '29',
          network: 'VISA',
          status: 'ACTIVE',
          balance: 1250.00,
          currency: 'USD',
        ),
      ];

  static List<CardTransaction> _demoTransactions() => [
        CardTransaction(
          id: 'ctx-1',
          description: 'Netflix Subscription',
          amount: 19.99,
          currency: 'USD',
          timestamp: DateTime.now().subtract(const Duration(days: 1)),
          type: 'DEBIT',
        ),
        CardTransaction(
          id: 'ctx-2',
          description: 'Apple Store',
          amount: 129.00,
          currency: 'USD',
          timestamp: DateTime.now().subtract(const Duration(days: 3)),
          type: 'DEBIT',
        ),
        CardTransaction(
          id: 'ctx-3',
          description: 'Card Top-up',
          amount: 500.00,
          currency: 'USD',
          timestamp: DateTime.now().subtract(const Duration(days: 5)),
          type: 'CREDIT',
        ),
      ];
}
