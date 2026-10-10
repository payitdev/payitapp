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
/// produced by the backend; every item also carries an ISO-8601
/// `createdAt` — [parsedDate] prefers it and only falls back to parsing
/// `date` for older payloads.
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
  final DateTime? createdAt; // ISO-8601, when provided by the backend

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
    this.createdAt,
  });

  bool get isInbound => type == 'INBOUND';

  /// Best-effort recovery of the transaction timestamp. The ISO-8601
  /// `createdAt` field is authoritative when present; otherwise `date`
  /// (an en-US localized string, e.g. "9/28/2026") is tried as ISO-8601
  /// first, then a loose en-US parse. Null when unparseable.
  DateTime? get parsedDate {
    final created = createdAt;
    if (created != null) return created;
    final iso = DateTime.tryParse(date);
    if (iso != null) return iso;
    try {
      return DateFormat.yMd('en_US').parseLoose(date);
    } catch (_) {
      return null;
    }
  }

  factory TreasuryTransaction.fromJson(Map<String, dynamic> json) {
    final rawCreatedAt = json['createdAt'];
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
      createdAt: rawCreatedAt == null ? null : DateTime.tryParse(rawCreatedAt.toString()),
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

/// A single signer slot on a multi-sig approval — GET /api/approvals*.
/// `status` is one of 'PENDING' | 'SIGNED' | 'REJECTED'.
class ApprovalSigner {
  final String id;
  final String label;
  final String? keyNote;
  final String status;
  final DateTime? signedAt;

  const ApprovalSigner({
    required this.id,
    required this.label,
    this.keyNote,
    this.status = 'PENDING',
    this.signedAt,
  });

  bool get isSigned => status == 'SIGNED';
  bool get isRejected => status == 'REJECTED';
  bool get isPending => status == 'PENDING';

  factory ApprovalSigner.fromJson(Map<String, dynamic> json) {
    final rawSignedAt = json['signedAt'];
    return ApprovalSigner(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? 'Signer',
      keyNote: json['keyNote'] as String?,
      status: (json['status'] as String? ?? 'PENDING').toUpperCase(),
      signedAt: rawSignedAt == null ? null : DateTime.tryParse(rawSignedAt.toString()),
    );
  }
}

/// A multi-sig approval from GET /api/approvals (any status) or
/// GET /api/approvals/pending (PENDING only). Newer fields (`status`,
/// `createdAt`, `updatedAt`, `signers`) are tolerated as absent so payloads
/// from before the full shape shipped still parse.
class PendingApproval {
  final String id;
  final String title;
  final double amount;
  final String currency;
  final String? description;
  final int signedCount;
  final int requiredSignatures;
  final String status; // 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'EXPIRED'
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final List<ApprovalSigner> signers;

  const PendingApproval({
    required this.id,
    required this.title,
    required this.amount,
    required this.currency,
    this.description,
    this.signedCount = 0,
    this.requiredSignatures = 1,
    this.status = 'PENDING',
    this.createdAt,
    this.updatedAt,
    this.signers = const [],
  });

  bool get isPending => status == 'PENDING';

  factory PendingApproval.fromJson(Map<String, dynamic> json) {
    final rawCreatedAt = json['createdAt'];
    final rawUpdatedAt = json['updatedAt'];
    final rawSigners = json['signers'];
    return PendingApproval(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Approval Request',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String? ?? 'USD',
      description: json['description'] as String?,
      signedCount: json['signedCount'] as int? ?? 0,
      requiredSignatures: json['requiredSignatures'] as int? ?? 1,
      status: (json['status'] as String? ?? 'PENDING').toUpperCase(),
      createdAt: rawCreatedAt == null ? null : DateTime.tryParse(rawCreatedAt.toString()),
      updatedAt: rawUpdatedAt == null ? null : DateTime.tryParse(rawUpdatedAt.toString()),
      signers: rawSigners is List
          ? rawSigners
              .map((s) => ApprovalSigner.fromJson(s as Map<String, dynamic>))
              .toList()
          : const <ApprovalSigner>[],
    );
  }
}
