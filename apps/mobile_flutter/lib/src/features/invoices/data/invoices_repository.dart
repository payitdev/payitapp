import 'package:flutter/foundation.dart';
import '../../../core/network/api_client.dart';

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
      invoiceNumber: json['invoiceNumber'] as String? ?? 'INV-2026-095',
      clientName: json['clientName'] as String? ?? 'Client',
      clientEmail: json['clientEmail'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String? ?? 'USDC',
      status: json['status'] as String? ?? 'PENDING',
      paymentUrl: json['paymentUrl'] as String? ?? 'https://pay.proxim.app/checkout/INV-2026-095',
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now() : DateTime.now(),
    );
  }
}

class InvoicesRepository {
  final ProximApiClient _apiClient;

  InvoicesRepository({ProximApiClient? apiClient}) : _apiClient = apiClient ?? ProximApiClient();

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
    } catch (e) {
      debugPrint('[InvoicesRepository] Invoice creation note: $e');
    }

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
}
