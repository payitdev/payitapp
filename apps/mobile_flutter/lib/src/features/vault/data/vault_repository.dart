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

  /// Lock funds into a yield vault — POST /api/kamino/lock.
  /// Requires a 6-digit transaction PIN; lockDurationDays must be one of
  /// 30, 60, 90, or 365 (the backend does not support flexible locks).
  Future<void> deposit({
    required String entityId,
    required String vaultId,
    required double amountUsd,
    required int lockDurationDays,
    required String passcode,
    String strategy = 'kamino',
  }) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '/api/kamino/lock',
      data: {
        'entityId': entityId,
        'vaultId': vaultId,
        'amountUsd': amountUsd,
        'lockDurationDays': lockDurationDays,
        'strategy': strategy,
        'passcode': passcode,
      },
    );
    final data = response.data;
    if (data == null || data['success'] != true) {
      throw ProximException(
        data?['error']?.toString() ?? 'Unable to lock funds. Please try again.',
      );
    }
  }

  /// Withdraw a matured savings position — POST /api/kamino/withdraw.
  Future<void> withdraw({
    required String entityId,
    required String termVaultId,
    required String passcode,
  }) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '/api/kamino/withdraw',
      data: {'entityId': entityId, 'termVaultId': termVaultId, 'passcode': passcode},
    );
    final data = response.data;
    if (data == null || data['success'] != true) {
      throw ProximException(
        data?['error']?.toString() ?? 'Unable to withdraw. Please try again.',
      );
    }
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

  /// Locked positions for an entity — GET /api/kamino/positions/:entityId.
  Future<List<SavingsPosition>> getPositions({required String entityId}) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      '/api/kamino/positions/$entityId',
    );
    final data = response.data;
    if (data != null && data['positions'] is List) {
      return (data['positions'] as List)
          .map((p) => SavingsPosition.fromJson(p as Map<String, dynamic>))
          .toList();
    }
    return [];
  }
}
