import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';

class BatchPayrollScreen extends StatefulWidget {
  const BatchPayrollScreen({super.key});

  @override
  State<BatchPayrollScreen> createState() => _BatchPayrollScreenState();
}

class _BatchPayrollScreenState extends State<BatchPayrollScreen> {
  bool _isBroadcasting = false;
  bool _isSettled = false;

  Future<void> _handleExecuteBatch() async {
    if (_isBroadcasting || _isSettled) return;
    setState(() => _isBroadcasting = true);
    await Future.delayed(const Duration(milliseconds: 1600));
    if (!mounted) return;
    setState(() {
      _isBroadcasting = false;
      _isSettled = true;
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
              _buildTopBar(context),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildCycleHeader(),
                      const SizedBox(height: 14),
                      _buildFundingSourceCard(),
                      const SizedBox(height: 14),
                      _buildQuickActionButtons(),
                      const SizedBox(height: 16),
                      _buildBatchQueueHeader(),
                      const SizedBox(height: 10),
                      _buildRecipientCard(
                        name: 'Sarah Jenkins',
                        role: 'Head of Design',
                        amount: '\$4,500.00',
                        currency: 'USDC',
                        rail: 'Solana • 8xJ9...4kL2',
                        status: 'Ready',
                        isSuccess: true,
                      ),
                      const SizedBox(height: 8),
                      _buildRecipientCard(
                        name: 'David Miller',
                        role: 'Lead Engineer',
                        amount: '\$5,200.00',
                        currency: 'USDC',
                        rail: 'Base L2 • 0x71...88B1',
                        status: 'Ready',
                        isSuccess: true,
                      ),
                      const SizedBox(height: 8),
                      _buildRecipientCard(
                        name: 'Brails Tech Hub',
                        role: 'Regional Contractor Pool (Lagos)',
                        amount: '\$8,000.00',
                        currency: '≈ ₦12,450,000 NGN',
                        rail: 'Brails Direct Bank Wire',
                        status: 'FX Locked',
                        isSuccess: false,
                        isWarning: true,
                      ),
                      const SizedBox(height: 8),
                      _buildRecipientCard(
                        name: 'Elena Rostova',
                        role: 'Product Ops',
                        amount: '\$3,800.00',
                        currency: 'USDC',
                        rail: 'Base L2 • 0x4B...99C0',
                        status: 'Ready',
                        isSuccess: true,
                      ),
                      const SizedBox(height: 16),
                      _buildValidationNote(),
                      const SizedBox(height: 14),
                      _buildExecutionCockpit(),
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
              'Batch Payroll Execution',
              style: ProximTextStyles.headlineSm(),
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(9999),
            ),
            child: Text(
              'Q3 WINDOW',
              style: ProximTextStyles.labelXs(color: ProximColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCycleHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(
              child: Text(
                'TREASURY OPERATIONS',
                style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: ProximColors.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(9999),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
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
                  Text('Cycle: September 15', style: ProximTextStyles.labelXs()),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(
              child: Text('Batch Payroll', style: ProximTextStyles.headlineLg(), overflow: TextOverflow.ellipsis),
            ),
            const SizedBox(width: 8),
            Text('14 Members', style: ProximTextStyles.labelSm()),
          ],
        ),
      ],
    );
  }

  Widget _buildFundingSourceCard() {
    return Container(
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainer,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Column(
        children: [
          Container(
            height: 3,
            decoration: const BoxDecoration(
              gradient: ProximColors.auroraBarTrack,
              borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Row(
                        children: [
                          Container(
                            width: 30,
                            height: 30,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: ProximColors.surfaceContainerHigh,
                            ),
                            child: const Icon(Icons.account_balance, size: 16, color: ProximColors.primary),
                          ),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('FUNDING SOURCE', style: ProximTextStyles.labelXs()),
                                Text(
                                  'Proxim Business Treasury',
                                  style: ProximTextStyles.labelSm(color: ProximColors.textWhite),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
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
                      ),
                      child: Text(
                        '\$148,500.00 Available',
                        style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('TOTAL BATCH OUTFLOW', style: ProximTextStyles.labelXs()),
                            const SizedBox(height: 2),
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerLeft,
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.baseline,
                                textBaseline: TextBaseline.alphabetic,
                                children: [
                                  Text(
                                    '\$42,650.00',
                                    style: ProximTextStyles.headlineLg(color: ProximColors.primary).copyWith(
                                      fontFeatures: const [FontFeature.tabularFigures()],
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  Text('USDC', style: ProximTextStyles.labelSm()),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('RECIPIENTS', style: ProximTextStyles.labelXs()),
                            const SizedBox(height: 2),
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerRight,
                              child: Row(
                                children: [
                                  const Icon(Icons.group, size: 16, color: ProximColors.primary),
                                  const SizedBox(width: 4),
                                  Text(
                                    '14 Members',
                                    style: ProximTextStyles.headlineSm(),
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
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.bolt, size: 14, color: ProximColors.primary),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        'Zero transfer fees • Instant sponsored clearing',
                        style: ProximTextStyles.labelXs(color: ProximColors.onSurfaceVariant),
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
    );
  }

  Widget _buildQuickActionButtons() {
    return Row(
      children: [
        Expanded(
          child: Container(
            height: 44,
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: ProximColors.hairlineBorder),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.upload_file, size: 18, color: ProximColors.primary),
                const SizedBox(width: 6),
                Text('Upload CSV', style: ProximTextStyles.labelSm(color: ProximColors.textWhite)),
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Container(
            height: 44,
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: ProximColors.hairlineBorder),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.person_add, size: 18, color: ProximColors.primary),
                const SizedBox(width: 6),
                Text('Add Recipient', style: ProximTextStyles.labelSm(color: ProximColors.textWhite)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBatchQueueHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Text('Batch Queue', style: ProximTextStyles.headlineSm()),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: ProximColors.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(9999),
              ),
              child: Text('4 Shown', style: ProximTextStyles.labelXs()),
            ),
          ],
        ),
        Text(
          'View All 14 ›',
          style: ProximTextStyles.labelXs(color: ProximColors.primary),
        ),
      ],
    );
  }

  Widget _buildRecipientCard({
    required String name,
    required String role,
    required String amount,
    required String currency,
    required String rail,
    required String status,
    bool isSuccess = false,
    bool isWarning = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: ProximColors.surfaceContainerLowest,
                      ),
                      child: Center(
                        child: Text(
                          name.substring(0, 1),
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: ProximColors.primary,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Flexible(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: ProximTextStyles.bodyLg().copyWith(fontWeight: FontWeight.w600),
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            role,
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
                    style: ProximTextStyles.bodyLg().copyWith(
                      fontWeight: FontWeight.w700,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                  Text(currency, style: ProximTextStyles.labelXs()),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: ProximColors.surfaceContainerLowest,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(rail, style: ProximTextStyles.labelXs()),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: (isSuccess
                          ? ProximColors.statusSuccess
                          : (isWarning ? ProximColors.statusWarning : ProximColors.primary))
                      .withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(9999),
                ),
                child: Text(
                  status,
                  style: ProximTextStyles.labelXs(
                    color: isSuccess
                        ? ProximColors.statusSuccess
                        : (isWarning ? ProximColors.statusWarning : ProximColors.primary),
                  ).copyWith(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildValidationNote() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            const Icon(Icons.verified_user, size: 14, color: ProximColors.statusSuccess),
            const SizedBox(width: 6),
            Text('14 Smart Signers Validated', style: ProximTextStyles.labelXs()),
          ],
        ),
        Text('v2.4 Vault', style: ProximTextStyles.labelXs()),
      ],
    );
  }

  Widget _buildExecutionCockpit() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('FINAL SETTLEMENT', style: ProximTextStyles.labelXs()),
                  const SizedBox(height: 2),
                  Text(
                    '\$42,650.00 USDC',
                    style: ProximTextStyles.headlineSm(color: ProximColors.textWhite).copyWith(
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('EST. LATENCY', style: ProximTextStyles.labelXs()),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const Icon(Icons.speed, size: 14, color: ProximColors.primary),
                      const SizedBox(width: 4),
                      Text('~4 seconds', style: ProximTextStyles.labelSm(color: ProximColors.primary)),
                    ],
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),
          GestureDetector(
            onTap: _handleExecuteBatch,
            child: Container(
              width: double.infinity,
              height: 50,
              decoration: BoxDecoration(
                gradient: _isSettled
                    ? null
                    : const LinearGradient(
                        colors: [Color(0xFF35D9D0), Color(0xFF5DF6EC), Color(0xFF7567F8)],
                      ),
                color: _isSettled ? ProximColors.statusSuccess : null,
                borderRadius: BorderRadius.circular(9999),
                boxShadow: [
                  BoxShadow(
                    color: (_isSettled ? ProximColors.statusSuccess : ProximColors.primary).withValues(alpha: 0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Center(
                child: _isBroadcasting
                    ? const SizedBox(
                        width: 22,
                        height: 22,
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
                                _isSettled ? Icons.check_circle : Icons.bolt,
                                size: 18,
                                color: ProximColors.surfaceContainerLowest,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                _isSettled ? 'Batch Settled Successfully' : 'Execute Batch Payout',
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
              child: Text(
                'Multi-sig timelock verified • Instant clearing & confirmation',
                style: ProximTextStyles.labelXs(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
