import 'package:flutter/material.dart';

import '../theme/proxim_theme.dart';

enum TransactionType { sent, received, yieldReturn }

class TransactionItem {
  final String id;
  final String title;
  final String subtitle;
  final double amount;
  final String currencySymbol;
  final TransactionType type;

  const TransactionItem({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.amount,
    this.currencySymbol = '\$',
    required this.type,
  });
}

class TransactionTile extends StatelessWidget {
  final TransactionItem item;
  final VoidCallback? onTap;

  const TransactionTile({
    super.key,
    required this.item,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isCredit = item.type != TransactionType.sent;
    final amountColor = isCredit ? ProximColors.tertiary : Colors.white;
    final prefix = isCredit ? '+' : '-';

    IconData icon;
    Color iconColor;

    switch (item.type) {
      case TransactionType.sent:
        icon = Icons.north_east;
        iconColor = ProximColors.onSurfaceVariant;
        break;
      case TransactionType.received:
        icon = Icons.south_west;
        iconColor = ProximColors.tertiary;
        break;
      case TransactionType.yieldReturn:
        icon = Icons.autorenew;
        iconColor = ProximColors.primary;
        break;
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: ProximColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: ProximColors.subtleBorder),
        ),
        child: Row(
          children: [
            // Icon container
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: ProximColors.surfaceContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Icon(icon, size: 18, color: iconColor),
              ),
            ),
            const SizedBox(width: 12),

            // Counterparty / details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item.subtitle,
                    style: const TextStyle(
                      fontSize: 11,
                      color: ProximColors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),

            // Amount
            Text(
              '$prefix${item.currencySymbol}${item.amount.abs().toStringAsFixed(2)}',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: amountColor,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
