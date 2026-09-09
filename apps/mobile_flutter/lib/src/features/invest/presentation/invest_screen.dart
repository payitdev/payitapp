import 'package:flutter/material.dart';

import '../../../core/theme/proxim_theme.dart';

enum TradeMode { buy, sell }

class AssetItem {
  final String symbol;
  final String name;
  final double price;
  final double changePercent;

  const AssetItem({
    required this.symbol,
    required this.name,
    required this.price,
    required this.changePercent,
  });
}

class InvestScreen extends StatefulWidget {
  const InvestScreen({super.key});

  @override
  State<InvestScreen> createState() => _InvestScreenState();
}

class _InvestScreenState extends State<InvestScreen> {
  static const List<AssetItem> _watchlist = [
    AssetItem(symbol: 'NVDA', name: 'NVIDIA Corp', price: 118.80, changePercent: 3.4),
    AssetItem(symbol: 'TSLA', name: 'Tesla Inc.', price: 214.20, changePercent: -1.2),
    AssetItem(symbol: 'MSFT', name: 'Microsoft Corp', price: 448.10, changePercent: 0.9),
    AssetItem(symbol: 'GOOGL', name: 'Alphabet Inc.', price: 178.40, changePercent: 2.1),
  ];

  late AssetItem _selectedAsset;
  TradeMode _tradeMode = TradeMode.buy;
  double _tradeAmount = 500.0;

  @override
  void initState() {
    super.initState();
    _selectedAsset = _watchlist.first;
  }

  void _selectAmount(double amt) {
    setState(() => _tradeAmount = amt);
  }

  @override
  Widget build(BuildContext context) {
    final estimatedUnits = _tradeAmount / _selectedAsset.price;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 108),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
        // Title
        const Text(
          'Invest',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: Colors.white,
            letterSpacing: -0.4,
          ),
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
              const Text(
                'PORTFOLIO VALUE',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: ProximColors.onSurfaceVariant,
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                '\$18,450.00',
                style: TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: -0.8,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: ProximColors.tertiary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(9999),
                  border: Border.all(color: ProximColors.tertiary.withValues(alpha: 0.2)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.trending_up, size: 14, color: ProximColors.tertiary),
                    SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        '+\$1,240.50 (+7.2%) all time',
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: ProximColors.tertiary,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Watchlist Header & Grid
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: const [
            Text(
              'Watchlist',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
            Text(
              '48 assets',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: ProximColors.onSurfaceVariant,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.6,
          ),
          itemCount: _watchlist.length,
          itemBuilder: (context, index) {
            final asset = _watchlist[index];
            final isSelected = asset.symbol == _selectedAsset.symbol;
            final isPos = asset.changePercent >= 0;

            return GestureDetector(
              onTap: () => setState(() => _selectedAsset = asset),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: ProximColors.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected
                        ? ProximColors.primary
                        : ProximColors.subtleBorder,
                    width: isSelected ? 1.5 : 1,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          asset.symbol,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                        Text(
                          '${isPos ? '+' : ''}${asset.changePercent.toStringAsFixed(1)}%',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: isPos ? ProximColors.tertiary : ProximColors.error,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '\$${asset.price.toStringAsFixed(2)}',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                        Text(
                          asset.name,
                          style: const TextStyle(
                            fontSize: 10,
                            color: ProximColors.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 24),

        // Quick Trade Panel
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: ProximColors.surfaceContainerLow,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: ProximColors.hairlineBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Trade header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: ProximColors.surfaceContainer,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Center(
                          child: Text(
                            _selectedAsset.symbol.substring(0, 2),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'MARKET ORDER',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: ProximColors.onSurfaceVariant,
                              letterSpacing: 0.6,
                            ),
                          ),
                          Text(
                            '${_tradeMode == TradeMode.buy ? 'Buy' : 'Sell'} ${_selectedAsset.symbol}',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),

                  // Buy / Sell switcher
                  Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: ProximColors.surfaceContainer,
                      borderRadius: BorderRadius.circular(9999),
                    ),
                    child: Row(
                      children: [
                        _buildTradeTab('Buy', TradeMode.buy),
                        _buildTradeTab('Sell', TradeMode.sell),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Amount Card
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: ProximColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: ProximColors.subtleBorder),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'AMOUNT',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: ProximColors.onSurfaceVariant,
                            letterSpacing: 0.6,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '\$${_tradeAmount.toStringAsFixed(0)}',
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text(
                          'EST. UNITS',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: ProximColors.onSurfaceVariant,
                            letterSpacing: 0.6,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${estimatedUnits.toStringAsFixed(3)} ${_selectedAsset.symbol}',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: ProximColors.primary,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Preset Buttons ($100, $500, $1000, Max)
              Row(
                children: [
                  _buildPresetButton(100),
                  const SizedBox(width: 8),
                  _buildPresetButton(500),
                  const SizedBox(width: 8),
                  _buildPresetButton(1000),
                  const SizedBox(width: 8),
                  _buildPresetButton(2500, label: 'Max'),
                ],
              ),
              const SizedBox(height: 16),

              // Review Order CTA
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          'Order reviewed: ${_tradeMode == TradeMode.buy ? 'Buying' : 'Selling'} \$${_tradeAmount.toStringAsFixed(0)} of ${_selectedAsset.symbol}',
                        ),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: ProximColors.primary,
                    foregroundColor: ProximColors.surfaceContainerLowest,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 0,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Text(
                        'Review Order',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      SizedBox(width: 6),
                      Icon(Icons.arrow_forward, size: 16),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
    );
  }

  Widget _buildTradeTab(String label, TradeMode mode) {
    final isSelected = _tradeMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _tradeMode = mode),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? ProximColors.surfaceContainerHighest : Colors.transparent,
          borderRadius: BorderRadius.circular(9999),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
            color: isSelected ? ProximColors.primary : ProximColors.onSurfaceVariant,
          ),
        ),
      ),
    );
  }

  Widget _buildPresetButton(double amount, {String? label}) {
    final isSelected = _tradeAmount == amount;
    return Expanded(
      child: GestureDetector(
        onTap: () => _selectAmount(amount),
        child: Container(
          height: 32,
          decoration: BoxDecoration(
            color: isSelected
                ? ProximColors.primary.withValues(alpha: 0.15)
                : ProximColors.surfaceContainer,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected
                  ? ProximColors.primary.withValues(alpha: 0.4)
                  : Colors.transparent,
            ),
          ),
          child: Center(
            child: Text(
              label ?? '\$${amount.toStringAsFixed(0)}',
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? ProximColors.primary : Colors.white,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
