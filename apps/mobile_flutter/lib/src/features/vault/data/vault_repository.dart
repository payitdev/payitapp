import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';
import '../domain/vault_models.dart';

class VaultRepository {
  final ProximApiClient _apiClient;

  VaultRepository({ProximApiClient? apiClient}) : _apiClient = apiClient ?? ProximApiClient();

  /// GET /api/savings/summary — overall balance, APY, and strategy breakdown
  Future<SavingsSummary> getSummary() async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>('/api/savings/summary');
      final data = response.data;
      if (data != null) {
        return SavingsSummary.fromJson(data);
      }
      throw const ProximException('Unable to load savings summary.');
    } catch (e) {
      if (ApiConfig.isDemoMode) return SavingsSummary.demo;
      rethrow;
    }
  }

  /// Deposit into a savings strategy / pod vault
  Future<void> deposit({
    required String strategyId,
    required double amount,
    required String currency,
  }) async {
    await _apiClient.post<Map<String, dynamic>>(
      '/api/savings/deposit',
      data: {'strategyId': strategyId, 'amount': amount, 'currency': currency},
    );
  }

  /// Withdraw from a savings strategy / pod vault
  Future<void> withdraw({
    required String strategyId,
    required double amount,
    required String currency,
  }) async {
    await _apiClient.post<Map<String, dynamic>>(
      '/api/savings/withdraw',
      data: {'strategyId': strategyId, 'amount': amount, 'currency': currency},
    );
  }

  /// Live yield routes with APYs across Kamino + NEAR Intent Earn —
  /// GET /api/kamino/yield-options. Returns an empty list when the
  /// service is unavailable so the UI can fall back to '—'.
  Future<List<VaultYieldOption>> getYieldOptions() async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>('/api/kamino/yield-options');
      final data = response.data;
      if (data != null && data['options'] is List) {
        return (data['options'] as List)
            .map((o) => VaultYieldOption.fromJson(o as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  /// Auto-save configuration for an entity — GET /api/kamino/auto-save.
  /// Falls back to disabled when unavailable so the badge never claims
  /// a state we could not verify.
  Future<AutoSaveStatus> getAutoSave({required String entityId}) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/api/kamino/auto-save',
        queryParameters: {'entityId': entityId},
      );
      final data = response.data;
      if (data != null) {
        return AutoSaveStatus.fromJson(data);
      }
      return const AutoSaveStatus(enabled: false, liquidBufferUsd: 0);
    } catch (_) {
      return const AutoSaveStatus(enabled: false, liquidBufferUsd: 0);
    }
  }
}
