import 'package:flutter/material.dart';

import '../../../core/theme/proxim_theme.dart';

class TreasuryDashboardScreen extends StatefulWidget {
  const TreasuryDashboardScreen({super.key});

  @override
  State<TreasuryDashboardScreen> createState() => _TreasuryDashboardScreenState();
}

class _TreasuryDashboardScreenState extends State<TreasuryDashboardScreen> {
  bool _hideBalance = false;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 108),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Company Organization Context Banner
          _buildCompanyBanner(),
          const SizedBox(height: 16),

          // 2. Consolidated Corporate Liquidity Hero Module
          _buildCorporateHeroCard(),
          const SizedBox(height: 16),

          // 3. Corporate Action Quick-Bar
          _buildCorporateQuickBar(context),
          const SizedBox(height: 16),

          // 4. Corporate Multi-Sig Urgent Alert Banner
          _buildMultiSigAlertBanner(context),
          const SizedBox(height: 20),

          // 5. Dedicated Treasury Sub-Account Pockets
          _buildTreasuryPocketsSection(),
          const SizedBox(height: 20),

          // 6. Corporate Cashflow Activity
          _buildRecentDispatchesSection(),
        ],
      ),
    );
  }

  Widget _buildCompanyBanner() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Row(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: ProximColors.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Center(
                  child: Icon(Icons.domain, size: 22, color: ProximColors.primary),
                ),
              ),
              Positioned(
                bottom: -1,
                right: -1,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: ProximColors.statusSuccess,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: ProximColors.statusSuccess.withValues(alpha: 0.8),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Acme Global Technologies Ltd',
                  style: ProximTextStyles.headlineSm(),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        'ID: ACM-884920-CORP',
                        style: ProximTextStyles.labelXs(),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Text('•', style: TextStyle(fontSize: 10, color: ProximColors.outline)),
                    const SizedBox(width: 6),
                    const Icon(Icons.verified, size: 12, color: ProximColors.statusSuccess),
                    const SizedBox(width: 3),
                    Text(
                      'KYB Tier 3',
                      style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess).copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            width: 32,
            height: 32,
            decoration: const BoxDecoration(
              color: ProximColors.surfaceContainerHighest,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.unfold_more, size: 18, color: ProximColors.onSurfaceVariant),
          ),
        ],
      ),
    );
  }

  Widget _buildCorporateHeroCard() {
    return Container(
      decoration: BoxDecoration(
        color: ProximColors.surfaceElevated,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: ProximColors.hairlineBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.5),
            blurRadius: 32,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 3,
              width: double.infinity,
              decoration: const BoxDecoration(
                gradient: ProximColors.auroraBarTrack,
                boxShadow: [
                  BoxShadow(
                    color: ProximColors.primary,
                    blurRadius: 10,
                    spreadRadius: 1,
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Row(
                          children: [
                            Flexible(
                              child: Text(
                                'TOTAL OPERATIONAL LIQUIDITY',
                                overflow: TextOverflow.ellipsis,
                                style: ProximTextStyles.labelSm().copyWith(
                                  letterSpacing: 0.8,
                                  color: ProximColors.onSurfaceVariant,
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            GestureDetector(
                              onTap: () => setState(() => _hideBalance = !_hideBalance),
                              child: Icon(
                                _hideBalance ? Icons.visibility_off : Icons.visibility,
                                size: 15,
                                color: ProximColors.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: ProximColors.surfaceContainerLowest,
                          borderRadius: BorderRadius.circular(9999),
                          border: Border.all(color: ProximColors.primary.withValues(alpha: 0.3)),
                        ),
                        child: Text(
                          'MULTI-ENTITY',
                          style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          _hideBalance ? '••••••••' : '\$482,950.00',
                          style: ProximTextStyles.displayXl().copyWith(
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'USD',
                          style: ProximTextStyles.headlineSm(color: ProximColors.primary),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '≈ ₦770,305,250 NGN  •  4 Connected Vaults',
                    style: ProximTextStyles.bodySm().copyWith(
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: ProximColors.surfaceContainerLowest.withValues(alpha: 0.7),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: ProximColors.subtleBorder),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Mo. Burn Rate', style: ProximTextStyles.labelXs()),
                              const SizedBox(height: 2),
                              Text(
                                '-\$34,200',
                                style: ProximTextStyles.headlineSm(color: ProximColors.statusDanger)
                                    .copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                              ),
                              const SizedBox(height: 2),
                              Text('Estimated avg', style: ProximTextStyles.labelXs()),
                            ],
                          ),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Net Runway', style: ProximTextStyles.labelXs()),
                              const SizedBox(height: 2),
                              Text(
                                '14.1 Mo',
                                style: ProximTextStyles.headlineSm(color: ProximColors.statusSuccess)
                                    .copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Safe tier',
                                style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess),
                              ),
                            ],
                          ),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('30D Inflow', style: ProximTextStyles.labelXs()),
                              const SizedBox(height: 2),
                              Text(
                                '+\$68,400',
                                style: ProximTextStyles.headlineSm(color: ProximColors.primary)
                                    .copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '↑ 18.4% MoM',
                                style: ProximTextStyles.labelXs(color: ProximColors.primary),
                              ),
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
      ),
    );
  }

  Widget _buildCorporateQuickBar(BuildContext context) {
    return Row(
      children: [
        _buildActionTile(
          icon: Icons.groups,
          label: 'Batch Payroll',
          onTap: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Opening Batch Payroll')),
            );
          },
        ),
        const SizedBox(width: 8),
        _buildActionTile(
          icon: Icons.receipt_long,
          label: 'New Invoice',
          onTap: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Opening Invoice Builder')),
            );
          },
        ),
        const SizedBox(width: 8),
        _buildActionTile(
          icon: Icons.currency_exchange,
          label: 'FX Convert',
          onTap: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Opening FX Quote & Convert')),
            );
          },
        ),
        const SizedBox(width: 8),
        _buildActionTile(
          icon: Icons.send_outlined,
          label: 'Treasury Wire',
          onTap: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Initiating Treasury Wire')),
            );
          },
        ),
      ],
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Column(
          children: [
            Container(
              height: 48,
              width: 48,
              decoration: BoxDecoration(
                color: ProximColors.surfaceContainerLow,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: ProximColors.hairlineBorder),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Center(
                child: Icon(icon, size: 22, color: ProximColors.primary),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              textAlign: TextAlign.center,
              style: ProximTextStyles.labelSm(color: Colors.white).copyWith(fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMultiSigAlertBanner(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainer,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: ProximColors.statusWarning,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: ProximColors.statusWarning.withValues(alpha: 0.9),
                            blurRadius: 8,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        '2 Pending Executive Approvals',
                        style: ProximTextStyles.headlineSm(),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: ProximColors.statusWarning.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(9999),
                ),
                child: Text(
                  'Action Required',
                  style: ProximTextStyles.labelXs(color: ProximColors.statusWarning).copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: const BoxDecoration(
                    color: ProximColors.surfaceContainerHigh,
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Icon(Icons.vpn_key, size: 16, color: ProximColors.statusWarning),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '\$24,500.00 USDC • AWS Cloud & Nodes',
                        style: ProximTextStyles.bodySm(color: Colors.white).copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Text(
                            '1 of 2 Signed',
                            style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              '(CFO signed 14m ago)',
                              style: ProximTextStyles.labelXs(),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Text(
                  'Threshold: 2-of-3 Hardware Sig',
                  style: ProximTextStyles.labelSm(),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Opening Multi-Sig Review Queue')),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: ProximColors.primary,
                    borderRadius: BorderRadius.circular(9999),
                  ),
                  child: Row(
                    children: [
                      Text(
                        'Review Queue',
                        style: ProximTextStyles.labelSm(color: ProximColors.onPrimary).copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.arrow_forward, size: 12, color: ProximColors.onPrimary),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTreasuryPocketsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Row(
                children: [
                  Flexible(
                    child: Text(
                      'Treasury Pockets',
                      style: ProximTextStyles.headlineSm(),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: ProximColors.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(9999),
                    ),
                    child: Text('3 Active', style: ProximTextStyles.labelXs()),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '+ New Pocket',
              style: ProximTextStyles.labelSm(color: ProximColors.primary).copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _buildPocketCard(
          icon: Icons.account_balance_wallet_outlined,
          iconColor: ProximColors.primary,
          title: 'USD Operational Cash',
          tag: 'Base',
          subtitle: 'Instant settlement available',
          balance: '\$284,500.00',
          balanceSub: 'USDC Balance',
          isLive: true,
        ),
        _buildPocketCard(
          icon: Icons.assured_workload_outlined,
          iconColor: ProximColors.secondary,
          title: 'NGN Local Clearing',
          tag: 'NIBSS',
          subtitle: 'Virtual IBAN • Wema Rail',
          balance: '₦198.40M',
          balanceSub: '≈ \$124,400.00 USD',
        ),
        _buildPocketCard(
          icon: Icons.trending_up,
          iconColor: ProximColors.tertiary,
          title: 'Yield Treasury Buffer',
          tag: '11.2% APY',
          subtitle: 'Kamino & Pods • Auto-compound',
          balance: '\$74,050.00',
          balanceSub: '+ \$23.10 / day',
          tagColor: ProximColors.primary,
        ),
      ],
    );
  }

  Widget _buildPocketCard({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String tag,
    required String subtitle,
    required String balance,
    required String balanceSub,
    bool isLive = false,
    Color? tagColor,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
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
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Center(
                    child: Icon(icon, size: 20, color: iconColor),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              title,
                              style: ProximTextStyles.bodySm(color: Colors.white).copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(
                              color: (tagColor ?? ProximColors.surfaceContainer).withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(9999),
                            ),
                            child: Text(
                              tag,
                              style: ProximTextStyles.labelXs(color: tagColor ?? ProximColors.onSurfaceVariant)
                                  .copyWith(fontWeight: FontWeight.w700),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          if (isLive) ...[
                            Container(
                              width: 5,
                              height: 5,
                              decoration: const BoxDecoration(
                                color: ProximColors.statusSuccess,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 4),
                          ],
                          Flexible(
                            child: Text(
                              subtitle,
                              overflow: TextOverflow.ellipsis,
                              style: ProximTextStyles.labelXs(
                                color: isLive ? ProximColors.statusSuccess : ProximColors.onSurfaceVariant,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                balance,
                style: ProximTextStyles.headlineSm().copyWith(
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(height: 1),
              Text(balanceSub, style: ProximTextStyles.labelXs()),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRecentDispatchesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(
              child: Text(
                'Recent Dispatches & Inflows',
                style: ProximTextStyles.headlineSm(),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Full Ledger →',
              style: ProximTextStyles.labelSm(color: ProximColors.primary).copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _buildDispatchTile(
          icon: Icons.south_west,
          iconColor: ProximColors.statusSuccess,
          title: 'Inbound #INV-2026-088',
          subtitle: 'Stripe Inc • Settled 2h ago',
          amount: '+\$45,000.00',
          amountSub: 'USDC (Base)',
          isPositive: true,
        ),
        _buildDispatchTile(
          icon: Icons.north_east,
          iconColor: ProximColors.onSurfaceVariant,
          title: 'Batch Payroll • Eng Sprint',
          subtitle: '8 recipients • Base Mainnet',
          amount: '-\$18,450.00',
          amountSub: 'USDC Dispatch',
          isPositive: false,
        ),
        _buildDispatchTile(
          icon: Icons.autorenew,
          iconColor: ProximColors.primary,
          title: 'Yield Harvest Distribution',
          subtitle: 'Kamino Vault → Buffer',
          amount: '+\$684.20',
          amountSub: 'USDC Earned',
          isPositive: true,
        ),
      ],
    );
  }

  Widget _buildDispatchTile({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required String amount,
    required String amountSub,
    required bool isPositive,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
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
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainer,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Center(
                    child: Icon(icon, size: 18, color: iconColor),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: ProximTextStyles.bodySm(color: Colors.white).copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: ProximTextStyles.labelXs(),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                amount,
                style: ProximTextStyles.headlineSm(
                  color: isPositive ? ProximColors.statusSuccess : Colors.white,
                ).copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
              ),
              const SizedBox(height: 1),
              Text(amountSub, style: ProximTextStyles.labelXs()),
            ],
          ),
        ],
      ),
    );
  }
}
