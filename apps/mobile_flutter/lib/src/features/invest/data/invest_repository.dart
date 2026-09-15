import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';
import '../domain/invest_models.dart';

class InvestRepository {
  final ProximApiClient _apiClient;

  InvestRepository({ProximApiClient? apiClient}) : _apiClient = apiClient ?? ProximApiClient();

  /// Fetch all available stocks/tokens from Ondo
  Future<List<OndoStock>> getStocks() async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>('/api/ondo/stocks');
      final data = response.data;
      if (data != null && data['stocks'] is List) {
        return (data['stocks'] as List)
            .map((s) => OndoStock.fromJson(s as Map<String, dynamic>))
            .toList();
      }
      if (data != null && data['assets'] is List) {
        return (data['assets'] as List)
            .map((s) => OndoStock.fromJson(s as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      if (ApiConfig.isDemoMode) return _demoStocks();
      rethrow;
    }
  }

  /// Fetch positions held by the given entity
  Future<List<OndoPosition>> getPositions(String entityId) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/api/ondo/positions/$entityId',
      );
      final data = response.data;
      if (data != null && data['positions'] is List) {
        return (data['positions'] as List)
            .map((p) => OndoPosition.fromJson(p as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      if (ApiConfig.isDemoMode) return _demoPositions();
      rethrow;
    }
  }

  /// Buy an asset (market order)
  Future<void> buyStock({
    required String symbol,
    required double amountUsd,
    required String entityId,
  }) async {
    await _apiClient.post<Map<String, dynamic>>(
      '/api/ondo/buy',
      data: {'symbol': symbol, 'amountUsd': amountUsd, 'entityId': entityId},
    );
  }

  /// Sell a position
  Future<void> sellStock({
    required String symbol,
    required double shares,
    required String entityId,
  }) async {
    await _apiClient.post<Map<String, dynamic>>(
      '/api/ondo/sell',
      data: {'symbol': symbol, 'shares': shares, 'entityId': entityId},
    );
  }

  // ── Demo fallbacks ──────────────────────────────────────────────────────────
  static List<OndoStock> _demoStocks() => const [
        OndoStock(symbol: 'NVDA', name: 'NVIDIA Corp', price: 118.80, changePercent: 3.4, changeAmount: 3.90, currency: 'USD'),
        OndoStock(symbol: 'TSLA', name: 'Tesla Inc.', price: 214.20, changePercent: -1.2, changeAmount: -2.60, currency: 'USD'),
        OndoStock(symbol: 'MSFT', name: 'Microsoft Corp', price: 448.10, changePercent: 0.9, changeAmount: 4.00, currency: 'USD'),
        OndoStock(symbol: 'GOOGL', name: 'Alphabet Inc.', price: 178.40, changePercent: 2.1, changeAmount: 3.67, currency: 'USD'),
      ];

  static List<OndoPosition> _demoPositions() => const [
        OndoPosition(symbol: 'NVDA', name: 'NVIDIA Corp', shares: 15.5, avgCost: 105.20, currentPrice: 118.80, currency: 'USD'),
        OndoPosition(symbol: 'MSFT', name: 'Microsoft Corp', shares: 8.2, avgCost: 410.00, currentPrice: 448.10, currency: 'USD'),
      ];
}
