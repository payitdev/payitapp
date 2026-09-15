import 'package:flutter/foundation.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';
import '../domain/transfers_models.dart';

class TransfersRepository {
  final ProximApiClient _apiClient;

  TransfersRepository({ProximApiClient? apiClient}) : _apiClient = apiClient ?? ProximApiClient();

  /// Fetch Live Guaranteed FX Quote
  Future<FxQuote> getFxQuote({
    required String fromCurrency,
    required String toCurrency,
    required double fromAmount,
  }) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/api/transfers/fx-quote',
        queryParameters: {
          'fromCurrency': fromCurrency,
          'toCurrency': toCurrency,
          'fromAmount': fromAmount,
        },
      );

      final data = response.data;
      if (data != null && data['quote'] != null) {
        return FxQuote.fromJson(data['quote'] as Map<String, dynamic>);
      }
      throw const ProximException('Invalid FX quote response from server.');
    } catch (e) {
      if (ApiConfig.isDemoMode) {
        debugPrint('[TransfersRepository] Demo mode: using fallback FX rate.');
        final rate = fromCurrency == 'USD' && toCurrency == 'NGN'
            ? 1595.20
            : (fromCurrency == 'NGN' && toCurrency == 'USD' ? 1 / 1595.20 : 1.0);
        return FxQuote(
          fromCurrency: fromCurrency,
          toCurrency: toCurrency,
          fromAmount: fromAmount,
          toAmount: fromAmount * rate,
          rate: rate,
          validForSeconds: 15,
          feeAmount: 0.0,
          rail: 'Proxim Instant OTC Clearing',
        );
      }
      rethrow;
    }
  }

  /// Execute Send / Payout — path: POST /api/transfers/execute
  Future<TransferReceipt> sendTransfer({
    required String recipientName,
    required double amount,
    required String currency,
    required String rail,
    String? note,
  }) async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        '/api/transfers/execute',
        data: {
          'recipientName': recipientName,
          'amount': amount,
          'currency': currency,
          'rail': rail,
          'note': note,
        },
      );

      final data = response.data;
      if (data != null && data['transfer'] != null) {
        return TransferReceipt.fromJson(data['transfer'] as Map<String, dynamic>);
      }
      throw const ProximException('We couldn\'t complete your payment. Please try again.');
    } catch (e) {
      if (ApiConfig.isDemoMode) {
        debugPrint('[TransfersRepository] Demo mode: using mock transfer receipt.');
        return TransferReceipt(
          id: 'tx_${DateTime.now().millisecondsSinceEpoch}',
          referenceNumber: 'PX-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
          recipientName: recipientName,
          amount: amount,
          currency: currency,
          status: 'CLEARED',
          timestamp: DateTime.now(),
          rail: rail,
        );
      }
      rethrow;
    }
  }

  /// Execute Instant Dual-Vault Currency Swap — path: POST /api/transfers/internal
  Future<TransferReceipt> internalConvert({
    required String fromCurrency,
    required String toCurrency,
    required double fromAmount,
    required double toAmount,
  }) async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        '/api/transfers/internal',
        data: {
          'fromCurrency': fromCurrency,
          'toCurrency': toCurrency,
          'fromAmount': fromAmount,
          'toAmount': toAmount,
        },
      );

      final data = response.data;
      if (data != null && data['transfer'] != null) {
        return TransferReceipt.fromJson(data['transfer'] as Map<String, dynamic>);
      }
      throw const ProximException('Currency conversion could not be completed. Please try again.');
    } catch (e) {
      if (ApiConfig.isDemoMode) {
        debugPrint('[TransfersRepository] Demo mode: using mock convert receipt.');
        return TransferReceipt(
          id: 'swp_${DateTime.now().millisecondsSinceEpoch}',
          referenceNumber: 'SWP-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
          recipientName: '$toCurrency Vault',
          amount: toAmount,
          currency: toCurrency,
          status: 'CLEARED',
          timestamp: DateTime.now(),
          rail: 'Algorithmic Liquidity Rail',
        );
      }
      rethrow;
    }
  }

  /// Fetch paginated transfer history
  Future<List<TransferHistoryItem>> getHistory({int limit = 20, int offset = 0}) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/api/transfers/history',
        queryParameters: {'limit': limit, 'offset': offset},
      );

      final data = response.data;
      if (data != null && data['transfers'] is List) {
        return (data['transfers'] as List)
            .map((t) => TransferHistoryItem.fromJson(t as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      if (ApiConfig.isDemoMode) {
        debugPrint('[TransfersRepository] Demo mode: using mock history.');
        return _demoHistory();
      }
      rethrow;
    }
  }

  /// Fetch consolidated balance across all currencies
  Future<TransfersBalance> getBalance() async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>('/api/transfers/balance');
      final data = response.data;
      if (data != null) {
        return TransfersBalance.fromJson(data);
      }
      throw const ProximException('Unable to load balance. Please try again.');
    } catch (e) {
      if (ApiConfig.isDemoMode) {
        debugPrint('[TransfersRepository] Demo mode: using mock balance.');
        return const TransfersBalance(
          totalUsd: 48250.00,
          byCurrency: {'USD': 35850.00, 'NGN': 19800000.00, 'EUR': 2500.00},
        );
      }
      rethrow;
    }
  }

  static List<TransferHistoryItem> _demoHistory() => [
        TransferHistoryItem(
          id: 'tx_1',
          title: 'Sent to David Miller',
          subtitle: 'Today, 14:24',
          amount: 250.00,
          currency: 'USD',
          type: 'SENT',
          status: 'CLEARED',
          timestamp: DateTime.now(),
        ),
        TransferHistoryItem(
          id: 'tx_2',
          title: 'Received from Sarah Jenkins',
          subtitle: 'Yesterday',
          amount: 1200.00,
          currency: 'USD',
          type: 'RECEIVED',
          status: 'CLEARED',
          timestamp: DateTime.now().subtract(const Duration(days: 1)),
        ),
        TransferHistoryItem(
          id: 'tx_3',
          title: 'Kamino Yield Payout',
          subtitle: '3 days ago',
          amount: 42.50,
          currency: 'USD',
          type: 'YIELD',
          status: 'CLEARED',
          timestamp: DateTime.now().subtract(const Duration(days: 3)),
        ),
      ];
}
