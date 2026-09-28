import 'dart:math' as math;

import 'treasury_models.dart';

/// Client-side derived treasury metrics for the dashboard hero card.
/// The backend has no burn-rate / runway / inflow endpoints, so these are
/// computed purely from the live balance, account list and transfer history.
class TreasuryMetrics {
  final double balance;
  final String currency;

  /// Balance converted to NGN via /api/fx/rates; null when rates unavailable.
  final double? ngnEquivalent;

  /// Number of connected deposit accounts ("vaults").
  final int vaultCount;

  /// Average monthly DEBIT outflow (positive number) over available history.
  final double monthlyBurn;

  /// True when the available history spans less than one month.
  final bool burnIsEstimate;

  /// balance / monthlyBurn; null when there is no measurable burn.
  final double? runwayMonths;

  /// 'Safe' (>= 6 Mo) | 'Watch' (>= 3 Mo) | 'At Risk' (< 3 Mo).
  final String runwayTier;

  /// Sum of INBOUND amounts over the last 30 days.
  final double inflowLast30d;

  /// Month-over-month % change vs the preceding 30 days;
  /// null when the preceding period had zero inflow.
  final double? inflowMomPct;

  const TreasuryMetrics({
    required this.balance,
    required this.currency,
    required this.ngnEquivalent,
    required this.vaultCount,
    required this.monthlyBurn,
    required this.burnIsEstimate,
    required this.runwayMonths,
    required this.runwayTier,
    required this.inflowLast30d,
    required this.inflowMomPct,
  });

  bool get inflowImproved => inflowMomPct != null && inflowMomPct! >= 0;
}

/// Pure derivation of the dashboard hero metrics from data that exists.
///
/// - 30D Inflow: sum of INBOUND amounts in the last 30 days.
/// - MoM %: last 30 days vs the preceding 30 days; null when the prior
///   period is zero (caller shows the absolute value instead).
/// - Mo. Burn Rate: total DEBITs over the available history normalized per
///   30.44-day month. For histories shorter than a month this divides by the
///   fraction of the month covered, and [TreasuryMetrics.burnIsEstimate]
///   stays true.
/// - Net Runway: balance / monthlyBurn; null when burn is zero.
TreasuryMetrics computeTreasuryMetrics({
  required double balance,
  required String currency,
  required List<TreasuryTransaction> history,
  required int vaultCount,
  double? rateToNgn,
  DateTime? now,
}) {
  final ref = now ?? DateTime.now();

  final dated = history.where((t) => t.parsedDate != null).toList()
    ..sort((a, b) => a.parsedDate!.compareTo(b.parsedDate!));

  double sumInbound(Iterable<TreasuryTransaction> items) => items
      .where((t) => t.isInbound)
      .fold<double>(0.0, (sum, t) => sum + t.amount);

  final last30 = dated
      .where((t) => !t.parsedDate!.isBefore(ref.subtract(const Duration(days: 30))))
      .toList();
  final prev30 = dated.where((t) {
    final d = t.parsedDate!;
    return d.isBefore(ref.subtract(const Duration(days: 30))) &&
        !d.isBefore(ref.subtract(const Duration(days: 60)));
  }).toList();

  final inflow = sumInbound(last30);
  final prevInflow = sumInbound(prev30);
  final momPct = prevInflow > 0 ? ((inflow - prevInflow) / prevInflow) * 100 : null;

  final totalDebits =
      dated.where((t) => !t.isInbound).fold<double>(0.0, (sum, t) => sum + t.amount);

  const daysPerMonth = 30.44;
  double monthlyBurn;
  bool burnIsEstimate;
  if (dated.isEmpty) {
    monthlyBurn = 0.0;
    burnIsEstimate = true;
  } else {
    final windowDays = math.max(
      dated.last.parsedDate!.difference(dated.first.parsedDate!).inDays,
      1,
    );
    monthlyBurn = totalDebits / (windowDays / daysPerMonth);
    burnIsEstimate = windowDays < daysPerMonth;
  }

  final runway = monthlyBurn > 0 ? balance / monthlyBurn : null;
  final tier = runway == null || runway >= 6
      ? 'Safe'
      : runway >= 3
          ? 'Watch'
          : 'At Risk';

  return TreasuryMetrics(
    balance: balance,
    currency: currency,
    ngnEquivalent: rateToNgn != null ? balance * rateToNgn : null,
    vaultCount: vaultCount,
    monthlyBurn: monthlyBurn,
    burnIsEstimate: burnIsEstimate,
    runwayMonths: runway,
    runwayTier: tier,
    inflowLast30d: inflow,
    inflowMomPct: momPct,
  );
}
