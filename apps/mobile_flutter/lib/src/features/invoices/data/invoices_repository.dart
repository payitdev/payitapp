import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';

class ProximInvoice {
  final String id;
  final String invoiceNumber;
  final String clientName;
  final String clientEmail;
  final double amount;
  final String currency;
  final String status;
  final String paymentUrl;
  final DateTime createdAt;

  const ProximInvoice({
    required this.id,
    required this.invoiceNumber,
    required this.clientName,
    required this.clientEmail,
    required this.amount,
    required this.currency,
    required this.status,
    required this.paymentUrl,
    required this.createdAt,
  });

  factory ProximInvoice.fromJson(Map<String, dynamic> json) {
    return ProximInvoice(
      id: json['id'] as String? ?? '',
      invoiceNumber: json['invoiceNumber'] as String? ?? '',
      clientName: json['clientName'] as String? ?? 'Client',
      clientEmail: json['clientEmail'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String? ?? 'USDC',
      status: json['status'] as String? ?? 'PENDING',
      paymentUrl: json['paymentUrl'] as String? ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

class InvoicesRepository {
  final ProximApiClient _apiClient;

  InvoicesRepository({ProximApiClient? apiClient}) : _apiClient = apiClient ?? ProximApiClient();

  /// Fetch all invoices
  Future<List<ProximInvoice>> getInvoices() async {
    final response = await _apiClient.get<Map<String, dynamic>>('/api/invoices');
    final data = response.data;
    if (data != null && data['invoices'] is List) {
      return (data['invoices'] as List)
          .map((i) => ProximInvoice.fromJson(i as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  /// Create a new invoice
  Future<ProximInvoice> createInvoice({
    required String clientName,
    required String clientEmail,
    required double amount,
    required String currency,
    required List<String> acceptedRails,
  }) async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        '/api/invoices',
        data: {
          'clientName': clientName,
          'clientEmail': clientEmail,
          'amount': amount,
          'currency': currency,
          'acceptedRails': acceptedRails,
        },
      );
      final data = response.data;
      if (data != null && data['invoice'] != null) {
        return ProximInvoice.fromJson(data['invoice'] as Map<String, dynamic>);
      }
      throw const ProximException('Invoice creation failed. Please try again.');
    } catch (e) {
      if (ApiConfig.isDemoMode) {
        final invoiceNum = 'INV-2026-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
        return ProximInvoice(
          id: 'inv_${DateTime.now().millisecondsSinceEpoch}',
          invoiceNumber: invoiceNum,
          clientName: clientName,
          clientEmail: clientEmail,
          amount: amount,
          currency: currency,
          status: 'PENDING',
          paymentUrl: 'https://pay.proxim.app/checkout/$invoiceNum',
          createdAt: DateTime.now(),
        );
      }
      rethrow;
    }
  }
}
