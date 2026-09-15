import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../auth/presentation/auth_provider.dart';
import '../domain/invest_models.dart';
import 'invest_provider.dart';

enum TradeMode { buy, sell }

class InvestScreen extends ConsumerStatefulWidget {
  const InvestScreen({super.key});

  @override
  ConsumerState<InvestScreen> createState() => _InvestScreenState();
}

class _InvestScreenState extends ConsumerState<InvestScreen> {
  int _selectedSegment = 0; // 0 = Watchlist, 1 = Positions
  OndoStock? _selectedStock;
  TradeMode _tradeMode = TradeMode.buy;
  double _tradeAmount = 500.0;

  void _selectAmount(double amt) => setState(() => _tradeAmount = amt);

  @override
  Widget build(BuildContext context) {
    final stocksAsync = ref.watch(ondoStocksProvider);
    final positionsAsync = ref.watch(ondoPositionsProvider);
    final summary = ref.watch(portfolioSummaryProvider);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 108),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Invest',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -0.4)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: ProximColors.tertiary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(9999),
                  border: Border.all(color: ProximColors.tertiary.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(color: ProximColors.tertiary, shape: BoxShape.circle)),
                    const SizedBox(width: 6),
                    const Text('Market Open',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: ProximColors.tertiary)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Portfolio Summary Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: ProximColors.hairlineBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('PORTFOLIO VALUE',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: ProximColors.onSurfaceVariant, letterSpacing: 0.8)),
                const SizedBox(height: 8),
                positionsAsync.when(
                  data: (_) => Text(
                    '\$${summary.totalValue.toStringAsFixed(2)}',
                    style: const TextStyle(
                        fontSize: 34, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.8,
                        fontFeatures: [FontFeature.tabularFigures()]),
                  ),
                  loading: () => const Text('\$—',
                      style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800, color: Colors.white54)),
                  error: (error, stackTrace) => const Text('\$—',
                      style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800, color: Colors.white54)),
                ),
                const SizedBox(height: 10),
                if (summary.totalValue > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: (summary.totalGain >= 0 ? ProximColors.tertiary : ProximColors.error).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(9999),
                      border: Border.all(
                          color: (summary.totalGain >= 0 ? ProximColors.tertiary : ProximColors.error).withValues(alpha: 0.2)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(summary.totalGain >= 0 ? Icons.trending_up : Icons.trending_down,
                            size: 14,
                            color: summary.totalGain >= 0 ? ProximColors.tertiary : ProximColors.error),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            '${summary.totalGain >= 0 ? '+' : ''}\$${summary.totalGain.toStringAsFixed(2)} (${summary.totalGainPercent.toStringAsFixed(1)}%) all time',
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: summary.totalGain >= 0 ? ProximColors.tertiary : ProximColors.error,
                                fontFeatures: const [FontFeature.tabularFigures()]),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Segment Control
          Container(
            height: 40,
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: ProximColors.hairlineBorder),
            ),
            child: Row(
              children: [
                _buildSegmentTab('Watchlist', 0),
                _buildSegmentTab('Positions', 1),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Watchlist or Positions
          if (_selectedSegment == 0) ...[
            stocksAsync.when(
              data: (stocks) {
                if (stocks.isEmpty) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Text('No assets available.', style: TextStyle(color: ProximColors.onSurfaceVariant)),
                    ),
                  );
                }
                _selectedStock ??= stocks.first;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Watchlist', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
                        Text('${stocks.length} assets',
                            style: const TextStyle(fontSize: 12, color: ProximColors.onSurfaceVariant)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2, crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: 1.6),
                      itemCount: stocks.length,
                      itemBuilder: (context, index) {
                        final asset = stocks[index];
                        final isSelected = asset.symbol == (_selectedStock?.symbol ?? '');
                        return GestureDetector(
                          onTap: () => setState(() => _selectedStock = asset),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: ProximColors.surfaceContainerLow,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                  color: isSelected ? ProximColors.primary : ProximColors.subtleBorder,
                                  width: isSelected ? 1.5 : 1),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(asset.symbol,
                                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
                                    Text('${asset.isPositive ? '+' : ''}${asset.changePercent.toStringAsFixed(1)}%',
                                        style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: asset.isPositive ? ProximColors.tertiary : ProximColors.error,
                                            fontFeatures: const [FontFeature.tabularFigures()])),
                                  ],
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('\$${asset.price.toStringAsFixed(2)}',
                                        style: const TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w700,
                                            color: Colors.white,
                                            fontFeatures: [FontFeature.tabularFigures()])),
                                    Text(asset.name,
                                        style: const TextStyle(fontSize: 10, color: ProximColors.onSurfaceVariant)),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                );
              },
              loading: () => const Center(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2, value: 0.8),
                  ),
                ),
              ),
              error: (err, _) => _ErrorRetry(
                  message: 'Unable to load market data.',
                  onRetry: () => ref.invalidate(ondoStocksProvider)),
            ),
          ] else ...[
            positionsAsync.when(
              data: (positions) {
                if (positions.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Center(
                      child: Text('No positions yet. Buy an asset to get started.',
                          style: TextStyle(color: ProximColors.onSurfaceVariant, fontSize: 13)),
                    ),
                  );
                }
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Active Positions',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
                        Text('${positions.length} holdings',
                            style: const TextStyle(fontSize: 12, color: ProximColors.onSurfaceVariant)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: positions.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final pos = positions[index];
                        return Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: ProximColors.surfaceContainerLow,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: ProximColors.hairlineBorder),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(pos.symbol,
                                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
                                  const SizedBox(height: 2),
                                  Text('${pos.shares.toStringAsFixed(2)} shares · Avg \$${pos.avgCost.toStringAsFixed(2)}',
                                      style: const TextStyle(fontSize: 11, color: ProximColors.onSurfaceVariant)),
                                ],
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text('\$${pos.marketValue.toStringAsFixed(2)}',
                                      style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w700,
                                          color: Colors.white,
                                          fontFeatures: [FontFeature.tabularFigures()])),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${pos.isPositive ? '+' : ''}\$${pos.unrealizedGain.toStringAsFixed(2)} (${pos.returnPercent.toStringAsFixed(1)}%)',
                                    style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: pos.isPositive ? ProximColors.tertiary : ProximColors.error,
                                        fontFeatures: const [FontFeature.tabularFigures()]),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ],
                );
              },
              loading: () => const Center(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2, value: 0.8),
                  ),
                ),
              ),
              error: (err, _) => _ErrorRetry(
                  message: 'Unable to load positions.',
                  onRetry: () => ref.invalidate(ondoPositionsProvider)),
            ),
          ],

          const SizedBox(height: 24),

          // Quick Trade Panel (only on watchlist tab when stock selected)
          if (_selectedSegment == 0 && _selectedStock != null)
            stocksAsync.maybeWhen(
              data: (_) => _TradePanelCard(
                stock: _selectedStock!,
                tradeMode: _tradeMode,
                tradeAmount: _tradeAmount,
                onModeChanged: (m) => setState(() => _tradeMode = m),
                onAmountChanged: _selectAmount,
                onSubmit: () async {
                  final repo = ref.read(investRepositoryProvider);
                  final entity = ref.read(activeEntityProvider);
                  if (entity == null) return;
                  try {
                    if (_tradeMode == TradeMode.buy) {
                      await repo.buyStock(
                          symbol: _selectedStock!.symbol,
                          amountUsd: _tradeAmount,
                          entityId: entity.id);
                    } else {
                      await repo.sellStock(
                          symbol: _selectedStock!.symbol,
                          shares: _tradeAmount / _selectedStock!.price,
                          entityId: entity.id);
                    }
                    ref.invalidate(ondoPositionsProvider);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                            content: Text(
                                '${_tradeMode == TradeMode.buy ? 'Buy' : 'Sell'} order placed.')),
                      );
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context)
                          .showSnackBar(SnackBar(content: Text(e.toString())));
                    }
                  }
                },
              ),
              orElse: () => const SizedBox.shrink(),
            ),
        ],
      ),
    );
  }

  Widget _buildSegmentTab(String label, int index) {
    final isSelected = _selectedSegment == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedSegment = index),
        child: Container(
          decoration: BoxDecoration(
            color: isSelected ? ProximColors.surfaceContainerHigh : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
          ),
          alignment: Alignment.center,
          child: Text(label,
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                  color: isSelected ? Colors.white : ProximColors.onSurfaceVariant)),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade Panel Card
// ─────────────────────────────────────────────────────────────────────────────

class _TradePanelCard extends StatelessWidget {
  final OndoStock stock;
  final TradeMode tradeMode;
  final double tradeAmount;
  final ValueChanged<TradeMode> onModeChanged;
  final ValueChanged<double> onAmountChanged;
  final VoidCallback onSubmit;

  const _TradePanelCard({
    required this.stock,
    required this.tradeMode,
    required this.tradeAmount,
    required this.onModeChanged,
    required this.onAmountChanged,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final estimatedUnits = tradeAmount / stock.price;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(20),
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
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                        color: ProximColors.surfaceContainer, borderRadius: BorderRadius.circular(10)),
                    child: Center(
                      child: Text(stock.symbol.substring(0, 2),
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('MARKET ORDER',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: ProximColors.onSurfaceVariant, letterSpacing: 0.6)),
                      Text('${tradeMode == TradeMode.buy ? 'Buy' : 'Sell'} ${stock.symbol}',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(color: ProximColors.surfaceContainer, borderRadius: BorderRadius.circular(9999)),
                child: Row(
                  children: [
                    _tradeTab(context, 'Buy', TradeMode.buy),
                    _tradeTab(context, 'Sell', TradeMode.sell),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
                color: ProximColors.surfaceContainer,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: ProximColors.subtleBorder)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('AMOUNT',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: ProximColors.onSurfaceVariant, letterSpacing: 0.6)),
                  const SizedBox(height: 2),
                  Text('\$${tradeAmount.toStringAsFixed(0)}',
                      style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          fontFeatures: [FontFeature.tabularFigures()])),
                ]),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  const Text('EST. UNITS',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: ProximColors.onSurfaceVariant, letterSpacing: 0.6)),
                  const SizedBox(height: 2),
                  Text('${estimatedUnits.toStringAsFixed(3)} ${stock.symbol}',
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: ProximColors.primary,
                          fontFeatures: [FontFeature.tabularFigures()])),
                ]),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [100.0, 500.0, 1000.0, 2500.0].map((amt) {
              final isSelected = tradeAmount == amt;
              return Expanded(
                child: GestureDetector(
                  onTap: () => onAmountChanged(amt),
                  child: Container(
                    height: 32,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      color: isSelected ? ProximColors.primary.withValues(alpha: 0.15) : ProximColors.surfaceContainer,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                          color: isSelected ? ProximColors.primary.withValues(alpha: 0.4) : Colors.transparent),
                    ),
                    child: Center(
                      child: Text(amt == 2500 ? 'Max' : '\$${amt.toStringAsFixed(0)}',
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                              color: isSelected ? ProximColors.primary : Colors.white)),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: onSubmit,
              style: ElevatedButton.styleFrom(
                  backgroundColor: ProximColors.primary,
                  foregroundColor: ProximColors.surfaceContainerLowest,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Text('Review Order', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  SizedBox(width: 6),
                  Icon(Icons.arrow_forward, size: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tradeTab(BuildContext context, String label, TradeMode mode) {
    final isSelected = tradeMode == mode;
    return GestureDetector(
      onTap: () => onModeChanged(mode),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
            color: isSelected ? ProximColors.surfaceContainerHighest : Colors.transparent,
            borderRadius: BorderRadius.circular(9999)),
        child: Text(label,
            style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color: isSelected ? ProximColors.primary : ProximColors.onSurfaceVariant)),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
class _ErrorRetry extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorRetry({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          const Icon(Icons.wifi_off_outlined, size: 32, color: ProximColors.onSurfaceVariant),
          const SizedBox(height: 8),
          Text(message, style: const TextStyle(color: Colors.white70, fontSize: 13)),
          const SizedBox(height: 8),
          TextButton(
              onPressed: onRetry,
              child: const Text('Try again', style: TextStyle(color: ProximColors.primary))),
        ],
      ),
    );
  }
}
