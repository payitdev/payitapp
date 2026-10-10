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
  final String? merchantName;
  final String? merchantEvmAddress;
  final String? merchantSolanaAddress;
  final String? onlineCheckoutUrl;

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
    this.merchantName,
    this.merchantEvmAddress,
    this.merchantSolanaAddress,
    this.onlineCheckoutUrl,
  });

  factory ProximInvoice.fromJson(Map<String, dynamic> json) {
    final paymentData = json['paymentData'] is Map<String, dynamic>
        ? json['paymentData'] as Map<String, dynamic>
        : (json['paymentDetails'] is Map<String, dynamic> ? json['paymentDetails'] as Map<String, dynamic> : null);
    final total = json['amount'] ?? json['totalAmount'];

    return ProximInvoice(
      id: json['id'] as String? ?? '',
      invoiceNumber: json['invoiceNumber'] as String? ?? json['tag'] as String? ?? '',
      clientName: json['clientName'] as String? ?? 'Client',
      clientEmail: json['clientEmail'] as String? ?? '',
      amount: total is num ? total.toDouble() : (double.tryParse(total?.toString() ?? '0') ?? 0.0),
      currency: json['currency'] as String? ?? 'USDC',
      status: json['status'] as String? ?? 'PENDING',
      paymentUrl: json['paymentUrl'] as String? ?? paymentData?['link'] as String? ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      merchantName: json['merchantName'] as String?,
      merchantEvmAddress: json['merchantEvmAddress'] as String?,
      merchantSolanaAddress: json['merchantSolanaAddress'] as String?,
      onlineCheckoutUrl: paymentData?['onlineCheckoutUrl'] as String?,
    );
  }
}

class InvoicesRepository {
  final ProximApiClient _apiClient;

  InvoicesRepository({ProximApiClient? apiClient}) : _apiClient = apiClient ?? ProximApiClient();

  /// Fetch all invoices for an entity
  Future<List<ProximInvoice>> getInvoices({required String entityId}) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      '/api/invoices',
      queryParameters: {'entityId': entityId},
    );
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

  /// Fetch a public invoice by ID or tag
  Future<ProximInvoice> getPublicInvoice(String invoiceId) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/api/invoices/public/$invoiceId',
      );
      final data = response.data;
      if (data != null && data['invoice'] != null) {
        return ProximInvoice.fromJson(data['invoice'] as Map<String, dynamic>);
      }
      throw const ProximException('Invoice not found.');
    } catch (e) {
      if (ApiConfig.isDemoMode) {
        return ProximInvoice(
          id: invoiceId,
          invoiceNumber: invoiceId.startsWith('INV-') ? invoiceId : 'INV-2026-095',
          clientName: 'Acme Corp Inc',
          clientEmail: 'billing@acmecorp.com',
          amount: 12500.0,
          currency: 'USDC',
          status: 'PENDING',
          paymentUrl: 'https://pay.proxim.app/checkout/$invoiceId',
          createdAt: DateTime.now(),
          merchantName: 'Proxim Business Treasury',
          merchantEvmAddress: '0x71C...B29F',
        );
      }
      rethrow;
    }
  }
}
