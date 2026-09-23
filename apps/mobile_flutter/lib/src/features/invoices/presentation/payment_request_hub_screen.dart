import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';

class PaymentRequestHubScreen extends StatefulWidget {
  const PaymentRequestHubScreen({super.key});

  @override
  State<PaymentRequestHubScreen> createState() => _PaymentRequestHubScreenState();
}

class _PaymentRequestHubScreenState extends State<PaymentRequestHubScreen> {
  int _selectedTab = 0; // 0: Inbound (3), 1: Outbound (5), 2: Archived

  void _showPaymentSuccess(String name, String amount) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.verified, size: 18, color: ProximColors.primary),
            const SizedBox(width: 8),
            Text('Payment of $amount to $name approved'),
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
                      const SizedBox(height: 14),
                      _buildSegmentedTabs(),
                      const SizedBox(height: 14),
                      _buildMetricsBento(),
                      const SizedBox(height: 16),
                      _buildVerifiedSectionHeader(),
                      const SizedBox(height: 10),
                      _buildRequestCard(
                        name: 'Elena Rostova',
                        role: 'Product Ops • London HQ',
                        amount: '\$1,250.00',
                        currency: 'USDC Inbound',
                        memo: 'Q3 Travel Reimbursement • London Fintech Summit',
                        onApprove: () => _showPaymentSuccess('Elena Rostova', '\$1,250.00'),
                      ),
                      const SizedBox(height: 10),
                      _buildRequestCard(
                        name: 'David Miller',
                        role: 'Lead Engineer • Core Infra',
                        amount: '\$3,400.00',
                        currency: 'USDC Inbound',
                        memo: 'Compute Cluster Renewal & Dedicated Nodes',
                        onApprove: () => _showPaymentSuccess('David Miller', '\$3,400.00'),
                      ),
                      const SizedBox(height: 20),
                      _buildCreateRequestCta(context),
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
          Text('Request Hub', style: ProximTextStyles.headlineSm()),
          IconButton(
            icon: const Icon(Icons.qr_code_2, size: 22, color: ProximColors.primary),
            onPressed: () => context.push('/receive'),
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
              'PEER & TREASURY RECEIVABLES',
              style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text('Payment Requests', style: ProximTextStyles.headlineLg()),
      ],
    );
  }

  Widget _buildSegmentedTabs() {
    final tabs = ['Inbound (3)', 'Outbound (5)', 'Archived'];
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(9999),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Row(
        children: List.generate(tabs.length, (index) {
          final isSelected = _selectedTab == index;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _selectedTab = index),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  gradient: isSelected ? ProximColors.auroraGradient : null,
                  borderRadius: BorderRadius.circular(9999),
                ),
                child: Center(
                  child: Text(
                    tabs[index],
                    style: ProximTextStyles.labelSm(
                      color: isSelected ? ProximColors.surfaceContainerLowest : ProximColors.onSurfaceVariant,
                    ).copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildMetricsBento() {
    return Row(
      children: [
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: ProximColors.hairlineBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('PENDING INFLOW', style: ProximTextStyles.labelXs()),
                    const Icon(Icons.south_east, size: 16, color: ProximColors.primary),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  '\$6,450.00',
                  style: ProximTextStyles.headlineLg(color: ProximColors.textWhite).copyWith(
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(height: 2),
                Text('≈ ₦10.28M NGN', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
              ],
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: ProximColors.hairlineBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('UNSETTLED', style: ProximTextStyles.labelXs()),
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: ProximColors.statusWarning,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text('3 Active', style: ProximTextStyles.headlineLg(color: ProximColors.textWhite)),
                const SizedBox(height: 2),
                Text('1 Requires Action', style: ProximTextStyles.labelXs(color: ProximColors.statusWarning)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildVerifiedSectionHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Text('Verified Counterparties', style: ProximTextStyles.headlineSm()),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: ProximColors.statusSuccess.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(9999),
              ),
              child: Text('2 Queued', style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess)),
            ),
          ],
        ),
        Row(
          children: [
            const Icon(Icons.verified_user, size: 14, color: ProximColors.statusSuccess),
            const SizedBox(width: 4),
            Text('Fraud Shield Active', style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess)),
          ],
        ),
      ],
    );
  }

  Widget _buildRequestCard({
    required String name,
    required String role,
    required String amount,
    required String currency,
    required String memo,
    required VoidCallback onApprove,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
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
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: ProximColors.surfaceContainerHighest,
                    ),
                    child: Center(
                      child: Text(
                        name.substring(0, 1),
                        style: const TextStyle(fontWeight: FontWeight.bold, color: ProximColors.primary),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(name, style: ProximTextStyles.bodyLg().copyWith(fontWeight: FontWeight.w600)),
                          const SizedBox(width: 4),
                          const Icon(Icons.verified, size: 14, color: ProximColors.primary),
                        ],
                      ),
                      Text(role, style: ProximTextStyles.labelXs()),
                    ],
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    amount,
                    style: ProximTextStyles.headlineSm(color: ProximColors.textWhite).copyWith(
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                  Text(currency, style: ProximTextStyles.labelXs(color: ProximColors.primary)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                const Icon(Icons.receipt_long, size: 16, color: ProximColors.onSurfaceVariant),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    memo,
                    style: ProximTextStyles.bodySm(),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: GestureDetector(
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Request declined')),
                    );
                  },
                  child: Container(
                    height: 38,
                    decoration: BoxDecoration(
                      color: ProximColors.surfaceContainerHigh,
                      borderRadius: BorderRadius.circular(9999),
                    ),
                    child: Center(
                      child: Text('Decline', style: ProximTextStyles.labelSm()),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 3,
                child: GestureDetector(
                  onTap: onApprove,
                  child: Container(
                    height: 38,
                    decoration: BoxDecoration(
                      gradient: ProximColors.auroraGradient,
                      borderRadius: BorderRadius.circular(9999),
                    ),
                    child: Center(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.check, size: 16, color: ProximColors.surfaceContainerLowest),
                          const SizedBox(width: 4),
                          Text(
                            'Approve & Pay',
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

  Widget _buildCreateRequestCta(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/receive'),
      child: Container(
        width: double.infinity,
        height: 50,
        decoration: BoxDecoration(
          color: ProximColors.surfaceContainerHigh,
          borderRadius: BorderRadius.circular(9999),
          border: Border.all(color: ProximColors.primary.withValues(alpha: 0.4)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.add_link, size: 18, color: ProximColors.primary),
            const SizedBox(width: 8),
            Text(
              'Create Custom Payment Link',
              style: ProximTextStyles.bodyLg(color: ProximColors.primary).copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
