// Domain models for GET /api/ondo/stocks and GET /api/ondo/positions/:entityId

class OndoStock {
  final String symbol;
  final String name;
  final double price;
  final double changePercent;
  final double changeAmount;
  final String currency;

  const OndoStock({
    required this.symbol,
    required this.name,
    required this.price,
    required this.changePercent,
    required this.changeAmount,
    required this.currency,
  });

  bool get isPositive => changePercent >= 0;

  factory OndoStock.fromJson(Map<String, dynamic> json) {
    return OndoStock(
      symbol: json['symbol'] as String? ?? '',
      name: json['name'] as String? ?? json['companyName'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble() ??
          (json['lastPrice'] as num?)?.toDouble() ?? 0.0,
      changePercent: (json['changePercent'] as num?)?.toDouble() ??
          (json['change1dPercent'] as num?)?.toDouble() ?? 0.0,
      changeAmount: (json['changeAmount'] as num?)?.toDouble() ??
          (json['change1d'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String? ?? 'USD',
    );
  }
}

class OndoPosition {
  final String symbol;
  final String name;
  final double shares;
  final double avgCost;
  final double currentPrice;
  final String currency;

  const OndoPosition({
    required this.symbol,
    required this.name,
    required this.shares,
    required this.avgCost,
    required this.currentPrice,
    required this.currency,
  });

  double get marketValue => shares * currentPrice;
  double get costBasis => shares * avgCost;
  double get unrealizedGain => marketValue - costBasis;
  double get returnPercent => costBasis > 0 ? (unrealizedGain / costBasis) * 100 : 0;
  bool get isPositive => unrealizedGain >= 0;

  factory OndoPosition.fromJson(Map<String, dynamic> json) {
    return OndoPosition(
      symbol: json['symbol'] as String? ?? '',
      name: json['name'] as String? ?? json['companyName'] as String? ?? '',
      shares: (json['shares'] as num?)?.toDouble() ??
          (json['quantity'] as num?)?.toDouble() ?? 0.0,
      avgCost: (json['avgCost'] as num?)?.toDouble() ??
          (json['averageCost'] as num?)?.toDouble() ?? 0.0,
      currentPrice: (json['currentPrice'] as num?)?.toDouble() ??
          (json['price'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String? ?? 'USD',
    );
  }
}

class InvestPortfolioSummary {
  final double totalValue;
  final double totalGain;
  final double totalGainPercent;

  const InvestPortfolioSummary({
    required this.totalValue,
    required this.totalGain,
    required this.totalGainPercent,
  });

  factory InvestPortfolioSummary.fromPositions(List<OndoPosition> positions) {
    final totalValue = positions.fold(0.0, (s, p) => s + p.marketValue);
    final totalCost = positions.fold(0.0, (s, p) => s + p.costBasis);
    final totalGain = totalValue - totalCost;
    final totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0.0;
    return InvestPortfolioSummary(
      totalValue: totalValue,
      totalGain: totalGain,
      totalGainPercent: totalGainPercent,
    );
  }
}
