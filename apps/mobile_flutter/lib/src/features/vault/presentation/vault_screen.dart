import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/proxim_theme.dart';
import '../domain/vault_models.dart';
import 'vault_provider.dart';

class LockOption {
  final String label;
  final String duration;
  final double apy;
  const LockOption({required this.label, required this.duration, required this.apy});
}

class VaultScreen extends ConsumerStatefulWidget {
  const VaultScreen({super.key});

  @override
  ConsumerState<VaultScreen> createState() => _VaultScreenState();
}

class _VaultScreenState extends ConsumerState<VaultScreen> {
  static const List<LockOption> _lockOptions = [
    LockOption(label: 'Flexible', duration: 'No lock', apy: 8.4),
    LockOption(label: '30 Days', duration: '1 month', apy: 9.6),
    LockOption(label: '90 Days', duration: '3 months', apy: 11.2),
    LockOption(label: '1 Year', duration: '12 months', apy: 13.5),
  ];

  int _selectedLockIndex = 2;
  final double _depositAmount = 1000.0;

  @override
  Widget build(BuildContext context) {
    final summaryAsync = ref.watch(savingsSummaryProvider);
    final selectedOption = _lockOptions[_selectedLockIndex];
    final estimatedAnnualYield = _depositAmount * (selectedOption.apy / 100);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 108),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Savings',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -0.4)),
          const SizedBox(height: 16),

          // ── Live Savings Hero Card ──────────────────────────────────────────
          summaryAsync.when(
            data: (summary) => _SavingsHeroCard(summary: summary),
            loading: () => _SavingsHeroCard.placeholder(),
            error: (err, _) => _SavingsErrorCard(onRetry: () => ref.invalidate(savingsSummaryProvider)),
          ),
          const SizedBox(height: 16),

          // ── Smart Auto-Save Toggle ──────────────────────────────────────────
          Container(
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
                    const Row(
                      children: [
                        Icon(Icons.auto_mode, size: 18, color: ProximColors.tertiary),
                        SizedBox(width: 8),
                        Text('Smart Auto-Save',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                          color: ProximColors.tertiary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(9999)),
                      child: const Text('Active',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: ProximColors.tertiary)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Automatically moves idle funds above your liquid buffer into high-yield savings.',
                  style: TextStyle(fontSize: 12, color: ProximColors.onSurfaceVariant, height: 1.4),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 36,
                  child: OutlinedButton(
                    onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Saved idle funds into high-yield strategies.')),
                    ),
                    style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: ProximColors.hairlineBorder),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        padding: const EdgeInsets.symmetric(horizontal: 14)),
                    child: const Text('Save now', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ── Active Strategies (live) ─────────────────────────────────────
          const Text('Active Strategies',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
          const SizedBox(height: 12),

          summaryAsync.when(
            data: (summary) {
              if (summary.strategies.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Text('No active strategies yet.',
                      style: TextStyle(color: ProximColors.onSurfaceVariant, fontSize: 13)),
                );
              }
              return Column(
                children: summary.strategies
                    .map((s) => _buildStrategyCard(
                          title: s.name,
                          protocol: s.protocol,
                          balance: '\$${s.currentValue.toStringAsFixed(2)}',
                          apy: '${s.apyPercent.toStringAsFixed(1)}% APY',
                        ))
                    .toList(),
              );
            },
            loading: () => Column(
              children: [
                _buildStrategyCard(title: '—', protocol: 'Loading...', balance: '\$—', apy: '—'),
                _buildStrategyCard(title: '—', protocol: 'Loading...', balance: '\$—', apy: '—'),
              ],
            ),
            error: (error, stackTrace) => const SizedBox.shrink(),
          ),
          const SizedBox(height: 24),

          // ── New Allocation Panel ────────────────────────────────────────────
          const Text('New Allocation',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
          const SizedBox(height: 12),
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
                const Text('SELECT LOCK PERIOD',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: ProximColors.onSurfaceVariant, letterSpacing: 0.6)),
                const SizedBox(height: 10),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2, crossAxisSpacing: 8, mainAxisSpacing: 8, childAspectRatio: 2.2),
                  itemCount: _lockOptions.length,
                  itemBuilder: (context, index) {
                    final opt = _lockOptions[index];
                    final isSelected = _selectedLockIndex == index;
                    return GestureDetector(
                      onTap: () => setState(() => _selectedLockIndex = index),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? ProximColors.tertiary.withValues(alpha: 0.12)
                              : ProximColors.surfaceContainer,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: isSelected ? ProximColors.tertiary : ProximColors.subtleBorder),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(opt.label,
                                style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: isSelected ? Colors.white : ProximColors.onSurface)),
                            Text('${opt.apy}% APY',
                                style: const TextStyle(
                                    fontSize: 11, fontWeight: FontWeight.w600, color: ProximColors.tertiary)),
                          ],
                        ),
                      ),
                    );
                  },
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
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Text('DEPOSIT AMOUNT',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: ProximColors.onSurfaceVariant, letterSpacing: 0.6)),
                          const SizedBox(height: 2),
                          Text('\$${_depositAmount.toStringAsFixed(0)}',
                              style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                  fontFeatures: [FontFeature.tabularFigures()])),
                        ]),
                      ),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                          const Text('EST. ANNUAL YIELD',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: ProximColors.onSurfaceVariant, letterSpacing: 0.6)),
                          const SizedBox(height: 2),
                          Text('+\$${estimatedAnnualYield.toStringAsFixed(2)}',
                              style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: ProximColors.tertiary,
                                  fontFeatures: [FontFeature.tabularFigures()])),
                        ]),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: () async {
                      final repo = ref.read(vaultRepositoryProvider);
                      final summary = ref.read(savingsSummaryProvider).value;
                      final strategyId = summary?.strategies.isNotEmpty == true
                          ? summary!.strategies.first.id
                          : 'default';
                      try {
                        await repo.deposit(
                            strategyId: strategyId,
                            amount: _depositAmount,
                            currency: 'USD');
                        ref.invalidate(savingsSummaryProvider);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(
                                'Locked \$${_depositAmount.toStringAsFixed(0)} in ${selectedOption.label} vault.')),
                          );
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(e.toString())),
                          );
                        }
                      }
                    },
                    style: ElevatedButton.styleFrom(
                        backgroundColor: ProximColors.tertiary,
                        foregroundColor: ProximColors.surfaceContainerLowest,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.lock_outline, size: 16),
                        SizedBox(width: 8),
                        Text('Lock & Earn', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
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

  Widget _buildStrategyCard({
    required String title,
    required String protocol,
    required String balance,
    required String apy,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
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
                      color: ProximColors.surfaceContainer, borderRadius: BorderRadius.circular(12)),
                  child: const Center(
                    child: Icon(Icons.account_balance_wallet_outlined, size: 18, color: ProximColors.tertiary),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(title,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                    Text(protocol,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11, color: ProximColors.onSurfaceVariant)),
                  ]),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(balance,
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    fontFeatures: [FontFeature.tabularFigures()])),
            Text(apy,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: ProximColors.tertiary)),
          ]),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero Card variants
// ─────────────────────────────────────────────────────────────────────────────

class _SavingsHeroCard extends StatelessWidget {
  final SavingsSummary? summary;
  const _SavingsHeroCard({this.summary});

  factory _SavingsHeroCard.placeholder() => const _SavingsHeroCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Expanded(
            child: Text('TOTAL SAVINGS',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: ProximColors.onSurfaceVariant, letterSpacing: 0.8),
                overflow: TextOverflow.ellipsis),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
                color: ProximColors.tertiary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(9999)),
            child: Text(
              summary != null ? '${summary!.apyPercent.toStringAsFixed(1)}% Avg. APY' : '—',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: ProximColors.tertiary),
            ),
          ),
        ]),
        const SizedBox(height: 10),
        Text(
          summary != null ? '\$${summary!.totalBalance.toStringAsFixed(2)}' : '\$—',
          style: const TextStyle(
              fontSize: 34,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -0.8,
              fontFeatures: [FontFeature.tabularFigures()]),
        ),
        const SizedBox(height: 8),
        Text(
          summary != null
              ? 'Earned \$${summary!.earnedToDate.toStringAsFixed(2)} to date across yield routes'
              : 'Earn up to 11.2% APY across automated yield routes',
          style: const TextStyle(fontSize: 12, color: ProximColors.onSurfaceVariant),
        ),
      ]),
    );
  }
}

class _SavingsErrorCard extends StatelessWidget {
  final VoidCallback onRetry;
  const _SavingsErrorCard({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
          color: ProximColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: ProximColors.hairlineBorder)),
      child: Column(children: [
        const Text('Unable to load savings.', style: TextStyle(color: Colors.white70, fontSize: 13)),
        const SizedBox(height: 8),
        TextButton(
            onPressed: onRetry,
            child: const Text('Try again', style: TextStyle(color: ProximColors.tertiary))),
      ]),
    );
  }
}
