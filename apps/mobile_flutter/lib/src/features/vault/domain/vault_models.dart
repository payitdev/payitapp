// Domain models for GET /api/savings/summary and vault/pods strategies

class SavingsSummary {
  final double totalBalance;
  final double apyPercent;
  final double earnedToDate;
  final String currency;
  final List<SavingsStrategy> strategies;

  const SavingsSummary({
    required this.totalBalance,
    required this.apyPercent,
    required this.earnedToDate,
    required this.currency,
    required this.strategies,
  });

  factory SavingsSummary.fromJson(Map<String, dynamic> json) {
    final rawStrategies = json['strategies'] as List<dynamic>? ??
        json['vaults'] as List<dynamic>? ?? [];
    return SavingsSummary(
      totalBalance: (json['totalBalance'] as num?)?.toDouble() ??
          (json['balance'] as num?)?.toDouble() ?? 0.0,
      apyPercent: (json['apyPercent'] as num?)?.toDouble() ??
          (json['apy'] as num?)?.toDouble() ?? 0.0,
      earnedToDate: (json['earnedToDate'] as num?)?.toDouble() ??
          (json['totalEarned'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String? ?? 'USD',
      strategies: rawStrategies
          .map((s) => SavingsStrategy.fromJson(s as Map<String, dynamic>))
          .toList(),
    );
  }

  /// Demo fallback
  static const SavingsSummary demo = SavingsSummary(
    totalBalance: 12500.00,
    apyPercent: 11.2,
    earnedToDate: 840.00,
    currency: 'USD',
    strategies: [
      SavingsStrategy(
        id: 'strat_kamino_01',
        name: 'Kamino USDC Vault',
        apyPercent: 11.2,
        depositedAmount: 10000.00,
        currentValue: 11100.00,
        currency: 'USDC',
        riskLevel: 'Low',
        protocol: 'Kamino Finance',
      ),
      SavingsStrategy(
        id: 'strat_ondo_01',
        name: 'Ondo USDY Yield',
        apyPercent: 5.1,
        depositedAmount: 2500.00,
        currentValue: 2627.50,
        currency: 'USDY',
        riskLevel: 'Very Low',
        protocol: 'Ondo Finance',
      ),
    ],
  );
}

class SavingsStrategy {
  final String id;
  final String name;
  final double apyPercent;
  final double depositedAmount;
  final double currentValue;
  final String currency;
  final String riskLevel;
  final String protocol;

  const SavingsStrategy({
    required this.id,
    required this.name,
    required this.apyPercent,
    required this.depositedAmount,
    required this.currentValue,
    required this.currency,
    required this.riskLevel,
    required this.protocol,
  });

  double get unrealizedGain => currentValue - depositedAmount;
  bool get isPositive => unrealizedGain >= 0;

  factory SavingsStrategy.fromJson(Map<String, dynamic> json) {
    return SavingsStrategy(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? json['strategyName'] as String? ?? 'Vault',
      apyPercent: (json['apyPercent'] as num?)?.toDouble() ??
          (json['apy'] as num?)?.toDouble() ?? 0.0,
      depositedAmount: (json['depositedAmount'] as num?)?.toDouble() ??
          (json['deposited'] as num?)?.toDouble() ?? 0.0,
      currentValue: (json['currentValue'] as num?)?.toDouble() ??
          (json['value'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String? ?? 'USD',
      riskLevel: json['riskLevel'] as String? ?? json['risk'] as String? ?? 'Low',
      protocol: json['protocol'] as String? ?? json['platform'] as String? ?? '',
    );
  }
}
