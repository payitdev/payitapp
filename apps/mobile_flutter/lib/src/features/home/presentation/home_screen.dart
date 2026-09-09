import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/aurora_balance_card.dart';
import '../../../core/widgets/kyc_banner.dart';
import '../../../core/widgets/quick_action_buttons.dart';
import '../../../core/widgets/transaction_tile.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 108),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
        // 1. User Greeting & Notifications Row
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'WELCOME BACK',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: ProximColors.onSurfaceVariant,
                    letterSpacing: 0.8,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Alex Rivera',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    letterSpacing: -0.4,
                  ),
                ),
              ],
            ),
            GestureDetector(
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('No new notifications')),
                );
              },
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: ProximColors.surfaceContainerLow,
                  shape: BoxShape.circle,
                  border: Border.all(color: ProximColors.hairlineBorder),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    const Icon(
                      Icons.notifications_none,
                      size: 20,
                      color: Colors.white,
                    ),
                    Positioned(
                      top: 10,
                      right: 10,
                      child: Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: ProximColors.primary,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: ProximColors.primary.withValues(alpha: 0.8),
                              blurRadius: 6,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),

        // 2. Aurora Balance Card
        const AuroraBalanceCard(
          amount: 48250.00,
          trendText: '+\$340.20 (+0.71%)',
          isPositiveTrend: true,
        ),
        const SizedBox(height: 20),

        // 3. Primary Quick Actions
        const QuickActionButtons(),
        const SizedBox(height: 20),

        // 4. KYC Status Banner
        const KycBanner(),
        const SizedBox(height: 24),

        // 5. Pockets & Liquidity Breakdown
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: const [
            Text(
              'Pockets',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                letterSpacing: -0.2,
              ),
            ),
            Text(
              '3 accounts',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: ProximColors.onSurfaceVariant,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _buildPocketRow(
          icon: Icons.payments_outlined,
          iconColor: ProximColors.primary,
          title: 'Cash',
          amount: '\$24,100.00',
        ),
        _buildPocketRow(
          icon: Icons.attach_money,
          iconColor: ProximColors.secondary,
          title: 'Digital Dollar',
          amount: '\$14,150.00',
        ),
        _buildPocketRow(
          icon: Icons.savings_outlined,
          iconColor: ProximColors.tertiary,
          title: 'Vault Savings',
          amount: '\$10,000.00',
          badgeText: '11.2% APY',
        ),
        const SizedBox(height: 24),

        // 6. Recent Activity Feed
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Recent Activity',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                letterSpacing: -0.2,
              ),
            ),
            GestureDetector(
              onTap: () => context.go('/activity'),
              child: const Row(
                children: [
                  Text(
                    'View all',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: ProximColors.primary,
                    ),
                  ),
                  SizedBox(width: 2),
                  Icon(
                    Icons.chevron_right,
                    size: 14,
                    color: ProximColors.primary,
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        const TransactionTile(
          item: TransactionItem(
            id: 'tx-1',
            title: 'Sent to Sarah Jenkins',
            subtitle: 'Today, 4:12 PM',
            amount: 250.00,
            type: TransactionType.sent,
          ),
        ),
        const TransactionTile(
          item: TransactionItem(
            id: 'tx-2',
            title: 'Received from ACME Corp',
            subtitle: 'Yesterday',
            amount: 3400.00,
            type: TransactionType.received,
          ),
        ),
        const TransactionTile(
          item: TransactionItem(
            id: 'tx-3',
            title: 'Vault Yield',
            subtitle: 'May 18',
            amount: 120.00,
            type: TransactionType.yieldReturn,
          ),
        ),
      ],
    ),
    );
  }

  static Widget _buildPocketRow({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String amount,
    String? badgeText,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ProximColors.subtleBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Icon(icon, size: 18, color: iconColor),
                  ),
                ),
                const SizedBox(width: 12),
                Flexible(
                  child: Text(
                    title,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
                if (badgeText != null) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: ProximColors.tertiary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(9999),
                    ),
                    child: Text(
                      badgeText,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: ProximColors.tertiary,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            amount,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
