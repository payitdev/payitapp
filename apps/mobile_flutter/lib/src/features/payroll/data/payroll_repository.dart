import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';

class PayrollRecipient {
  final String name;
  final String accountOrPhone;
  final String? bankOrNetwork;
  final double amount;

  const PayrollRecipient({
    required this.name,
    required this.accountOrPhone,
    this.bankOrNetwork,
    required this.amount,
  });

  Map<String, dynamic> toJson() => {
        'name': name,
        'accountOrPhone': accountOrPhone,
        if (bankOrNetwork != null) 'bankOrNetwork': bankOrNetwork,
        'amount': amount,
      };

  factory PayrollRecipient.fromJson(Map<String, dynamic> json) {
    final amt = json['amount'];
    return PayrollRecipient(
      name: json['recipientName'] as String? ?? json['name'] as String? ?? 'Employee',
      accountOrPhone: json['recipientAccountOrPhone'] as String? ?? json['accountOrPhone'] as String? ?? '',
      bankOrNetwork: json['bankOrNetwork'] as String?,
      amount: amt is num ? amt.toDouble() : (double.tryParse(amt?.toString() ?? '0') ?? 0.0),
    );
  }
}

class PayrollRunRecord {
  final String id;
  final String title;
  final double totalAmount;
  final String currency;
  final String status;
  final int employeeCount;
  final DateTime createdAt;
  final List<PayrollRecipient> recipients;

  const PayrollRunRecord({
    required this.id,
    required this.title,
    required this.totalAmount,
    required this.currency,
    required this.status,
    required this.employeeCount,
    required this.createdAt,
    required this.recipients,
  });

  factory PayrollRunRecord.fromJson(Map<String, dynamic> json) {
    final total = json['totalAmount'];
    final items = json['items'] as List? ?? [];
    return PayrollRunRecord(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Payroll Disbursement',
      totalAmount: total is num ? total.toDouble() : (double.tryParse(total?.toString() ?? '0') ?? 0.0),
      currency: json['currency'] as String? ?? 'NGN',
      status: (json['status'] as String? ?? 'PENDING').toUpperCase(),
      employeeCount: json['employeeCount'] as int? ?? json['recipientsCount'] as int? ?? items.length,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      recipients: items.map((i) => PayrollRecipient.fromJson(i as Map<String, dynamic>)).toList(),
    );
  }
}

class PayrollRepository {
  final ProximApiClient _apiClient;

  PayrollRepository({ProximApiClient? apiClient}) : _apiClient = apiClient ?? ProximApiClient();

  /// List all past payroll runs for an entity
  Future<List<PayrollRunRecord>> getPayrollRuns({required String entityId}) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/api/payroll',
        queryParameters: {'entityId': entityId},
      );
      final data = response.data;
      if (data != null && data['runs'] is List) {
        return (data['runs'] as List)
            .map((r) => PayrollRunRecord.fromJson(r as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      if (ApiConfig.isDemoMode) {
        return [
          PayrollRunRecord(
            id: 'pr_run_1',
            title: 'Engineering & Ops Payroll',
            totalAmount: 1850000.0,
            currency: 'NGN',
            status: 'COMPLETED',
            employeeCount: 4,
            createdAt: DateTime.now().subtract(const Duration(days: 14)),
            recipients: const [
              PayrollRecipient(name: 'David Okafor', accountOrPhone: '0123456789', amount: 650000),
              PayrollRecipient(name: 'Amina Bello', accountOrPhone: '0987654321', amount: 500000),
              PayrollRecipient(name: 'Chidi Eze', accountOrPhone: '0234567891', amount: 450000),
              PayrollRecipient(name: 'Tunde Bakare', accountOrPhone: '0345678912', amount: 250000),
            ],
          ),
        ];
      }
      rethrow;
    }
  }

  /// Execute a payroll run
  Future<PayrollRunRecord> executePayroll({
    required String entityId,
    required String title,
    required String currency,
    required List<PayrollRecipient> recipients,
  }) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '/api/payroll/run',
      data: {
        'entityId': entityId,
        'title': title,
        'currency': currency,
        'recipients': recipients.map((r) => r.toJson()).toList(),
      },
    );
    final data = response.data;
    if (data != null && data['payrollRun'] != null) {
      return PayrollRunRecord.fromJson(data['payrollRun'] as Map<String, dynamic>);
    }
    throw const ProximException('Payroll execution failed. Please check recipient accounts.');
  }
}
