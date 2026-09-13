import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers/account_mode_provider.dart';
import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/aurora_balance_card.dart';
import '../../../core/widgets/kyc_banner.dart';
import '../../../core/widgets/quick_action_buttons.dart';
import '../../../core/widgets/transaction_tile.dart';
import '../../auth/presentation/auth_provider.dart';
import '../../treasury/presentation/treasury_dashboard_screen.dart';

/// Dynamic Home Screen that renders:
/// - The Proxim Aurora Treasury Dashboard when in Business mode (default)
/// - The Consumer Personal Banking Dashboard when in Personal mode
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(accountModeProvider);

    if (mode == AccountMode.business) {
      return const TreasuryDashboardScreen();
    }

    return const _PersonalHomeView();
  }
}

class _PersonalHomeView extends ConsumerWidget {
  const _PersonalHomeView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final userName = user?.fullName ?? 'Alex Rivera';

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
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'WELCOME BACK',
                    style: ProximTextStyles.labelSm().copyWith(letterSpacing: 0.8),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    userName,
                    style: ProximTextStyles.headlineLg(),
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

          // 5. Savings Overview
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: ProximColors.hairlineBorder),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: ProximColors.tertiary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Center(
                          child: Icon(Icons.savings_outlined, size: 20, color: ProximColors.tertiary),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Savings Balance',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Earning up to 11.2% APY',
                              style: ProximTextStyles.labelXs(color: ProximColors.tertiary),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => context.go('/savings'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: ProximColors.surfaceContainerHigh,
                      borderRadius: BorderRadius.circular(9999),
                      border: Border.all(color: ProximColors.hairlineBorder),
                    ),
                    child: const Text(
                      'View Savings',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // 6. Recent Activity Feed
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Recent Activity', style: ProximTextStyles.headlineSm()),
              GestureDetector(
                onTap: () => context.go('/activity'),
                child: Row(
                  children: [
                    Text(
                      'View all',
                      style: ProximTextStyles.labelSm(color: ProximColors.primary).copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 2),
                    const Icon(
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
}
