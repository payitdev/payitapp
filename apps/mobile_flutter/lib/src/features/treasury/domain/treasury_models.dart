import 'package:intl/intl.dart';

/// Aggregated live balance from GET /api/transfers/balance
/// Response shape: `{ success: bool, balance: string|number, currency: string }`
class TreasuryBalance {
  final double balance;
  final String currency;

  const TreasuryBalance({required this.balance, required this.currency});

  factory TreasuryBalance.fromJson(Map<String, dynamic> json) {
    final raw = json['balance'];
    return TreasuryBalance(
      balance: raw is num
          ? raw.toDouble()
          : double.tryParse(raw?.toString() ?? '') ?? 0.0,
      currency: json['currency'] as String? ?? 'USD',
    );
  }
}

/// A single formatted transaction from GET /api/transfers/history
/// (the `transactions` array). `date` / `time` are localized strings
/// produced by the backend — [parsedDate] best-effort recovers a DateTime.
class TreasuryTransaction {
  final String id;
  final String type; // 'INBOUND' | 'OUTBOUND'
  final String title;
  final String subtitle;
  final double amount;
  final String symbol;
  final String currency;
  final String date;
  final String time;
  final String mode; // 'crypto' | 'fiat'
  final String senderAccount;
  final String recipientAccount;
  final String reference;

  const TreasuryTransaction({
    required this.id,
    required this.type,
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.symbol,
    required this.currency,
    required this.date,
    required this.time,
    required this.mode,
    required this.senderAccount,
    required this.recipientAccount,
    required this.reference,
  });

  bool get isInbound => type == 'INBOUND';

  /// Best-effort recovery of the transaction timestamp. The backend sends
  /// `date` as an en-US localized string (e.g. "9/28/2026"); ISO-8601 is
  /// tried first, then a loose en-US parse. Null when unparseable.
  DateTime? get parsedDate {
    final iso = DateTime.tryParse(date);
    if (iso != null) return iso;
    try {
      return DateFormat.yMd('en_US').parseLoose(date);
    } catch (_) {
      return null;
    }
  }

  factory TreasuryTransaction.fromJson(Map<String, dynamic> json) {
    return TreasuryTransaction(
      id: json['id'] as String? ?? '',
      type: (json['type'] as String? ?? 'OUTBOUND').toUpperCase(),
      title: json['title'] as String? ?? 'Transaction',
      subtitle: json['subtitle'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      symbol: json['symbol'] as String? ?? '\$',
      currency: json['currency'] as String? ?? 'USD',
      date: json['date'] as String? ?? '',
      time: json['time'] as String? ?? '',
      mode: json['mode'] as String? ?? 'fiat',
      senderAccount: json['senderAccount'] as String? ?? '',
      recipientAccount: json['recipientAccount'] as String? ?? '',
      reference: json['reference'] as String? ?? '',
    );
  }
}

/// A single FX rate entry from GET /api/fx/rates (`rates` array).
class FxRate {
  final String currency;
  final String symbol;
  final double rateToNgn;
  final double rateToUsd;
  final String name;

  const FxRate({
    required this.currency,
    required this.symbol,
    required this.rateToNgn,
    required this.rateToUsd,
    required this.name,
  });

  factory FxRate.fromJson(Map<String, dynamic> json) {
    return FxRate(
      currency: json['currency'] as String? ?? '',
      symbol: json['symbol'] as String? ?? '',
      rateToNgn: (json['rateToNgn'] as num?)?.toDouble() ?? 0.0,
      rateToUsd: (json['rateToUsd'] as num?)?.toDouble() ?? 0.0,
      name: json['name'] as String? ?? '',
    );
  }
}

/// A single pending executive approval from GET /api/approvals/pending.
/// The backend endpoint is not live yet — this model matches the agreed
/// `{ success, approvals: [...] }` contract so the client is ready for it.
class PendingApproval {
  final String id;
  final String title;
  final double amount;
  final String currency;
  final String? description;
  final int signedCount;
  final int requiredSignatures;

  const PendingApproval({
    required this.id,
    required this.title,
    required this.amount,
    required this.currency,
    this.description,
    this.signedCount = 0,
    this.requiredSignatures = 1,
  });

  factory PendingApproval.fromJson(Map<String, dynamic> json) {
    return PendingApproval(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Approval Request',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String? ?? 'USD',
      description: json['description'] as String?,
      signedCount: json['signedCount'] as int? ?? 0,
      requiredSignatures: json['requiredSignatures'] as int? ?? 1,
    );
  }
}
