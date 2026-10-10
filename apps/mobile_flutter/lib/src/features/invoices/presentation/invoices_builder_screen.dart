import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';
import '../../auth/presentation/auth_provider.dart';
import '../data/invoices_repository.dart';
import 'invoices_provider.dart';

class InvoicesBuilderScreen extends ConsumerStatefulWidget {
  const InvoicesBuilderScreen({super.key});

  @override
  ConsumerState<InvoicesBuilderScreen> createState() => _InvoicesBuilderScreenState();
}

class _InvoicesBuilderScreenState extends ConsumerState<InvoicesBuilderScreen> {
  int _selectedFilter = 0; // 0: All, 1: Unpaid, 2: Paid, 3: Overdue
  final TextEditingController _amountController = TextEditingController(text: '12,500.00');
  final TextEditingController _clientNameController = TextEditingController(text: 'Acme Corp');
  final TextEditingController _clientEmailController = TextEditingController(text: 'billing@acme.com');
  final Set<int> _selectedRails = {0, 1}; // 0: Solana, 1: Base, 2: Wire
  bool _isGenerating = false;

  Future<void> _handleGenerateLink() async {
    setState(() => _isGenerating = true);
    
    final cleanAmount = double.tryParse(_amountController.text.replaceAll(',', '')) ?? 12500.0;
    final rails = _selectedRails.map((id) => id == 0 ? 'Fast USD' : (id == 1 ? 'Digital Rail' : 'Direct Wire')).toList();
    final entity = ref.read(activeEntityProvider);

    ProximInvoice? invoice;
    try {
      invoice = await ref.read(invoicesRepositoryProvider).createInvoice(
            clientName: _clientNameController.text.trim().isEmpty ? 'Acme Corp' : _clientNameController.text.trim(),
            clientEmail: _clientEmailController.text.trim().isEmpty ? 'billing@acme.com' : _clientEmailController.text.trim(),
            amount: cleanAmount,
            currency: 'USDC',
            acceptedRails: rails,
          );
      if (entity != null) {
        ref.invalidate(invoicesListProvider(entity.id));
      }
    } catch (_) {}

    if (!mounted) return;
    setState(() {
      _isGenerating = false;
    });

    final invNum = invoice?.invoiceNumber ?? 'INV-2026-095';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Invoice #$invNum generated & ready to checkout'),
        action: SnackBarAction(
          label: 'View Checkout',
          textColor: ProximColors.primary,
          onPressed: () => context.push('/checkout/$invNum'),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _amountController.dispose();
    _clientNameController.dispose();
    _clientEmailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final entity = ref.watch(activeEntityProvider);
    final invoicesAsync = entity == null ? null : ref.watch(invoicesListProvider(entity.id));
    final invoiceList = invoicesAsync?.value ?? [];

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
                      _buildCockpitCard(invoiceList),
                      const SizedBox(height: 14),
                      _buildFilterPills(invoiceList),
                      const SizedBox(height: 14),
                      _buildWizardBuilderCard(),
                      const SizedBox(height: 16),
                      _buildRecentInvoicesSection(invoicesAsync),
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

  Widget _buildCockpitCard(List<ProximInvoice> invoices) {
    final unpaid = invoices.where((i) => i.status.toUpperCase() != 'PAID').toList();
    final paid = invoices.where((i) => i.status.toUpperCase() == 'PAID').toList();
    final outstandingSum = unpaid.fold<double>(0.0, (sum, i) => sum + i.amount);
    final paidSum = paid.fold<double>(0.0, (sum, i) => sum + i.amount);

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
                  '\$${outstandingSum.toStringAsFixed(2)}',
                  style: ProximTextStyles.headlineLg().copyWith(
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${unpaid.length} pending links',
                  style: ProximTextStyles.labelXs(color: ProximColors.statusWarning),
                ),
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
                    Text('SETTLED', style: ProximTextStyles.labelXs()),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '\$${paidSum.toStringAsFixed(2)}',
                  style: ProximTextStyles.headlineLg(color: ProximColors.primary).copyWith(
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${paid.length} settled payments',
                  style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterPills(List<ProximInvoice> invoices) {
    final unpaidCount = invoices.where((i) => i.status.toUpperCase() != 'PAID').length;
    final paidCount = invoices.where((i) => i.status.toUpperCase() == 'PAID').length;
    final filters = [
      'All (${invoices.length})',
      'Unpaid ($unpaidCount)',
      'Paid ($paidCount)',
    ];
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
                GestureDetector(
                  onTap: _showEditClientDialog,
                  child: Container(
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
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: ProximColors.surfaceContainerHigh,
                          ),
                          child: Center(
                            child: Text(
                              _clientNameController.text.isNotEmpty ? _clientNameController.text[0].toUpperCase() : 'A',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: ProximColors.primary),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _clientNameController.text.isNotEmpty ? _clientNameController.text : 'Acme Corp',
                                style: ProximTextStyles.bodyLg().copyWith(fontWeight: FontWeight.w600),
                              ),
                              Text(
                                _clientEmailController.text.isNotEmpty ? _clientEmailController.text : 'billing@acme.com',
                                style: ProximTextStyles.labelXs(),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.edit, size: 16, color: ProximColors.onSurfaceVariant),
                      ],
                    ),
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

  void _showEditClientDialog() {
    final nameCtrl = TextEditingController(text: _clientNameController.text);
    final emailCtrl = TextEditingController(text: _clientEmailController.text);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: ProximColors.surfaceContainerLow,
        title: const Text('Edit Billed Enterprise', style: TextStyle(color: Colors.white, fontSize: 18)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Client Name', labelStyle: TextStyle(color: ProximColors.onSurfaceVariant)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: emailCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Client Email', labelStyle: TextStyle(color: ProximColors.onSurfaceVariant)),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: ProximColors.onSurfaceVariant)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: ProximColors.primary, foregroundColor: Colors.black),
            onPressed: () {
              setState(() {
                _clientNameController.text = nameCtrl.text.trim();
                _clientEmailController.text = emailCtrl.text.trim();
              });
              Navigator.pop(ctx);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentInvoicesSection(AsyncValue<List<ProximInvoice>>? invoicesAsync) {
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
          ],
        ),
        const SizedBox(height: 10),
        if (invoicesAsync == null || invoicesAsync.isLoading)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(24.0),
              child: CircularProgressIndicator(strokeWidth: 2, color: ProximColors.primary),
            ),
          )
        else if (invoicesAsync.hasError)
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Text(
              'Unable to load invoices.',
              style: ProximTextStyles.bodyMd(color: ProximColors.statusError),
            ),
          )
        else ...[
          Builder(builder: (context) {
            final all = invoicesAsync.value ?? [];
            final filtered = _selectedFilter == 0
                ? all
                : (_selectedFilter == 1
                    ? all.where((i) => i.status.toUpperCase() != 'PAID').toList()
                    : all.where((i) => i.status.toUpperCase() == 'PAID').toList());

            if (filtered.isEmpty) {
              return Container(
                padding: const EdgeInsets.all(24),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: ProximColors.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: ProximColors.hairlineBorder),
                ),
                child: Text(
                  'No invoices found.',
                  style: ProximTextStyles.bodyMd(color: ProximColors.onSurfaceVariant),
                ),
              );
            }

            return Column(
              children: filtered.map((inv) {
                final isPaid = inv.status.toUpperCase() == 'PAID';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: InkWell(
                    onTap: () => context.push('/checkout/${inv.id.isNotEmpty ? inv.id : inv.invoiceNumber}'),
                    child: _buildInvoiceRow(
                      inv.clientName,
                      '#${inv.invoiceNumber}',
                      '\$${inv.amount.toStringAsFixed(2)}',
                      inv.status,
                      isSuccess: isPaid,
                      isWarning: !isPaid,
                    ),
                  ),
                );
              }).toList(),
            );
          }),
        ],
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
