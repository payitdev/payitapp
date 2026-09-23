import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';
import 'transfers_provider.dart';

class SendPayoutScreen extends ConsumerStatefulWidget {
  const SendPayoutScreen({super.key});

  @override
  ConsumerState<SendPayoutScreen> createState() => _SendPayoutScreenState();
}

class _SendPayoutScreenState extends ConsumerState<SendPayoutScreen> {
  final TextEditingController _amountController = TextEditingController(text: '5,000.00');
  int _selectedRail = 0; // 0: Nuvion African, 1: Multi-chain, 2: Bank Wire
  int _countdownSeconds = 298;
  Timer? _timer;
  bool _isAuthorizing = false;
  bool _isDispatched = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() {
        if (_countdownSeconds <= 1) {
          _countdownSeconds = 300;
        } else {
          _countdownSeconds--;
        }
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _amountController.dispose();
    super.dispose();
  }

  String _formatTimer() {
    final minutes = _countdownSeconds ~/ 60;
    final seconds = _countdownSeconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  Future<void> _handleAuthorize() async {
    if (_isAuthorizing || _isDispatched) return;
    setState(() => _isAuthorizing = true);

    final cleanAmount = double.tryParse(_amountController.text.replaceAll(',', '')) ?? 5000.0;
    final railName = _selectedRail == 0
        ? 'Nuvion African Payout Rail'
        : (_selectedRail == 1 ? 'Multi-Chain Digital Rail' : 'Global Bank Wire');

    try {
      await ref.read(transfersRepositoryProvider).sendTransfer(
            recipientName: 'Brails Technology Ltd',
            amount: cleanAmount,
            currency: 'USD',
            rail: railName,
          );
    } catch (_) {}

    if (!mounted) return;
    setState(() {
      _isAuthorizing = false;
      _isDispatched = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ProximColors.backgroundVoid,
      body: CenteredAppContainer(
        child: SafeArea(
          child: Column(
            children: [
              // Top Bar
              _buildTopBar(context),

              // Scrollable Content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Eyebrow & Title
                      _buildHeader(),
                      const SizedBox(height: 16),

                      // Amount Input Card
                      _buildAmountCard(),
                      const SizedBox(height: 16),

                      // Settlement Rails
                      _buildRailsSelector(),
                      const SizedBox(height: 16),

                      // Cross-border Settlement Preview Card
                      _buildPreviewCard(),
                      const SizedBox(height: 20),

                      // Action CTA
                      _buildActionCta(),
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
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Transfer Execution',
              style: ProximTextStyles.headlineSm(),
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(width: 8),
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: ProximColors.surfaceContainerLow,
              border: Border.all(color: ProximColors.primary.withValues(alpha: 0.3)),
            ),
            child: const Center(
              child: Text(
                'AG',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: ProximColors.primary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: ProximColors.primary,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              'TREASURY TRANSFER',
              style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                'Send & Payout',
                style: ProximTextStyles.headlineLg(),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: ProximColors.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(9999),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.bolt, size: 13, color: ProximColors.primary),
                  const SizedBox(width: 3),
                  Text(
                    'T+0 LIQUID',
                    style: ProximTextStyles.labelXs(color: ProximColors.onSurfaceVariant),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildAmountCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainer,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: ProximColors.hairlineBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Send Amount', style: ProximTextStyles.labelSm()),
              Row(
                children: [
                  Text('Avail: ', style: ProximTextStyles.labelSm()),
                  Text(
                    '\$48,250.00',
                    style: ProximTextStyles.labelSm(color: ProximColors.primary).copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 6),
                  GestureDetector(
                    onTap: () => setState(() => _amountController.text = '48,250.00'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: ProximColors.surfaceContainerHigh,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'MAX',
                        style: ProximTextStyles.labelXs(color: ProximColors.primary),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text('\$', style: ProximTextStyles.headlineLg()),
                    const SizedBox(width: 4),
                    Expanded(
                      child: TextField(
                        controller: _amountController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        style: ProximTextStyles.headlineLg().copyWith(
                          color: ProximColors.onSurface,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: ProximColors.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(9999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 20,
                      height: 20,
                      decoration: BoxDecoration(
                        color: ProximColors.primary.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.attach_money, size: 14, color: ProximColors.primary),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'USD',
                      style: ProximTextStyles.labelSm(color: ProximColors.textWhite).copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text('Cash', style: ProximTextStyles.labelXs()),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: ProximColors.hairlineBorder),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Text(
                  'Source: Primary Treasury Vault',
                  style: ProximTextStyles.labelXs(),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 5,
                    height: 5,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: ProximColors.statusSuccess,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Zero fee subsidized',
                    style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRailsSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'SETTLEMENT RAIL',
              style: ProximTextStyles.labelSm().copyWith(letterSpacing: 0.6),
            ),
            Text(
              'Compare fees',
              style: ProximTextStyles.labelXs(color: ProximColors.primary),
            ),
          ],
        ),
        const SizedBox(height: 8),

        // Rail 1: Nuvion African Payout
        _buildRailCard(
          index: 0,
          title: 'Nuvion African Payout',
          badge: 'Fastest',
          subtitle: 'Direct corridor • NGN, KES, GHS',
          icon: Icons.public,
        ),
        const SizedBox(height: 6),

        // Rail 2: Digital Dollar
        _buildRailCard(
          index: 1,
          title: 'Digital Dollar Settlement',
          subtitle: 'Direct settlement across 5 global rails',
          icon: Icons.account_balance_wallet_outlined,
        ),
        const SizedBox(height: 6),

        // Rail 3: Bank Wire
        _buildRailCard(
          index: 2,
          title: 'Global Bank Wire',
          subtitle: 'Global wire clearing (ACH / SEPA / SWIFT)',
          icon: Icons.account_balance_outlined,
        ),
      ],
    );
  }

  Widget _buildRailCard({
    required int index,
    required String title,
    required String subtitle,
    required IconData icon,
    String? badge,
  }) {
    final isSelected = _selectedRail == index;
    return GestureDetector(
      onTap: () => setState(() => _selectedRail = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? ProximColors.surfaceContainerHigh : ProximColors.surfaceContainer,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? ProximColors.primary.withValues(alpha: 0.6) : ProximColors.hairlineBorder,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: isSelected ? ProximColors.primary.withValues(alpha: 0.15) : ProximColors.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                icon,
                size: 20,
                color: isSelected ? ProximColors.primary : ProximColors.onSurfaceVariant,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          title,
                          style: ProximTextStyles.bodyLg().copyWith(
                            fontWeight: FontWeight.w600,
                            color: isSelected ? ProximColors.textWhite : ProximColors.onSurface,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (badge != null) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: ProximColors.primary.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(9999),
                          ),
                          child: Text(
                            badge,
                            style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(subtitle, style: ProximTextStyles.bodySm()),
                ],
              ),
            ),
            if (isSelected)
              Container(
                width: 20,
                height: 20,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: ProximColors.primary,
                ),
                child: const Icon(Icons.check, size: 14, color: ProximColors.surfaceContainerLowest),
              )
            else
              const Icon(Icons.chevron_right, size: 18, color: ProximColors.onSurfaceVariant),
          ],
        ),
      ),
    );
  }

  Widget _buildPreviewCard() {
    return Container(
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainer,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Aurora Indicator Track
          Container(
            height: 3,
            decoration: const BoxDecoration(
              gradient: ProximColors.auroraBarTrack,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Beneficiary
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: ProximColors.surfaceContainerHighest,
                      ),
                      child: const Center(
                        child: Text(
                          'BT',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: ProximColors.primary,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  'Brails Technology Ltd',
                                  style: ProximTextStyles.headlineSm(),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 4),
                              const Icon(Icons.verified, size: 16, color: ProximColors.primary),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text('Lagos, Nigeria • Commercial Entity', style: ProximTextStyles.bodySm()),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.edit_outlined, size: 18, color: ProximColors.onSurfaceVariant),
                      onPressed: () {},
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Guaranteed Live FX banner
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Row(
                          children: [
                            const Icon(Icons.lock_clock, size: 18, color: ProximColors.primary),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('GUARANTEED LIVE FX', style: ProximTextStyles.labelXs()),
                                  Text(
                                    '1 USD = 1,595.20 NGN',
                                    overflow: TextOverflow.ellipsis,
                                    style: ProximTextStyles.bodySm(color: ProximColors.textWhite).copyWith(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: ProximColors.surfaceContainerHigh,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          _formatTimer(),
                          style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                            fontFeatures: const [FontFeature.tabularFigures()],
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Output Display
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Recipient Receives Exactly', style: ProximTextStyles.labelSm()),
                      const SizedBox(height: 4),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              '₦7,976,000.00',
                              style: ProximTextStyles.headlineLg(color: ProximColors.primary).copyWith(
                                fontFeatures: const [FontFeature.tabularFigures()],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text('NGN', style: ProximTextStyles.headlineSm()),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Breakdown Items
                _buildBreakdownRow('Destination Account', 'First Bank of Nigeria •••• 9012'),
                const SizedBox(height: 8),
                _buildBreakdownRow('Routing Rail', 'Instant Clearing (~3 mins)', isStatus: true),
                const SizedBox(height: 8),
                _buildBreakdownRow('Transfer Fee', '\$0.00 (Zero Fee Subsidized)', isHighlight: true),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBreakdownRow(String label, String value, {bool isStatus = false, bool isHighlight = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Flexible(
          child: Text(
            label,
            style: ProximTextStyles.bodySm(),
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: 8),
        Flexible(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isStatus) ...[
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: ProximColors.statusSuccess,
                  ),
                ),
                const SizedBox(width: 6),
              ],
              Flexible(
                child: Text(
                  value,
                  overflow: TextOverflow.ellipsis,
                  style: ProximTextStyles.bodySm(
                    color: isHighlight
                        ? ProximColors.statusSuccess
                        : (isStatus ? ProximColors.textWhite : ProximColors.onSurface),
                  ).copyWith(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildActionCta() {
    return Column(
      children: [
        GestureDetector(
          onTap: _handleAuthorize,
          child: Container(
            width: double.infinity,
            height: 52,
            decoration: BoxDecoration(
              gradient: _isDispatched
                  ? null
                  : const LinearGradient(
                      colors: [Color(0xFF35D9D0), Color(0xFF5DF6EC), Color(0xFF7567F8)],
                    ),
              color: _isDispatched ? ProximColors.statusSuccess : null,
              borderRadius: BorderRadius.circular(9999),
              boxShadow: [
                BoxShadow(
                  color: (_isDispatched ? ProximColors.statusSuccess : ProximColors.primary).withValues(alpha: 0.3),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Center(
              child: _isAuthorizing
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        color: ProximColors.surfaceContainerLowest,
                        strokeWidth: 2.5,
                      ),
                    )
                  : Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              _isDispatched ? Icons.check_circle : Icons.security,
                              size: 20,
                              color: ProximColors.surfaceContainerLowest,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              _isDispatched ? 'Dispatched for Clearing' : 'Confirm & Authorize Payout',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: ProximColors.surfaceContainerLowest,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.fingerprint, size: 16, color: ProximColors.onSurfaceVariant),
                const SizedBox(width: 6),
                Text(
                  'Requires Face ID or Biometric authorization to send money',
                  style: ProximTextStyles.labelXs(),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
