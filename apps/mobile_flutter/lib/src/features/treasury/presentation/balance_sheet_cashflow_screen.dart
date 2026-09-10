import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';
import '../data/treasury_repository.dart';
import 'treasury_provider.dart';

class BalanceSheetCashflowScreen extends ConsumerStatefulWidget {
  const BalanceSheetCashflowScreen({super.key});

  @override
  ConsumerState<BalanceSheetCashflowScreen> createState() => _BalanceSheetCashflowScreenState();
}

class _BalanceSheetCashflowScreenState extends ConsumerState<BalanceSheetCashflowScreen> {
  int _selectedPeriod = 1; // 0: MTD, 1: Q3 2026, 2: YTD
  bool _isUsd = true;

  @override
  Widget build(BuildContext context) {
    final balanceSheetAsync = ref.watch(activeBalanceSheetProvider);
    final report = balanceSheetAsync.value;

    return Scaffold(
      backgroundColor: ProximColors.backgroundVoid,
      body: CenteredAppContainer(
        child: SafeArea(
          child: Column(
            children: [
              _buildTopBar(context),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildPeriodTabs(),
                      const SizedBox(height: 12),
                      _buildCurrencyToggle(),
                      const SizedBox(height: 14),
                      _buildNetSurplusCard(report),
                      const SizedBox(height: 16),
                      _buildCashflowChartCard(),
                      const SizedBox(height: 16),
                      _buildBalanceSheetBreakdown(report),
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

  Widget _buildTopBar(BuildContext context) {
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
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('Balance Sheet & Cashflow', style: ProximTextStyles.headlineSm()),
              Text('Acme Global • Q3 2026 Audit Ready', style: ProximTextStyles.labelXs()),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.ios_share, size: 20, color: ProximColors.primary),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Exporting financial report CSV & PDF')),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildPeriodTabs() {
    final periods = ['MTD (Sep)', 'Q3 2026 (Active)', 'YTD', 'Custom'];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(periods.length, (index) {
          final isSelected = _selectedPeriod == index;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => setState(() => _selectedPeriod = index),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: isSelected ? ProximColors.primary : ProximColors.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(9999),
                ),
                child: Text(
                  periods[index],
                  style: ProximTextStyles.labelSm(
                    color: isSelected ? ProximColors.surfaceContainerLowest : ProximColors.onSurfaceVariant,
                  ).copyWith(fontWeight: FontWeight.w600),
                ),
              ),
            ),
          );
        }),
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
          Row(
            children: [
              const Icon(Icons.currency_exchange, size: 16, color: ProximColors.primary),
              const SizedBox(width: 6),
              Text('Ledger Base', style: ProximTextStyles.labelXs()),
            ],
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

  Widget _buildNetSurplusCard([BalanceSheetData? report]) {
    final surplus = report?.netOperatingSurplus ?? 34200.00;
    final formattedUsd = surplus >= 0
        ? '+\$${surplus.toStringAsFixed(2).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}'
        : '-\$${(-surplus).toStringAsFixed(2).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';

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
                    Text('NET OPERATING SURPLUS (Q3)', style: ProximTextStyles.labelXs()),
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
                          Text('+14.2%', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
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
                    Text(
                      _isUsd ? formattedUsd : '+₦54,549,000',
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
                            Text(
                              _isUsd ? '+\$182,450.00' : '+₦291.0M',
                              style: ProximTextStyles.headlineSm(color: ProximColors.primary).copyWith(
                                fontFeatures: const [FontFeature.tabularFigures()],
                              ),
                            ),
                            Text('Invoices • Yields', style: ProximTextStyles.labelXs()),
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
                            Text(
                              _isUsd ? '-\$148,250.00' : '-₦236.4M',
                              style: ProximTextStyles.headlineSm(color: ProximColors.secondary).copyWith(
                                fontFeatures: const [FontFeature.tabularFigures()],
                              ),
                            ),
                            Text('Payroll • Cloud Infra', style: ProximTextStyles.labelXs()),
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

  Widget _buildCashflowChartCard() {
    final months = [
      {'m': 'Apr', 'in': 0.55, 'out': 0.48},
      {'m': 'May', 'in': 0.68, 'out': 0.52},
      {'m': 'Jun', 'in': 0.72, 'out': 0.65},
      {'m': 'Jul', 'in': 0.80, 'out': 0.70},
      {'m': 'Aug', 'in': 0.85, 'out': 0.74},
      {'m': 'Sep', 'in': 0.95, 'out': 0.78},
    ];

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
              Row(
                children: [
                  const Icon(Icons.stacked_bar_chart, size: 16, color: ProximColors.primary),
                  const SizedBox(width: 6),
                  Text('6-Month Trajectory (Apr – Sep 2026)', style: ProximTextStyles.labelXs()),
                ],
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
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: months.map((entry) {
                final inFrac = entry['in'] as double;
                final outFrac = entry['out'] as double;
                final name = entry['m'] as String;
                return Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Container(
                          width: 8,
                          height: 70 * inFrac,
                          decoration: BoxDecoration(
                            color: ProximColors.primary,
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(2)),
                          ),
                        ),
                        const SizedBox(width: 2),
                        Container(
                          width: 8,
                          height: 70 * outFrac,
                          decoration: BoxDecoration(
                            color: ProximColors.secondary,
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(2)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(name, style: ProximTextStyles.labelXs()),
                  ],
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBalanceSheetBreakdown([BalanceSheetData? report]) {
    final runwayText = '${(report?.runwayMonths ?? 14.1).toStringAsFixed(1)} Mo Runway';
    final assetsTotal = report != null
        ? '\$${report.totalCurrentAssets.toStringAsFixed(2).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}'
        : '\$482,950.00';

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
              Text('Consolidated Balance Sheet', style: ProximTextStyles.headlineSm()),
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
          Text('CURRENT ASSETS ($assetsTotal)', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
          const SizedBox(height: 6),
          _buildItemRow('USD Operational Cash Pocket', '\$284,500.00'),
          const SizedBox(height: 6),
          _buildItemRow('NGN Local Clearing Reserves', '₦198.40M (~ \$124,400)'),
          const SizedBox(height: 6),
          _buildItemRow('Yield Treasury Buffer (Ondo/Kamino)', '\$74,050.00'),
          const SizedBox(height: 12),
          Text('CURRENT LIABILITIES (\$62,700.00)', style: ProximTextStyles.labelXs(color: ProximColors.statusWarning)),
          const SizedBox(height: 6),
          _buildItemRow('Accrued Payroll (Sep Cycle)', '\$42,650.00'),
          const SizedBox(height: 6),
          _buildItemRow('Accounts Payable & Cloud Retainers', '\$20,050.00'),
        ],
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
          Text(name, style: ProximTextStyles.bodySm()),
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
