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

/// A single item from GET /api/transfers/history
class TransferHistoryItem {
  final String id;
  final String title;      // e.g. "Sent to David" or "Received from Sarah"
  final String subtitle;   // formatted date/time string
  final double amount;
  final String currency;
  final String type;       // 'SENT' | 'RECEIVED' | 'YIELD' | 'SWAP'
  final String status;     // 'CLEARED' | 'PENDING' | 'FAILED'
  final DateTime timestamp;

  const TransferHistoryItem({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.currency,
    required this.type,
    required this.status,
    required this.timestamp,
  });

  bool get isSent => type == 'SENT' || type == 'SWAP';
  bool get isReceived => type == 'RECEIVED' || type == 'YIELD';

  factory TransferHistoryItem.fromJson(Map<String, dynamic> json) {
    final ts = json['timestamp'] != null
        ? DateTime.tryParse(json['timestamp'] as String) ?? DateTime.now()
        : DateTime.now();

    // Build human-readable title from backend fields
    final direction = (json['type'] as String? ?? 'SENT').toUpperCase();
    final counterparty = json['recipientName'] as String? ??
        json['senderName'] as String? ??
        json['counterpartyName'] as String? ??
        'Unknown';
    String title;
    if (direction == 'RECEIVED' || direction == 'YIELD') {
      title = json['title'] as String? ?? 'Received from $counterparty';
    } else {
      title = json['title'] as String? ?? 'Sent to $counterparty';
    }

    return TransferHistoryItem(
      id: json['id'] as String? ?? '',
      title: title,
      subtitle: json['subtitle'] as String? ?? _formatTimestamp(ts),
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String? ?? 'USD',
      type: direction,
      status: json['status'] as String? ?? 'CLEARED',
      timestamp: ts,
    );
  }

  static String _formatTimestamp(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inDays == 0) {
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return 'Today, $h:$m';
    } else if (diff.inDays == 1) {
      return 'Yesterday';
    } else {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
    }
  }
}

/// Aggregated balance summary from GET /api/transfers/balance
class TransfersBalance {
  final double totalUsd;
  final Map<String, double> byCurrency; // e.g. {'USD': 300.0, 'NGN': 150000.0}

  const TransfersBalance({required this.totalUsd, required this.byCurrency});

  factory TransfersBalance.fromJson(Map<String, dynamic> json) {
    final balances = json['balances'] as Map<String, dynamic>? ??
        json['balance'] as Map<String, dynamic>? ??
        {};
    final byCurrency = balances.map(
      (k, v) => MapEntry(k, (v as num).toDouble()),
    );
    return TransfersBalance(
      totalUsd: (json['totalUsd'] as num?)?.toDouble() ??
          (json['total'] as num?)?.toDouble() ??
          0.0,
      byCurrency: byCurrency,
    );
  }
}

