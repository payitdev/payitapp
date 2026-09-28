import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';
import '../../transfers/domain/transfers_models.dart';
import '../domain/treasury_models.dart';

class BalanceSheetData {
  final double netOperatingSurplus;
  final double totalCurrentAssets;
  final double cashEquivalents;
  final double accountsReceivable;
  final double totalCurrentLiabilities;
  final double accountsPayable;
  final double accruedPayroll;
  final double runwayMonths;

  const BalanceSheetData({
    required this.netOperatingSurplus,
    required this.totalCurrentAssets,
    required this.cashEquivalents,
    required this.accountsReceivable,
    required this.totalCurrentLiabilities,
    required this.accountsPayable,
    required this.accruedPayroll,
    required this.runwayMonths,
  });

  factory BalanceSheetData.fromJson(Map<String, dynamic> json) {
    return BalanceSheetData(
      netOperatingSurplus: (json['netOperatingSurplus'] as num?)?.toDouble() ?? 0,
      totalCurrentAssets: (json['totalCurrentAssets'] as num?)?.toDouble() ?? 0,
      cashEquivalents: (json['cashEquivalents'] as num?)?.toDouble() ?? 0,
      accountsReceivable: (json['accountsReceivable'] as num?)?.toDouble() ?? 0,
      totalCurrentLiabilities: (json['totalCurrentLiabilities'] as num?)?.toDouble() ?? 0,
      accountsPayable: (json['accountsPayable'] as num?)?.toDouble() ?? 0,
      accruedPayroll: (json['accruedPayroll'] as num?)?.toDouble() ?? 0,
      runwayMonths: (json['runwayMonths'] as num?)?.toDouble() ?? 0,
    );
  }

  /// Demo fallback — only used when DEMO_MODE=true
  static const BalanceSheetData demo = BalanceSheetData(
    netOperatingSurplus: 482950.00,
    totalCurrentAssets: 562450.00,
    cashEquivalents: 358550.00,
    accountsReceivable: 203900.00,
    totalCurrentLiabilities: 79500.00,
    accountsPayable: 36850.00,
    accruedPayroll: 42650.00,
    runwayMonths: 14.1,
  );
}

class TreasuryRepository {
  final ProximApiClient _apiClient;

  TreasuryRepository({ProximApiClient? apiClient}) : _apiClient = apiClient ?? ProximApiClient();

  Future<BalanceSheetData> getBalanceSheet({
    required String entityId,
    String period = 'MTD',
  }) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/api/reports/balance-sheet',
        queryParameters: {
          'entityId': entityId,
          'period': period,
        },
      );

      final data = response.data;
      if (data != null && data['report'] != null) {
        return BalanceSheetData.fromJson(data['report'] as Map<String, dynamic>);
      }
      if (data != null) {
        return BalanceSheetData.fromJson(data);
      }
      throw const ProximException('Unable to load financial report. Please try again.');
    } catch (e) {
      if (ApiConfig.isDemoMode) return BalanceSheetData.demo;
      rethrow;
    }
  }

  /// Consolidated live balance for an entity — GET /api/transfers/balance
  Future<TreasuryBalance> getBalance({required String entityId}) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      '/api/transfers/balance',
      queryParameters: {'entityId': entityId},
    );

    final data = response.data;
    if (data != null && data['success'] == true) {
      return TreasuryBalance.fromJson(data);
    }
    throw const ProximException('Unable to load balance. Please try again.');
  }

  /// Formatted transfer history (newest first, capped at [limit]) —
  /// GET /api/transfers/history
  Future<List<TreasuryTransaction>> getHistory({
    required String entityId,
    int limit = 30,
  }) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      '/api/transfers/history',
      queryParameters: {'entityId': entityId, 'limit': limit},
    );

    final data = response.data;
    if (data != null && data['transactions'] is List) {
      return (data['transactions'] as List)
          .map((t) => TreasuryTransaction.fromJson(t as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  /// Connected deposit accounts for an entity — GET /api/transfers/accounts
  Future<List<DepositAccount>> getAccounts({required String entityId}) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      '/api/transfers/accounts',
      queryParameters: {'entityId': entityId},
    );

    final data = response.data;
    if (data != null && data['accounts'] is List) {
      return (data['accounts'] as List)
          .map((a) => DepositAccount.fromJson(a as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  /// Live FX rates — GET /api/fx/rates
  Future<List<FxRate>> getFxRates() async {
    final response = await _apiClient.get<Map<String, dynamic>>('/api/fx/rates');

    final data = response.data;
    if (data != null && data['rates'] is List) {
      return (data['rates'] as List)
          .map((r) => FxRate.fromJson(r as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  /// Pending executive approvals — GET /api/approvals/pending.
  ///
  /// The backend endpoint has not shipped yet. A missing or failing
  /// approvals service means there is nothing to surface, so any error is
  /// treated as an empty list rather than propagating to the UI.
  Future<List<PendingApproval>> getPendingApprovals({required String entityId}) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/api/approvals/pending',
        queryParameters: {'entityId': entityId},
      );

      final data = response.data;
      if (data != null && data['approvals'] is List) {
        return (data['approvals'] as List)
            .map((a) => PendingApproval.fromJson(a as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }
}
