import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';
import '../../auth/presentation/auth_provider.dart';
import '../data/treasury_repository.dart';
import '../domain/treasury_models.dart';
import 'treasury_provider.dart';

/// Balance sheet & cashflow — fully driven by GET /api/reports/balance-sheet
/// (statement figures), GET /api/transfers/history (monthly cashflow
/// trajectory + derived runway) and GET /api/fx/rates (NGN dual view).
/// Every figure is real; missing data renders as '—' and fetch failures
/// render a retry state — there are no fabricated fallbacks.
class BalanceSheetCashflowScreen extends ConsumerStatefulWidget {
  const BalanceSheetCashflowScreen({super.key});

  @override
  ConsumerState<BalanceSheetCashflowScreen> createState() => _BalanceSheetCashflowScreenState();
}

class _BalanceSheetCashflowScreenState extends ConsumerState<BalanceSheetCashflowScreen> {
  static const _periods = [
    (label: 'This Month', key: 'this_month'),
    (label: 'Quarter to Date', key: 'qtd'),
    (label: 'Year to Date', key: 'ytd'),
  ];

  bool _isUsd = true;

  final NumberFormat _ngnFormat = NumberFormat('#,##0', 'en_US');

  String _formatUsd(double value) =>
      '\$${value.toStringAsFixed(2).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';

  String _formatNgn(double value) => '₦${_ngnFormat.format(value)}';

  /// Converts the last six calendar months of transfer history into
  /// inflow/outflow sums. Months with no activity stay at real zeros.
  List<({String label, double inflow, double outflow})> _monthlyCashflow(
    List<TreasuryTransaction> history,
    DateTime now,
  ) {
    final buckets = <DateTime, ({double inflow, double outflow})>{};
    for (var i = 5; i >= 0; i--) {
      final month = DateTime(now.year, now.month - i, 1);
      buckets[month] = (inflow: 0.0, outflow: 0.0);
    }
    for (final tx in history) {
      final date = tx.parsedDate;
      if (date == null) continue;
      final month = DateTime(date.year, date.month, 1);
      final bucket = buckets[month];
      if (bucket == null) continue;
      buckets[month] = tx.isInbound
          ? (inflow: bucket.inflow + tx.amount, outflow: bucket.outflow)
          : (inflow: bucket.inflow, outflow: bucket.outflow + tx.amount);
    }
    final sorted = buckets.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return [
      for (final entry in sorted)
        (label: DateFormat('MMM').format(entry.key), inflow: entry.value.inflow, outflow: entry.value.outflow),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final balanceSheetAsync = ref.watch(activeBalanceSheetProvider);
    final report = balanceSheetAsync.value;
    final metrics = ref.watch(treasuryMetricsProvider).value;
    final historyAsync = ref.watch(treasuryHistoryProvider);
    final rates = ref.watch(fxRatesProvider).value ?? const <FxRate>[];
    final entity = ref.watch(activeEntityProvider);

    FxRate? usdRate;
    for (final rate in rates) {
      if (rate.currency == 'USD') {
        usdRate = rate;
        break;
      }
    }
    final rateToNgn = usdRate?.rateToNgn;

    return Scaffold(
      backgroundColor: ProximColors.backgroundVoid,
      body: CenteredAppContainer(
        child: SafeArea(
          child: Column(
            children: [
              _buildTopBar(context, report, entity?.legalName),
              Expanded(
                child: balanceSheetAsync.hasError && report == null
                    ? _buildErrorState(
                        balanceSheetAsync.error!,
                        onRetry: () => ref.invalidate(activeBalanceSheetProvider),
                      )
                    : SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildPeriodTabs(),
                            const SizedBox(height: 12),
                            _buildCurrencyToggle(),
                            const SizedBox(height: 14),
                            _buildNetSurplusCard(report, rateToNgn),
                            const SizedBox(height: 16),
                            _buildCashflowChartCard(historyAsync),
                            const SizedBox(height: 16),
                            _buildBalanceSheetBreakdown(report, metrics?.runwayMonths),
                            const SizedBox(height: 32),
                          ],
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopBar(BuildContext context, BalanceSheetData? report, String? entityName) {
    final businessName = report?.businessName.isNotEmpty == true ? report!.businessName : entityName;
    final periodLabel = report?.periodLabel;
    final subtitle = [
      if (businessName != null && businessName.isNotEmpty) businessName,
      if (periodLabel != null && periodLabel.isNotEmpty) periodLabel,
    ].join(' • ');

    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLowest.withValues(alpha: 0.8),
        border: const Border(bottom: BorderSide(color: ProximColors.hairlineBorder)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: ProximColors.onSurface),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            onPressed: () {
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/');
              }
            },
          ),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  'Balance Sheet & Cashflow',
                  style: ProximTextStyles.headlineSm(),
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  subtitle.isEmpty ? 'Financial report' : subtitle,
                  style: ProximTextStyles.labelXs(),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.ios_share, size: 20, color: ProximColors.primary),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Report export is not available yet.')),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildPeriodTabs() {
    final selectedKey = ref.watch(balanceSheetPeriodProvider);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final period in _periods)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => ref.read(balanceSheetPeriodProvider.notifier).select(period.key),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: selectedKey == period.key ? ProximColors.primary : ProximColors.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(9999),
                  ),
                  child: Text(
                    period.label,
                    style: ProximTextStyles.labelSm(
                      color: selectedKey == period.key ? ProximColors.surfaceContainerLowest : ProximColors.onSurfaceVariant,
                    ).copyWith(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildCurrencyToggle() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: Row(
              children: [
                const Icon(Icons.currency_exchange, size: 16, color: ProximColors.primary),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    'Ledger Base',
                    style: ProximTextStyles.labelXs(),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          Row(
            children: [
              GestureDetector(
                onTap: () => setState(() => _isUsd = true),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: _isUsd ? ProximColors.surfaceContainerHigh : Colors.transparent,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    'USD Consolidated',
                    style: ProximTextStyles.labelXs(
                      color: _isUsd ? ProximColors.primary : ProximColors.onSurfaceVariant,
                    ).copyWith(fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              const SizedBox(width: 4),
              GestureDetector(
                onTap: () => setState(() => _isUsd = false),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: !_isUsd ? ProximColors.surfaceContainerHigh : Colors.transparent,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    'NGN Dual-View',
                    style: ProximTextStyles.labelXs(
                      color: !_isUsd ? ProximColors.primary : ProximColors.onSurfaceVariant,
                    ).copyWith(fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMoney(double? usdValue, double? rateToNgn, {required bool outflow}) {
    if (usdValue == null) {
      return Text('—', style: ProximTextStyles.headlineSm(color: ProximColors.onSurfaceVariant));
    }
    // Outflows are stored as positive sums — present them as negatives.
    final signed = outflow ? -usdValue.abs() : usdValue;
    if (_isUsd || rateToNgn == null) {
      final formatted = _formatUsd(signed.abs());
      return Text(
        '${signed >= 0 ? '+' : '-'}$formatted',
        style: ProximTextStyles.headlineSm(
          color: signed >= 0 ? ProximColors.primary : ProximColors.secondary,
        ).copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
      );
    }
    final ngn = signed * rateToNgn;
    return Text(
      '${ngn >= 0 ? '+' : '-'}${_formatNgn(ngn.abs())}',
      style: ProximTextStyles.headlineSm(
        color: ngn >= 0 ? ProximColors.primary : ProximColors.secondary,
      ).copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
    );
  }

  Widget _buildNetSurplusCard(BalanceSheetData? report, double? rateToNgn) {
    final surplus = report?.netOperatingSurplus;
    final margin = report?.profitMarginPercent;

    return Container(
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Column(
        children: [
          Container(
            height: 3,
            decoration: const BoxDecoration(
              gradient: ProximColors.auroraBarTrack,
              borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('NET OPERATING SURPLUS', style: ProximTextStyles.labelXs()),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: ProximColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(9999),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.trending_up, size: 12, color: ProximColors.primary),
                          const SizedBox(width: 3),
                          Text(
                            margin == null ? '—' : '${margin.toStringAsFixed(1)}% Margin',
                            style: ProximTextStyles.labelXs(color: ProximColors.primary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    if (surplus == null)
                      Text('—', style: ProximTextStyles.headlineLg(color: ProximColors.onSurfaceVariant))
                    else if (_isUsd || rateToNgn == null)
                      Text(
                        '${surplus >= 0 ? '+' : '-'}${_formatUsd(surplus.abs())}',
                        style: ProximTextStyles.headlineLg(color: ProximColors.textWhite).copyWith(
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      )
                    else
                      Text(
                        '${surplus >= 0 ? '+' : '-'}${_formatNgn((surplus * rateToNgn).abs())}',
                        style: ProximTextStyles.headlineLg(color: ProximColors.textWhite).copyWith(
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    const SizedBox(width: 6),
                    Text(_isUsd ? 'USD' : 'NGN', style: ProximTextStyles.headlineSm()),
                  ],
                ),
                const SizedBox(height: 14),

                // Inflow / Outflow Split
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 6,
                                  height: 6,
                                  decoration: const BoxDecoration(shape: BoxShape.circle, color: ProximColors.primary),
                                ),
                                const SizedBox(width: 4),
                                Text('TOTAL INFLOWS', style: ProximTextStyles.labelXs()),
                              ],
                            ),
                            const SizedBox(height: 2),
                            _buildMoney(report?.totalInflows, rateToNgn, outflow: false),
                            Text('Collected Revenue', style: ProximTextStyles.labelXs()),
                          ],
                        ),
                      ),
                      Container(width: 1, height: 40, color: ProximColors.hairlineBorder),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 6,
                                  height: 6,
                                  decoration: const BoxDecoration(shape: BoxShape.circle, color: ProximColors.secondary),
                                ),
                                const SizedBox(width: 4),
                                Text('TOTAL OUTFLOWS', style: ProximTextStyles.labelXs()),
                              ],
                            ),
                            const SizedBox(height: 2),
                            _buildMoney(report?.totalOutflows, rateToNgn, outflow: true),
                            Text('Operating & Payroll Spend', style: ProximTextStyles.labelXs()),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCashflowChartCard(AsyncValue<List<TreasuryTransaction>> historyAsync) {
    final months = _monthlyCashflow(historyAsync.value ?? const [], DateTime.now());
    final maxFlow = months.fold<double>(
      0,
      (max, m) => m.inflow > max ? m.inflow : (m.outflow > max ? m.outflow : max),
    );

    Widget bars(List<({String label, double inflow, double outflow})> data) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (final entry in data)
            Column(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      width: 8,
                      height: maxFlow > 0 ? 70 * (entry.inflow / maxFlow) : 0,
                      decoration: BoxDecoration(
                        color: ProximColors.primary,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(2)),
                      ),
                    ),
                    const SizedBox(width: 2),
                    Container(
                      width: 8,
                      height: maxFlow > 0 ? 70 * (entry.outflow / maxFlow) : 0,
                      decoration: BoxDecoration(
                        color: ProximColors.secondary,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(2)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(entry.label, style: ProximTextStyles.labelXs()),
              ],
            ),
        ],
      );
    }

    final title = months.isEmpty
        ? '6-Month Trajectory'
        : '6-Month Trajectory (${months.first.label} – ${months.last.label})';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Row(
                  children: [
                    const Icon(Icons.stacked_bar_chart, size: 16, color: ProximColors.primary),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        title,
                        style: ProximTextStyles.labelXs(),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
              Row(
                children: [
                  Container(width: 6, height: 6, color: ProximColors.primary),
                  const SizedBox(width: 4),
                  Text('In', style: ProximTextStyles.labelXs()),
                  const SizedBox(width: 8),
                  Container(width: 6, height: 6, color: ProximColors.secondary),
                  const SizedBox(width: 4),
                  Text('Out', style: ProximTextStyles.labelXs()),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Bar visualization
          Container(
            height: 100,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(10),
            ),
            child: historyAsync.when(
              loading: () => const Center(child: CircularProgressIndicator(color: ProximColors.primary)),
              error: (error, _) => Center(
                child: Text(
                  'Cashflow trajectory unavailable.',
                  style: ProximTextStyles.labelXs(),
                ),
              ),
              data: (_) => bars(months),
            ),
          ),
          if (historyAsync.hasValue && maxFlow == 0) ...[
            const SizedBox(height: 8),
            Text(
              'No cashflow activity recorded in this window.',
              style: ProximTextStyles.labelXs(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBalanceSheetBreakdown(BalanceSheetData? report, double? runwayMonths) {
    final runwayText = runwayMonths == null ? 'Runway —' : '${runwayMonths.toStringAsFixed(1)} Mo Runway';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Text(
                  'Consolidated Balance Sheet',
                  style: ProximTextStyles.headlineSm(),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: ProximColors.statusSuccess.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(runwayText, style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'CURRENT ASSETS (${report == null ? '—' : _formatUsd(report.totalCurrentAssets)})',
            style: ProximTextStyles.labelXs(color: ProximColors.primary),
          ),
          const SizedBox(height: 6),
          _buildItemRow('Liquid Cash & Equivalents', report == null ? '—' : _formatUsd(report.cashEquivalents)),
          const SizedBox(height: 6),
          _buildItemRow('Accounts Receivable', report == null ? '—' : _formatUsd(report.accountsReceivable)),
          const SizedBox(height: 6),
          _buildItemRow('Vault & Term Deposits', report == null ? '—' : _formatUsd(report.vaultHoldings)),
          const SizedBox(height: 6),
          _buildItemRow('Tokenized Securities', report == null ? '—' : _formatUsd(report.tokenizedAssets)),
          const SizedBox(height: 12),
          Text(
            'CURRENT LIABILITIES (${report == null ? '—' : _formatUsd(report.totalCurrentLiabilities)})',
            style: ProximTextStyles.labelXs(color: ProximColors.statusWarning),
          ),
          const SizedBox(height: 6),
          _buildItemRow('Accrued Payroll', report == null ? '—' : _formatUsd(report.accruedPayroll)),
          const SizedBox(height: 6),
          _buildItemRow('Tax Payable (Est. VAT + WHT)', report == null ? '—' : _formatUsd(report.taxPayable)),
          const SizedBox(height: 12),
          Text(
            'OWNER EQUITY (${report == null ? '—' : _formatUsd(report.totalOwnerEquity)})',
            style: ProximTextStyles.labelXs(color: ProximColors.tertiary),
          ),
          const SizedBox(height: 6),
          _buildItemRow('Net Position (Assets − Liabilities)',
              report == null ? '—' : _formatUsd(report.totalAssets - report.totalLiabilities)),
        ],
      ),
    );
  }

  Widget _buildErrorState(Object error, {required VoidCallback onRetry}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: ProximColors.surfaceContainerLow,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: ProximColors.hairlineBorder),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(error.toString(), style: ProximTextStyles.bodySm(), textAlign: TextAlign.center),
              const SizedBox(height: 12),
              GestureDetector(
                onTap: onRetry,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(9999),
                  ),
                  child: Text(
                    'Retry',
                    style: ProximTextStyles.labelSm(color: ProximColors.primary).copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildItemRow(String name, String amount) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(child: Text(name, style: ProximTextStyles.bodySm(), overflow: TextOverflow.ellipsis)),
          Text(
            amount,
            style: ProximTextStyles.bodySm(color: ProximColors.textWhite).copyWith(
              fontWeight: FontWeight.w600,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
