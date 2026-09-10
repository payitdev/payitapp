class ProximUser {
  final String id;
  final String email;
  final String fullName;
  final List<ProximEntity> entities;
  final String activeEntityId;
  final bool hasPasscode;

  const ProximUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.entities,
    required this.activeEntityId,
    this.hasPasscode = false,
  });

  ProximEntity? get activeEntity {
    try {
      return entities.firstWhere((e) => e.id == activeEntityId);
    } catch (_) {
      return entities.isNotEmpty ? entities.first : null;
    }
  }

  ProximEntity? get businessEntity {
    try {
      return entities.firstWhere((e) => e.kind == 'BUSINESS');
    } catch (_) {
      return null;
    }
  }

  ProximEntity? get personalEntity {
    try {
      return entities.firstWhere((e) => e.kind == 'PERSONAL');
    } catch (_) {
      return null;
    }
  }

  factory ProximUser.fromJson(Map<String, dynamic> json) {
    final rawEntities = json['entities'] as List<dynamic>? ?? [];
    return ProximUser(
      id: json['id'] as String? ?? '',
      email: json['email'] as String? ?? '',
      fullName: json['fullName'] as String? ?? '',
      entities: rawEntities.map((e) => ProximEntity.fromJson(e as Map<String, dynamic>)).toList(),
      activeEntityId: json['activeEntityId'] as String? ?? '',
      hasPasscode: json['hasPasscode'] as bool? ?? false,
    );
  }

  ProximUser copyWith({
    String? id,
    String? email,
    String? fullName,
    List<ProximEntity>? entities,
    String? activeEntityId,
    bool? hasPasscode,
  }) {
    return ProximUser(
      id: id ?? this.id,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      entities: entities ?? this.entities,
      activeEntityId: activeEntityId ?? this.activeEntityId,
      hasPasscode: hasPasscode ?? this.hasPasscode,
    );
  }
}

class ProximEntity {
  final String id;
  final String userId;
  final String kind; // 'PERSONAL' | 'BUSINESS'
  final String legalName;
  final String? businessTag;
  final String? dueStatus;
  final String? evmDepositAddress;
  final String? solanaDepositAddress;
  final String? btcDepositAddress;
  final String? nearDepositAddress;
  final List<FiatAccount> fiatAccounts;

  const ProximEntity({
    required this.id,
    required this.userId,
    required this.kind,
    required this.legalName,
    this.businessTag,
    this.dueStatus,
    this.evmDepositAddress,
    this.solanaDepositAddress,
    this.btcDepositAddress,
    this.nearDepositAddress,
    this.fiatAccounts = const [],
  });

  bool get isBusiness => kind == 'BUSINESS';
  bool get isPersonal => kind == 'PERSONAL';
  String get kybTier => 'Tier 3';
  String get kybStatus => dueStatus ?? 'Tier 3';

  factory ProximEntity.fromJson(Map<String, dynamic> json) {
    final rawAccounts = json['fiatAccounts'] as List<dynamic>? ?? [];
    return ProximEntity(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      kind: (json['kind'] as String? ?? 'PERSONAL').toUpperCase(),
      legalName: json['legalName'] as String? ?? 'Proxim Account',
      businessTag: json['businessTag'] as String?,
      dueStatus: json['dueStatus'] as String?,
      evmDepositAddress: json['evmDepositAddress'] as String?,
      solanaDepositAddress: json['solanaDepositAddress'] as String?,
      btcDepositAddress: json['btcDepositAddress'] as String?,
      nearDepositAddress: json['nearDepositAddress'] as String?,
      fiatAccounts: rawAccounts.map((a) => FiatAccount.fromJson(a as Map<String, dynamic>)).toList(),
    );
  }
}

class FiatAccount {
  final String id;
  final String accountNumber;
  final String? routingNumber;
  final String bankName;
  final String currency;
  final String rail;
  final String accountHolderName;
  final String status;

  const FiatAccount({
    required this.id,
    required this.accountNumber,
    this.routingNumber,
    required this.bankName,
    required this.currency,
    required this.rail,
    required this.accountHolderName,
    required this.status,
  });

  factory FiatAccount.fromJson(Map<String, dynamic> json) {
    return FiatAccount(
      id: json['id'] as String? ?? '',
      accountNumber: json['accountNumber'] as String? ?? '',
      routingNumber: json['routingNumber'] as String?,
      bankName: json['bankName'] as String? ?? 'Proxim Virtual Bank',
      currency: json['currency'] as String? ?? 'NGN',
      rail: json['rail'] as String? ?? 'LOCAL_TRANSFER',
      accountHolderName: json['accountHolderName'] as String? ?? 'Proxim Account',
      status: json['status'] as String? ?? 'ACTIVE',
    );
  }
}
