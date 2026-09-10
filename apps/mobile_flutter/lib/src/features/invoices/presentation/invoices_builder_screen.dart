import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';

class InvoicesBuilderScreen extends StatefulWidget {
  const InvoicesBuilderScreen({super.key});

  @override
  State<InvoicesBuilderScreen> createState() => _InvoicesBuilderScreenState();
}

class _InvoicesBuilderScreenState extends State<InvoicesBuilderScreen> {
  int _selectedFilter = 0; // 0: All, 1: Drafts, 2: Sent, 3: Paid
  final TextEditingController _amountController = TextEditingController(text: '12,500.00');
  final Set<int> _selectedRails = {0, 1}; // 0: Solana, 1: Base, 2: Wire
  bool _isGenerating = false;

  Future<void> _handleGenerateLink() async {
    setState(() => _isGenerating = true);
    await Future.delayed(const Duration(milliseconds: 1200));
    if (!mounted) return;
    setState(() {
      _isGenerating = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Invoice #INV-2026-095 generated & ready to checkout'),
        action: SnackBarAction(
          label: 'View Checkout',
          textColor: ProximColors.primary,
          onPressed: () => context.push('/checkout/INV-2026-095'),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
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
                      _buildCockpitCard(),
                      const SizedBox(height: 14),
                      _buildFilterPills(),
                      const SizedBox(height: 14),
                      _buildWizardBuilderCard(),
                      const SizedBox(height: 16),
                      _buildRecentInvoicesSection(),
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
              'Invoices & Billing',
              style: ProximTextStyles.headlineSm(),
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.add_circle_outline, size: 20, color: ProximColors.primary),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Starting new blank invoice template')),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
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
                  'TREASURY BILLING',
                  style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text('Invoices', style: ProximTextStyles.headlineLg()),
          ],
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            gradient: ProximColors.auroraGradient,
            borderRadius: BorderRadius.circular(9999),
          ),
          child: Row(
            children: [
              const Icon(Icons.add, size: 16, color: ProximColors.surfaceContainerLowest),
              const SizedBox(width: 4),
              Text(
                'New Invoice',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: ProximColors.surfaceContainerLowest,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCockpitCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
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
                    Text('OUTSTANDING', style: ProximTextStyles.labelXs()),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '\$34,500.00',
                  style: ProximTextStyles.headlineLg().copyWith(
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(height: 4),
                Text('2 pending links', style: ProximTextStyles.labelXs(color: ProximColors.statusWarning)),
              ],
            ),
          ),
          Container(width: 1, height: 50, color: ProximColors.hairlineBorder),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: ProximColors.statusSuccess,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text('PAID THIS MONTH', style: ProximTextStyles.labelXs()),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '\$82,100.00',
                  style: ProximTextStyles.headlineLg(color: ProximColors.primary).copyWith(
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(height: 4),
                Text('+14.2% vs last cycle', style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterPills() {
    final filters = ['All (14)', 'Drafts (3)', 'Sent (Pending)', 'Paid (9)'];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(filters.length, (index) {
          final isSelected = _selectedFilter == index;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => setState(() => _selectedFilter = index),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: isSelected ? ProximColors.primary : ProximColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(9999),
                ),
                child: Text(
                  filters[index],
                  style: ProximTextStyles.labelSm(
                    color: isSelected ? ProximColors.surfaceContainerLowest : ProximColors.onSurfaceVariant,
                  ).copyWith(fontWeight: FontWeight.w600),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildWizardBuilderCard() {
    return Container(
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
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
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Row(
                        children: [
                          const Icon(Icons.tune, size: 18, color: ProximColors.primary),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              'Instant Flow Builder',
                              style: ProximTextStyles.headlineSm(),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: ProximColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'Draft #INV-2026-095',
                        style: ProximTextStyles.labelXs(color: ProximColors.primary),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Billed Client
                Text('BILLED ENTERPRISE', style: ProximTextStyles.labelXs()),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainer,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: ProximColors.surfaceContainerHigh,
                        ),
                        child: const Center(
                          child: Text('A', style: TextStyle(fontWeight: FontWeight.bold, color: ProximColors.primary)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Acme Corp Inc', style: ProximTextStyles.bodyLg().copyWith(fontWeight: FontWeight.w600)),
                            Text('billing@acmecorp.com', style: ProximTextStyles.labelXs()),
                          ],
                        ),
                      ),
                      const Icon(Icons.unfold_more, size: 18, color: ProximColors.onSurfaceVariant),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // Invoice Amount
                Text('INVOICE AMOUNT', style: ProximTextStyles.labelXs()),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainer,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Text('\$', style: ProximTextStyles.headlineLg()),
                          const SizedBox(width: 4),
                          SizedBox(
                            width: 150,
                            child: TextField(
                              controller: _amountController,
                              style: ProximTextStyles.headlineLg().copyWith(
                                fontFeatures: const [FontFeature.tabularFigures()],
                              ),
                              decoration: const InputDecoration(border: InputBorder.none, isDense: true),
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: ProximColors.surfaceContainerHigh,
                          borderRadius: BorderRadius.circular(9999),
                        ),
                        child: Text(
                          'USDC',
                          style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // Settlement Rails
                Text('ACCEPTED SETTLEMENT RAILS', style: ProximTextStyles.labelXs()),
                const SizedBox(height: 6),
                Row(
                  children: [
                    _buildRailOption(0, 'Fast USD', Icons.bolt),
                    const SizedBox(width: 8),
                    _buildRailOption(1, 'Digital Rail', Icons.layers),
                    const SizedBox(width: 8),
                    _buildRailOption(2, 'Direct Wire', Icons.account_balance),
                  ],
                ),
                const SizedBox(height: 16),

                // CTA
                GestureDetector(
                  onTap: _handleGenerateLink,
                  child: Container(
                    width: double.infinity,
                    height: 48,
                    decoration: BoxDecoration(
                      gradient: ProximColors.auroraGradient,
                      borderRadius: BorderRadius.circular(9999),
                    ),
                    child: Center(
                      child: _isGenerating
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                color: ProximColors.surfaceContainerLowest,
                                strokeWidth: 2,
                              ),
                            )
                          : Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(Icons.send, size: 16, color: ProximColors.surfaceContainerLowest),
                                    const SizedBox(width: 8),
                                    const Text(
                                      'Generate & Send Payment Link',
                                      style: TextStyle(
                                        fontSize: 14,
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
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRailOption(int id, String label, IconData icon) {
    final isSelected = _selectedRails.contains(id);
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() {
            if (isSelected) {
              if (_selectedRails.length > 1) _selectedRails.remove(id);
            } else {
              _selectedRails.add(id);
            }
          });
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? ProximColors.surfaceContainerHigh : ProximColors.surfaceContainer,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected ? ProximColors.primary : ProximColors.hairlineBorder,
            ),
          ),
          child: Column(
            children: [
              Icon(icon, size: 18, color: isSelected ? ProximColors.primary : ProximColors.onSurfaceVariant),
              const SizedBox(height: 4),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    label,
                    style: ProximTextStyles.labelXs(
                      color: isSelected ? ProximColors.textWhite : ProximColors.onSurfaceVariant,
                    ).copyWith(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRecentInvoicesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(
              child: Text(
                'Recent Treasury Invoices',
                style: ProximTextStyles.headlineSm(),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            Text('View Ledger ›', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
          ],
        ),
        const SizedBox(height: 10),
        _buildInvoiceRow('Stripe Inc', '#INV-2026-089', '\$18,500.00', 'Paid', isSuccess: true),
        const SizedBox(height: 8),
        _buildInvoiceRow('Vercel Enterprise', '#INV-2026-088', '\$9,200.00', 'Paid', isSuccess: true),
        const SizedBox(height: 8),
        _buildInvoiceRow('Moniepoint Clearing', '#INV-2026-092', '\$14,000.00', 'Pending', isWarning: true),
      ],
    );
  }

  Widget _buildInvoiceRow(String client, String invoiceNum, String amount, String status, {bool isSuccess = false, bool isWarning = false}) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Row(
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
                    color: ProximColors.surfaceContainerHighest,
                  ),
                  child: const Icon(Icons.corporate_fare, size: 18, color: ProximColors.primary),
                ),
                const SizedBox(width: 10),
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        client,
                        style: ProximTextStyles.bodyLg().copyWith(fontWeight: FontWeight.w600),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(invoiceNum, style: ProximTextStyles.labelXs()),
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
              const SizedBox(height: 2),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isSuccess
                      ? ProximColors.statusSuccess.withValues(alpha: 0.15)
                      : ProximColors.statusWarning.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  status,
                  style: ProximTextStyles.labelXs(
                    color: isSuccess ? ProximColors.statusSuccess : ProximColors.statusWarning,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
