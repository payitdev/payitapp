// Domain models for GET /api/cards

class ProximCard {
  final String id;
  final String holderName;
  final String lastFour;
  final String expiryMonth;
  final String expiryYear;
  final String network; // 'VISA' | 'MASTERCARD'
  final String status;  // 'ACTIVE' | 'FROZEN' | 'TERMINATED'
  final double balance;
  final String currency;

  const ProximCard({
    required this.id,
    required this.holderName,
    required this.lastFour,
    required this.expiryMonth,
    required this.expiryYear,
    required this.network,
    required this.status,
    required this.balance,
    required this.currency,
  });

  bool get isFrozen => status == 'FROZEN';
  bool get isActive => status == 'ACTIVE';

  String get maskedNumber => '••••  ••••  ••••  $lastFour';
  String get expiryDisplay => '$expiryMonth/$expiryYear';

  factory ProximCard.fromJson(Map<String, dynamic> json) {
    return ProximCard(
      id: json['id'] as String? ?? '',
      holderName: json['holderName'] as String? ?? json['cardholderName'] as String? ?? 'Proxim User',
      lastFour: json['lastFour'] as String? ?? json['last4'] as String? ?? '0000',
      expiryMonth: json['expiryMonth'] as String? ?? '12',
      expiryYear: json['expiryYear'] as String? ?? '29',
      network: (json['network'] as String? ?? 'VISA').toUpperCase(),
      status: (json['status'] as String? ?? 'ACTIVE').toUpperCase(),
      balance: (json['balance'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String? ?? 'USD',
    );
  }
}

class CardTransaction {
  final String id;
  final String description;
  final double amount;
  final String currency;
  final DateTime timestamp;
  final String type; // 'DEBIT' | 'CREDIT'

  const CardTransaction({
    required this.id,
    required this.description,
    required this.amount,
    required this.currency,
    required this.timestamp,
    required this.type,
  });

  bool get isDebit => type == 'DEBIT';

  factory CardTransaction.fromJson(Map<String, dynamic> json) {
    return CardTransaction(
      id: json['id'] as String? ?? '',
      description: json['description'] as String? ?? json['merchant'] as String? ?? 'Card transaction',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String? ?? 'USD',
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'] as String) ?? DateTime.now()
          : DateTime.now(),
      type: (json['type'] as String? ?? 'DEBIT').toUpperCase(),
    );
  }
}
