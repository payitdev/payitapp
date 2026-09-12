import 'dart:ui';
import 'package:flutter/material.dart';

import '../theme/proxim_theme.dart';

class CurrencyOption {
  final String code;
  final String flag;
  final String symbol;

  const CurrencyOption({
    required this.code,
    required this.flag,
    required this.symbol,
  });
}

class AuroraBalanceCard extends StatefulWidget {
  final String? label;
  final double amount;
  final String trendText;
  final bool isPositiveTrend;
  final ValueChanged<CurrencyOption>? onCurrencyChanged;

  const AuroraBalanceCard({
    super.key,
    this.label,
    this.amount = 48250.00,
    this.trendText = '+\$340.20 (+0.71%)',
    this.isPositiveTrend = true,
    this.onCurrencyChanged,
  });

  @override
  State<AuroraBalanceCard> createState() => _AuroraBalanceCardState();
}

class _AuroraBalanceCardState extends State<AuroraBalanceCard> {
  static const List<CurrencyOption> _currencies = [
    CurrencyOption(code: 'USD', flag: '🇺🇸', symbol: '\$'),
    CurrencyOption(code: 'NGN', flag: '🇳🇬', symbol: '₦'),
    CurrencyOption(code: 'EUR', flag: '🇪🇺', symbol: '€'),
    CurrencyOption(code: 'GBP', flag: '🇬🇧', symbol: '£'),
  ];

  int _selectedCurrencyIndex = 0;

  void _cycleCurrency() {
    setState(() {
      _selectedCurrencyIndex = (_selectedCurrencyIndex + 1) % _currencies.length;
    });
    widget.onCurrencyChanged?.call(_currencies[_selectedCurrencyIndex]);
  }

  @override
  Widget build(BuildContext context) {
    final currency = _currencies[_selectedCurrencyIndex];

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: Stack(
        children: [
          // Background card container
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: ProximColors.hairlineBorder),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.35),
                  blurRadius: 32,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header row: Label + Currency Selector
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        widget.label ?? 'Across 3 accounts · tap to switch',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: ProximColors.onSurfaceVariant,
                          letterSpacing: 0.2,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: _cycleCurrency,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: ProximColors.surfaceContainerHigh.withValues(alpha: 0.8),
                          borderRadius: BorderRadius.circular(9999),
                          border: Border.all(color: ProximColors.hairlineBorder),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(currency.flag, style: const TextStyle(fontSize: 12)),
                            const SizedBox(width: 6),
                            Text(
                              currency.code,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Icon(
                              Icons.expand_more,
                              size: 14,
                              color: ProximColors.onSurfaceVariant,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Numerical Balance Display
                Text(
                  '${currency.symbol}${widget.amount.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontSize: 38,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    letterSpacing: -1.0,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(height: 10),

                // 24h Trend Pill
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: ProximColors.tertiary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(9999),
                    border: Border.all(
                      color: ProximColors.tertiary.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        widget.isPositiveTrend ? Icons.trending_up : Icons.trending_down,
                        size: 14,
                        color: ProximColors.tertiary,
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          widget.trendText,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
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

          // Mesh glow overlay top right
          Positioned(
            top: -40,
            right: -40,
            child: Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ProximColors.primary.withValues(alpha: 0.12),
              ),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 40, sigmaY: 40),
                child: const SizedBox.shrink(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
