class FxQuote {
  final String fromCurrency;
  final String toCurrency;
  final double fromAmount;
  final double toAmount;
  final double rate;
  final int validForSeconds;
  final double feeAmount;
  final String rail;

  const FxQuote({
    required this.fromCurrency,
    required this.toCurrency,
    required this.fromAmount,
    required this.toAmount,
    required this.rate,
    required this.validForSeconds,
    this.feeAmount = 0.0,
    required this.rail,
  });

  factory FxQuote.fromJson(Map<String, dynamic> json) {
    return FxQuote(
      fromCurrency: json['fromCurrency'] as String? ?? 'USD',
      toCurrency: json['toCurrency'] as String? ?? 'NGN',
      fromAmount: (json['fromAmount'] as num?)?.toDouble() ?? 1.0,
      toAmount: (json['toAmount'] as num?)?.toDouble() ?? 1595.20,
      rate: (json['rate'] as num?)?.toDouble() ?? 1595.20,
      validForSeconds: json['validForSeconds'] as int? ?? 15,
      feeAmount: (json['feeAmount'] as num?)?.toDouble() ?? 0.0,
      rail: json['rail'] as String? ?? 'DEEP_OTC',
    );
  }
}

class TransferReceipt {
  final String id;
  final String referenceNumber;
  final String recipientName;
  final double amount;
  final String currency;
  final String status; // 'CLEARED' | 'PENDING' | 'FAILED'
  final DateTime timestamp;
  final String rail;

  const TransferReceipt({
    required this.id,
    required this.referenceNumber,
    required this.recipientName,
    required this.amount,
    required this.currency,
    required this.status,
    required this.timestamp,
    required this.rail,
  });

  factory TransferReceipt.fromJson(Map<String, dynamic> json) {
    return TransferReceipt(
      id: json['id'] as String? ?? '',
      referenceNumber: json['referenceNumber'] as String? ?? 'PX-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
      recipientName: json['recipientName'] as String? ?? 'Recipient',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String? ?? 'USD',
      status: json['status'] as String? ?? 'CLEARED',
      timestamp: json['timestamp'] != null ? DateTime.tryParse(json['timestamp'] as String) ?? DateTime.now() : DateTime.now(),
      rail: json['rail'] as String? ?? 'Instant Settlement Rail',
    );
  }
}
