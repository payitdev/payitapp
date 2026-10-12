import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';
import '../../transfers/domain/transfers_models.dart';
import '../domain/treasury_models.dart';

/// Balance sheet & cashflow report from GET /api/reports/balance-sheet.
/// The backend returns a nested statement; this model flattens the figures
/// the app surfaces. Missing sections parse as real zeros.
class BalanceSheetData {
  /// performance.netOperatingIncome — collected revenue minus operating
  /// expenses and tax provision for the period.
  final double netOperatingSurplus;

  /// revenueAndReceivables.totalCollected — cash actually collected.
  final double totalInflows;

  /// performance.totalExpenses — payroll + vendor payouts + platform fees.
  final double totalOutflows;

  /// performance.profitMarginPercent.
  final double profitMarginPercent;

  final double totalCurrentAssets;
  final double cashEquivalents;
  final double accountsReceivable;
  final double vaultHoldings;
  final double tokenizedAssets;
  final double totalAssets;

  final double totalCurrentLiabilities;
  final double accruedPayroll;
  final double taxPayable;
  final double totalLiabilities;
  final double totalOwnerEquity;

  final double totalBilled;
  final double totalOutstanding;
  final double totalOverdue;

  final String businessName;
  final String periodLabel;

  const BalanceSheetData({
    required this.netOperatingSurplus,
    required this.totalInflows,
    required this.totalOutflows,
    required this.profitMarginPercent,
    required this.totalCurrentAssets,
    required this.cashEquivalents,
    required this.accountsReceivable,
    required this.vaultHoldings,
    required this.tokenizedAssets,
    required this.totalAssets,
    required this.totalCurrentLiabilities,
    required this.accruedPayroll,
    required this.taxPayable,
    required this.totalLiabilities,
    required this.totalOwnerEquity,
    required this.totalBilled,
    required this.totalOutstanding,
    required this.totalOverdue,
    required this.businessName,
    required this.periodLabel,
  });

  /// All-zeros stand-in — only used when DEMO_MODE=true and the (offline)
  /// report fetch fails, so demo mode renders honest zeros rather than
  /// fabricated figures.
  static const BalanceSheetData empty = BalanceSheetData(
    netOperatingSurplus: 0,
    totalInflows: 0,
    totalOutflows: 0,
    profitMarginPercent: 0,
    totalCurrentAssets: 0,
    cashEquivalents: 0,
    accountsReceivable: 0,
    vaultHoldings: 0,
    tokenizedAssets: 0,
    totalAssets: 0,
    totalCurrentLiabilities: 0,
    accruedPayroll: 0,
    taxPayable: 0,
    totalLiabilities: 0,
    totalOwnerEquity: 0,
    totalBilled: 0,
    totalOutstanding: 0,
    totalOverdue: 0,
    businessName: '',
    periodLabel: '',
  );

  static double _num(Map<String, dynamic>? json, String key) =>
      (json?[key] as num?)?.toDouble() ?? 0;

  static Map<String, dynamic>? _map(Map<String, dynamic>? json, String key) =>
      json?[key] as Map<String, dynamic>?;

  factory BalanceSheetData.fromJson(Map<String, dynamic> json) {
    final performance = _map(json, 'performance');
    final revenue = _map(json, 'revenueAndReceivables');
    final balanceSheet = _map(json, 'balanceSheet');
    final assets = _map(balanceSheet, 'assets');
    final currentAssets = _map(assets, 'currentAssets');
    final nonCurrentAssets = _map(assets, 'nonCurrentAssets');
    final liabilities = _map(balanceSheet, 'liabilities');
    final currentLiabilities = _map(liabilities, 'currentLiabilities');
    final equity = _map(balanceSheet, 'equity');
    final business = _map(json, 'business');
    final period = _map(json, 'period');

    return BalanceSheetData(
      netOperatingSurplus: _num(performance, 'netOperatingIncome'),
      totalInflows: _num(revenue, 'totalCollected'),
      totalOutflows: _num(performance, 'totalExpenses'),
      profitMarginPercent: _num(performance, 'profitMarginPercent'),
      totalCurrentAssets: _num(currentAssets, 'total'),
      cashEquivalents: _num(currentAssets, 'liquidCash'),
      accountsReceivable: _num(currentAssets, 'accountsReceivable'),
      vaultHoldings: _num(nonCurrentAssets, 'vaultHoldings'),
      tokenizedAssets: _num(nonCurrentAssets, 'tokenizedAssets'),
      totalAssets: _num(assets, 'totalAssets'),
      totalCurrentLiabilities: _num(currentLiabilities, 'total'),
      accruedPayroll: _num(currentLiabilities, 'pendingPayroll'),
      taxPayable: _num(currentLiabilities, 'taxPayable'),
      totalLiabilities: _num(liabilities, 'totalLiabilities'),
      totalOwnerEquity: _num(equity, 'totalOwnerEquity'),
      totalBilled: _num(revenue, 'totalBilled'),
      totalOutstanding: _num(revenue, 'totalOutstanding'),
      totalOverdue: _num(revenue, 'totalOverdue'),
      businessName: business?['legalName'] as String? ?? '',
      periodLabel: period?['label'] as String? ?? '',
    );
  }
}

class TreasuryRepository {
  final ProximApiClient _apiClient;

  TreasuryRepository({ProximApiClient? apiClient}) : _apiClient = apiClient ?? ProximApiClient();

  Future<BalanceSheetData> getBalanceSheet({
    required String entityId,
    String period = 'this_month',
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
      if (ApiConfig.isDemoMode) return BalanceSheetData.empty;
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
  /// GET /api/transfers/history. Defaults to 200 items so the derived
  /// burn-rate / runway / 30-day-inflow metrics have real depth.
  Future<List<TreasuryTransaction>> getHistory({
    required String entityId,
    int limit = 200,
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

  /// Approvals for an entity, optionally filtered by status —
  /// GET /api/approvals. [status] is one of PENDING / APPROVED / REJECTED /
  /// EXECUTED / EXPIRED; null returns approvals of every status.
  Future<List<PendingApproval>> getApprovals({
    required String entityId,
    String? status,
  }) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      '/api/approvals',
      queryParameters: {
        'entityId': entityId,
        'status': ?status,
      },
    );

    final data = response.data;
    if (data != null && data['approvals'] is List) {
      return (data['approvals'] as List)
          .map((a) => PendingApproval.fromJson(a as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  /// Create a multi-sig approval request with its signer slots —
  /// POST /api/approvals. Returns the created approval (201).
  Future<PendingApproval> createApproval({
    required String entityId,
    required String title,
    required double amount,
    String? description,
    String currency = 'USDC',
    int? requiredSignatures,
    required List<({String label, String? keyNote})> signers,
  }) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '/api/approvals',
      data: {
        'entityId': entityId,
        'title': title,
        'description': description,
        'amount': amount,
        'currency': currency,
        'requiredSignatures': requiredSignatures,
        'signers': [
          for (final signer in signers)
            {
              'label': signer.label,
              'keyNote': signer.keyNote,
            },
        ],
      },
    );

    final data = response.data;
    if (data != null && data['approval'] != null) {
      return PendingApproval.fromJson(data['approval'] as Map<String, dynamic>);
    }
    throw const ProximException('Unable to create the approval. Please try again.');
  }

  /// Sign (or reject) a signer slot on an approval —
  /// POST /api/approvals/:id/sign. The backend flips the approval to
  /// APPROVED once the signature threshold is met (REJECTED when any
  /// signer rejects) and returns the updated approval.
  Future<PendingApproval> signApproval(
    String approvalId,
    String signerId, {
    bool reject = false,
  }) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '/api/approvals/$approvalId/sign',
      data: {
        'signerId': signerId,
        'action': reject ? 'reject' : 'sign',
      },
    );

    final data = response.data;
    if (data != null && data['approval'] != null) {
      return PendingApproval.fromJson(data['approval'] as Map<String, dynamic>);
    }
    throw const ProximException('Unable to record your signature. Please try again.');
  }

  /// Pending executive approvals — GET /api/approvals/pending.
  ///
  /// The dashboard banner degrades gracefully: a failing approvals service
  /// means there is nothing to surface, so any error is treated as an
  /// empty list rather than propagating to the UI.
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
