import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../auth/presentation/auth_provider.dart';
import '../domain/treasury_metrics.dart';
import '../domain/treasury_models.dart';
import 'treasury_provider.dart';

class TreasuryDashboardScreen extends ConsumerStatefulWidget {
  const TreasuryDashboardScreen({super.key});

  @override
  ConsumerState<TreasuryDashboardScreen> createState() => _TreasuryDashboardScreenState();
}

class _TreasuryDashboardScreenState extends ConsumerState<TreasuryDashboardScreen> {
  bool _hideBalance = false;
  final NumberFormat _moneyFormat = NumberFormat('#,##0.00', 'en_US');

  String _currencySymbol(String currency) {
    switch (currency) {
      case 'NGN':
        return '₦';
      case 'EUR':
        return '€';
      case 'GBP':
        return '£';
      default:
        return '\$';
    }
  }

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

          // 5. Corporate Cashflow Activity
          _buildRecentDispatchesSection(),
        ],
      ),
    );
  }

  Widget _buildCompanyBanner() {
    final activeEntity = ref.watch(activeEntityProvider);
    final companyName = activeEntity?.legalName ?? 'Business Account';
    final businessTag = activeEntity?.businessTag;
    final isVerified = activeEntity?.isKycApproved ?? false;
    final verificationLabel = activeEntity?.isBusiness == true ? 'KYB Tier 2' : 'KYC Tier 1';

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
                  companyName,
                  style: ProximTextStyles.headlineSm(),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    if (businessTag != null) ...[
                      Flexible(
                        child: Text(
                          'ID: $businessTag',
                          style: ProximTextStyles.labelXs(),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text('•', style: TextStyle(fontSize: 10, color: ProximColors.outline)),
                      const SizedBox(width: 6),
                    ],
                    if (isVerified) ...[
                      const Icon(Icons.verified, size: 12, color: ProximColors.statusSuccess),
                      const SizedBox(width: 3),
                      Text(
                        verificationLabel,
                        style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess).copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
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
    final metricsAsync = ref.watch(treasuryMetricsProvider);

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
                                'Balance',
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
                  metricsAsync.when(
                    loading: () => const _TreasuryHeroSkeleton(),
                    error: (err, _) => _TreasuryHeroError(
                      onRetry: () => ref.invalidate(treasuryMetricsProvider),
                    ),
                    data: (metrics) => _buildHeroMetricsBody(metrics),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeroMetricsBody(TreasuryMetrics metrics) {
    final symbol = _currencySymbol(metrics.currency);
    final money = _moneyFormat.format;
    final vaultLabel =
        '${metrics.vaultCount} Connected Vault${metrics.vaultCount == 1 ? '' : 's'}';
    final ngnLine = metrics.ngnEquivalent != null
        ? '≈ ₦${money(metrics.ngnEquivalent!)} NGN  •  $vaultLabel'
        : vaultLabel;

    final runwayColor = switch (metrics.runwayTier) {
      'Safe' => ProximColors.statusSuccess,
      'Watch' => ProximColors.statusWarning,
      _ => ProximColors.statusDanger,
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                _hideBalance ? '••••••••' : '$symbol${money(metrics.balance)}',
                style: ProximTextStyles.displayXl().copyWith(
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                metrics.currency,
                style: ProximTextStyles.headlineSm(color: ProximColors.primary),
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Text(
          ngnLine,
          style: ProximTextStyles.bodySm().copyWith(
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
        const SizedBox(height: 16),
        GestureDetector(
          onTap: () => context.push('/balance-sheet'),
          child: Container(
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
                        '-$symbol${money(metrics.monthlyBurn)}',
                        style: ProximTextStyles.headlineSm(color: ProximColors.statusDanger)
                            .copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        metrics.burnIsEstimate ? 'Estimated avg' : 'Trailing avg',
                        style: ProximTextStyles.labelXs(),
                      ),
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
                        metrics.runwayMonths != null
                            ? '${metrics.runwayMonths!.toStringAsFixed(1)} Mo'
                            : '—',
                        style: ProximTextStyles.headlineSm(color: runwayColor)
                            .copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${metrics.runwayTier} tier',
                        style: ProximTextStyles.labelXs(color: runwayColor),
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
                        '+$symbol${money(metrics.inflowLast30d)}',
                        style: ProximTextStyles.headlineSm(color: ProximColors.primary)
                            .copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        metrics.inflowMomPct != null
                            ? '${metrics.inflowImproved ? '↑' : '↓'} ${metrics.inflowMomPct!.toStringAsFixed(1)}% MoM'
                            : '+$symbol${money(metrics.inflowLast30d)} last 30D',
                        style: ProximTextStyles.labelXs(color: ProximColors.primary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCorporateQuickBar(BuildContext context) {
    return Row(
      children: [
        _buildActionTile(
          icon: Icons.groups,
          label: 'Batch Payroll',
          onTap: () => context.push('/payroll'),
        ),
        const SizedBox(width: 8),
        _buildActionTile(
          icon: Icons.receipt_long,
          label: 'New Invoice',
          onTap: () => context.push('/invoices'),
        ),
        const SizedBox(width: 8),
        _buildActionTile(
          icon: Icons.south_west,
          label: 'Receive',
          onTap: () => context.push('/receive'),
        ),
        const SizedBox(width: 8),
        _buildActionTile(
          icon: Icons.send_outlined,
          label: 'Treasury Wire',
          onTap: () => context.push('/send'),
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
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: ProximTextStyles.labelSm(color: Colors.white).copyWith(fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMultiSigAlertBanner(BuildContext context) {
    final approvalsAsync = ref.watch(pendingApprovalsProvider);
    final approvals = approvalsAsync.value ?? const <PendingApproval>[];

    // The banner is data-driven: it renders only while there are pending
    // approvals. Loading or a missing backend endpoint means nothing to show.
    if (approvals.isEmpty) {
      return const SizedBox.shrink();
    }

    final approval = approvals.first;
    final symbol = _currencySymbol(approval.currency);
    final money = _moneyFormat.format;
    final description = approval.description ?? approval.title;

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
                        '${approvals.length} Pending Executive Approval${approvals.length == 1 ? '' : 's'}',
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
                        '$symbol${money(approval.amount)} ${approval.currency} • $description',
                        style: ProximTextStyles.bodySm(color: Colors.white).copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${approval.signedCount} of ${approval.requiredSignatures} Signed',
                        style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                          fontWeight: FontWeight.w600,
                        ),
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
                  'Threshold: ${approval.requiredSignatures} signature${approval.requiredSignatures == 1 ? '' : 's'} required',
                  style: ProximTextStyles.labelSm(),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => context.push('/multi-sig'),
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

  Widget _buildRecentDispatchesSection() {
    final historyAsync = ref.watch(treasuryHistoryProvider);

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
        historyAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2, value: 0.8),
              ),
            ),
          ),
          error: (err, _) => _HistoryError(
            onRetry: () => ref.invalidate(treasuryHistoryProvider),
          ),
          data: (items) {
            if (items.isEmpty) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Text(
                    'No activity yet',
                    style: TextStyle(
                      fontSize: 13,
                      color: ProximColors.onSurfaceVariant,
                    ),
                  ),
                ),
              );
            }
            return Column(
              children: [
                for (final item in items)
                  _buildDispatchTile(
                    icon: item.isInbound ? Icons.south_west : Icons.north_east,
                    iconColor:
                        item.isInbound ? ProximColors.statusSuccess : ProximColors.onSurfaceVariant,
                    title: item.title,
                    subtitle: item.subtitle.isEmpty
                        ? '${item.date} • ${item.time}'
                        : '${item.subtitle} • ${item.date}',
                    amount:
                        '${item.isInbound ? '+' : '-'}${item.symbol}${_moneyFormat.format(item.amount)}',
                    amountSub: item.currency,
                    isPositive: item.isInbound,
                  ),
              ],
            );
          },
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

/// Loading placeholder for the hero card, mirroring the cards-screen
/// skeleton pattern: a bordered surface with a centered progress indicator.
class _TreasuryHeroSkeleton extends StatelessWidget {
  const _TreasuryHeroSkeleton();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 150,
      width: double.infinity,
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: const Center(
        child: SizedBox(
          width: 28,
          height: 28,
          child: CircularProgressIndicator(strokeWidth: 2, value: 0.8),
        ),
      ),
    );
  }
}

/// Compact retry affordance scoped to the hero card — a metrics failure
/// must not take down the rest of the dashboard.
class _TreasuryHeroError extends StatelessWidget {
  final VoidCallback onRetry;
  const _TreasuryHeroError({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_outlined, size: 16, color: ProximColors.onSurfaceVariant),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Unable to load treasury metrics.',
              style: ProximTextStyles.labelSm(color: ProximColors.onSurfaceVariant),
            ),
          ),
          GestureDetector(
            onTap: onRetry,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: ProximColors.primary,
                borderRadius: BorderRadius.circular(9999),
              ),
              child: Text(
                'Retry',
                style: ProximTextStyles.labelSm(color: ProximColors.onPrimary).copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Compact retry affordance for the recent-activity section.
class _HistoryError extends StatelessWidget {
  final VoidCallback onRetry;
  const _HistoryError({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_outlined, size: 16, color: ProximColors.onSurfaceVariant),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Unable to load activity.',
              style: ProximTextStyles.labelSm(color: ProximColors.onSurfaceVariant),
            ),
          ),
          GestureDetector(
            onTap: onRetry,
            child: Text(
              'Retry',
              style: ProximTextStyles.labelSm(color: ProximColors.primary).copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
