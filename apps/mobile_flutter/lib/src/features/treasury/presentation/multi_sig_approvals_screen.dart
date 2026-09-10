import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';

class MultiSigApprovalsScreen extends StatefulWidget {
  const MultiSigApprovalsScreen({super.key});

  @override
  State<MultiSigApprovalsScreen> createState() => _MultiSigApprovalsScreenState();
}

class _MultiSigApprovalsScreenState extends State<MultiSigApprovalsScreen> {
  int _selectedFilter = 0; // 0: Pending (2), 1: Executed (18), 2: Rejected (1)
  bool _tx1Signed = false;
  bool _tx2Signed = false;

  void _handleSign(int txId) {
    setState(() {
      if (txId == 1) _tx1Signed = true;
      if (txId == 2) _tx2Signed = true;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.verified, size: 18, color: ProximColors.primary),
            const SizedBox(width: 8),
            Text('Transaction #0$txId signed & broadcasted to quorum'),
          ],
        ),
        backgroundColor: ProximColors.surfaceContainerHigh,
      ),
    );
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
                      _buildHeader(),
                      const SizedBox(height: 12),
                      _buildNoticePill(),
                      const SizedBox(height: 14),
                      _buildQuorumOverviewCard(),
                      const SizedBox(height: 14),
                      _buildFilterTabs(),
                      const SizedBox(height: 14),
                      if (!_tx1Signed)
                        _buildTransactionCard(
                          txId: 1,
                          tag: 'Infrastructure',
                          priority: 'Priority 1',
                          expiresIn: 'Expires in 4h 18m',
                          amount: '\$24,500.00',
                          countervalue: '≈ ₦39,077,500 NGN',
                          title: 'AWS Cloud & Solana RPC Nodes',
                          dest: 'To: 0x4a9b...77f1 (AWS Billing Core)',
                          purpose: 'Purpose: Q3 Enterprise Infrastructure Deployment',
                          progressText: '1 of 2 Signed',
                          progressFraction: 0.5,
                          signerNote: 'Elena Rostova approved at 10:14 AM',
                          onSign: () => _handleSign(1),
                        )
                      else
                        _buildSignedBanner('Transaction #01 (AWS Cloud) Finalized'),
                      const SizedBox(height: 12),
                      if (!_tx2Signed)
                        _buildTransactionCard(
                          txId: 2,
                          tag: 'Payroll Batch',
                          priority: '8 Recipients',
                          expiresIn: 'Expires in 18h',
                          amount: '\$38,200.00',
                          countervalue: '≈ ₦60,929,000 NGN',
                          title: 'Q3 Team Payroll Disbursement',
                          dest: 'To: Proxim Payroll Smart Escrow',
                          purpose: 'Cycle: September 15 Mid-Month Disbursal',
                          progressText: '1 of 2 Signed',
                          progressFraction: 0.5,
                          signerNote: 'Alex Rivera approved at 8:45 AM',
                          onSign: () => _handleSign(2),
                        )
                      else
                        _buildSignedBanner('Transaction #02 (Payroll) Finalized'),
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
          Text('Approval Queue', style: ProximTextStyles.headlineSm()),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(9999),
              border: Border.all(color: ProximColors.primary.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.tune, size: 14, color: ProximColors.primary),
                const SizedBox(width: 4),
                Text('Policy', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
              ],
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
                color: ProximColors.statusWarning,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              'ACME GLOBAL TECHNOLOGIES • MULTI-SIG',
              style: ProximTextStyles.labelXs(color: ProximColors.onSurfaceVariant).copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text('Executive Sign-Off', style: ProximTextStyles.headlineLg()),
      ],
    );
  }

  Widget _buildNoticePill() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              const Icon(Icons.lock_clock, size: 16, color: ProximColors.statusWarning),
              const SizedBox(width: 8),
              Text(
                '2 pending transactions require your signature',
                style: ProximTextStyles.labelSm(color: ProximColors.textWhite),
              ),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: ProximColors.statusWarning.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              'ACTION',
              style: ProximTextStyles.labelXs(color: ProximColors.statusWarning).copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuorumOverviewCard() {
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.verified_user, size: 16, color: ProximColors.primary),
                        const SizedBox(width: 6),
                        Text('VAULT QUORUM THRESHOLD', style: ProximTextStyles.labelXs()),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: ProximColors.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(9999),
                      ),
                      child: Text('M-of-N Policy', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text('2 of 3 Hardware Keys Required', style: ProximTextStyles.headlineSm()),
                const SizedBox(height: 12),

                // Signers List
                _buildSignerTile(
                  name: 'Alex Rivera',
                  role: 'CEO',
                  keyNote: 'Key #1: Active Signer',
                  badge: 'Standing',
                  isSuccess: true,
                ),
                const SizedBox(height: 6),
                _buildSignerTile(
                  name: 'Elena Rostova',
                  role: 'CFO',
                  keyNote: 'Key #2: Signed (14m ago)',
                  badge: 'Signed',
                  isSuccess: true,
                ),
                const SizedBox(height: 6),
                _buildSignerTile(
                  name: 'Hardware Cold Key',
                  role: '(You)',
                  keyNote: 'Key #3: Awaiting Signature',
                  badge: 'Required',
                  isWarning: true,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSignerTile({
    required String name,
    required String role,
    required String keyNote,
    required String badge,
    bool isSuccess = false,
    bool isWarning = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isSuccess ? ProximColors.statusSuccess.withValues(alpha: 0.15) : ProximColors.statusWarning.withValues(alpha: 0.15),
                ),
                child: Icon(
                  isSuccess ? Icons.check : Icons.key,
                  size: 16,
                  color: isSuccess ? ProximColors.statusSuccess : ProximColors.statusWarning,
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(name, style: ProximTextStyles.bodySm(color: ProximColors.textWhite).copyWith(fontWeight: FontWeight.w600)),
                      const SizedBox(width: 4),
                      Text(role, style: ProximTextStyles.labelXs()),
                    ],
                  ),
                  Text(
                    keyNote,
                    style: ProximTextStyles.labelXs(
                      color: isSuccess ? ProximColors.statusSuccess : ProximColors.statusWarning,
                    ),
                  ),
                ],
              ),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: (isSuccess ? ProximColors.statusSuccess : ProximColors.statusWarning).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              badge,
              style: ProximTextStyles.labelXs(
                color: isSuccess ? ProximColors.statusSuccess : ProximColors.statusWarning,
              ).copyWith(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTabs() {
    final tabs = ['Pending (2)', 'Executed (18)', 'Rejected (1)'];
    return Row(
      children: List.generate(tabs.length, (index) {
        final isSelected = _selectedFilter == index;
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: index == tabs.length - 1 ? 0 : 6),
            child: GestureDetector(
              onTap: () => setState(() => _selectedFilter = index),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? ProximColors.surfaceContainerHigh : ProximColors.surfaceContainerLowest,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Center(
                  child: Text(
                    tabs[index],
                    style: ProximTextStyles.labelSm(
                      color: isSelected ? ProximColors.primary : ProximColors.onSurfaceVariant,
                    ).copyWith(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _buildTransactionCard({
    required int txId,
    required String tag,
    required String priority,
    required String expiresIn,
    required String amount,
    required String countervalue,
    required String title,
    required String dest,
    required String purpose,
    required String progressText,
    required double progressFraction,
    required String signerNote,
    required VoidCallback onSign,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
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
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: ProximColors.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(tag, style: ProximTextStyles.labelXs(color: ProximColors.primary)),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: ProximColors.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(priority, style: ProximTextStyles.labelXs()),
                  ),
                ],
              ),
              Text(expiresIn, style: ProximTextStyles.labelXs(color: ProximColors.statusWarning)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                amount,
                style: ProximTextStyles.headlineLg(color: ProximColors.textWhite).copyWith(
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(width: 6),
              Text('USDC', style: ProximTextStyles.headlineSm()),
            ],
          ),
          Text(countervalue, style: ProximTextStyles.bodySm()),
          const SizedBox(height: 10),

          // Detail box
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainer,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: ProximTextStyles.labelSm(color: ProximColors.textWhite).copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(dest, style: ProximTextStyles.labelXs(color: ProximColors.primary)),
                const SizedBox(height: 2),
                Text(purpose, style: ProximTextStyles.labelXs()),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Progress
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(signerNote, style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess)),
              Text(progressText, style: ProximTextStyles.labelXs(color: ProximColors.primary)),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(9999),
            child: LinearProgressIndicator(
              value: progressFraction,
              backgroundColor: ProximColors.surfaceContainerLowest,
              valueColor: const AlwaysStoppedAnimation<Color>(ProximColors.primary),
              minHeight: 4,
            ),
          ),
          const SizedBox(height: 12),

          // Action Buttons
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Transaction rejected')),
                    );
                  },
                  child: Container(
                    height: 42,
                    decoration: BoxDecoration(
                      color: ProximColors.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(9999),
                    ),
                    child: Center(
                      child: Text('Decline', style: ProximTextStyles.labelSm(color: ProximColors.statusDanger)),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: GestureDetector(
                  onTap: onSign,
                  child: Container(
                    height: 42,
                    decoration: BoxDecoration(
                      gradient: ProximColors.auroraGradient,
                      borderRadius: BorderRadius.circular(9999),
                    ),
                    child: Center(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.fingerprint, size: 16, color: ProximColors.surfaceContainerLowest),
                          const SizedBox(width: 6),
                          Text(
                            'Sign & Authorize',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: ProximColors.surfaceContainerLowest,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSignedBanner(String message) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ProximColors.statusSuccess.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.check_circle, size: 18, color: ProximColors.statusSuccess),
          const SizedBox(width: 10),
          Expanded(child: Text(message, style: ProximTextStyles.labelSm(color: ProximColors.statusSuccess))),
        ],
      ),
    );
  }
}
