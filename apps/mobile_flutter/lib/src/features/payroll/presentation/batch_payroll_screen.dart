import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';
import '../../auth/presentation/auth_provider.dart';
import '../data/payroll_repository.dart';
import 'payroll_provider.dart';

class BatchPayrollScreen extends ConsumerStatefulWidget {
  const BatchPayrollScreen({super.key});

  @override
  ConsumerState<BatchPayrollScreen> createState() => _BatchPayrollScreenState();
}

class _BatchPayrollScreenState extends ConsumerState<BatchPayrollScreen> {
  bool _isBroadcasting = false;
  bool _isSettled = false;
  String? _errorMessage;

  final List<PayrollRecipient> _recipients = [
    const PayrollRecipient(
      name: 'Sarah Jenkins',
      accountOrPhone: '0123456789',
      bankOrNetwork: '058',
      amount: 45000.0,
    ),
    const PayrollRecipient(
      name: 'David Miller',
      accountOrPhone: '0987654321',
      bankOrNetwork: '011',
      amount: 52000.0,
    ),
    const PayrollRecipient(
      name: 'Elena Rostova',
      accountOrPhone: '0456789123',
      bankOrNetwork: '033',
      amount: 38000.0,
    ),
  ];

  double get _totalBatchAmount => _recipients.fold<double>(0.0, (sum, r) => sum + r.amount);

  Future<void> _handleExecuteBatch(String entityId) async {
    if (_isBroadcasting || _isSettled) return;
    if (entityId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No active entity found.')),
      );
      return;
    }
    if (_recipients.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add at least one recipient to disburse.')),
      );
      return;
    }

    setState(() {
      _isBroadcasting = true;
      _errorMessage = null;
    });

    try {
      final repo = ref.read(payrollRepositoryProvider);
      await repo.executePayroll(
        entityId: entityId,
        title: 'Payroll Disbursement • ${DateTime.now().month}/${DateTime.now().year}',
        currency: 'NGN',
        recipients: _recipients,
      );
      ref.invalidate(payrollRunsProvider(entityId));
      if (!mounted) return;
      setState(() {
        _isBroadcasting = false;
        _isSettled = true;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Disbursed ₦${_totalBatchAmount.toStringAsFixed(2)} to ${_recipients.length} recipients.'),
          backgroundColor: ProximColors.surfaceContainerHigh,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isBroadcasting = false;
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_errorMessage ?? 'Payroll execution failed.'),
          backgroundColor: ProximColors.statusError,
        ),
      );
    }
  }

  void _showAddRecipientDialog() {
    final nameCtrl = TextEditingController();
    final accountCtrl = TextEditingController();
    final amountCtrl = TextEditingController(text: '50000');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: ProximColors.surfaceContainerLow,
        title: const Text('Add Recipient', style: TextStyle(color: Colors.white, fontSize: 18)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Recipient Name', labelStyle: TextStyle(color: ProximColors.onSurfaceVariant)),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: accountCtrl,
              style: const TextStyle(color: Colors.white),
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Account Number / Phone', labelStyle: TextStyle(color: ProximColors.onSurfaceVariant)),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: amountCtrl,
              style: const TextStyle(color: Colors.white),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Amount (NGN)', labelStyle: TextStyle(color: ProximColors.onSurfaceVariant)),
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
              final amt = double.tryParse(amountCtrl.text.replaceAll(',', '').trim()) ?? 0.0;
              if (nameCtrl.text.trim().isNotEmpty && accountCtrl.text.trim().isNotEmpty && amt > 0) {
                setState(() {
                  _recipients.add(PayrollRecipient(
                    name: nameCtrl.text.trim(),
                    accountOrPhone: accountCtrl.text.trim(),
                    amount: amt,
                  ));
                });
                Navigator.pop(ctx);
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final entity = ref.watch(activeEntityProvider);
    final entityId = entity?.id ?? '';
    final runsAsync = entityId.isEmpty ? null : ref.watch(payrollRunsProvider(entityId));

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
                      ..._recipients.map((r) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: _buildRecipientCard(
                              name: r.name,
                              role: r.accountOrPhone,
                              amount: '₦${r.amount.toStringAsFixed(2)}',
                              currency: 'NGN Direct',
                              rail: 'Instant Clearing Bank Wire',
                              status: 'Ready',
                              isSuccess: true,
                              onRemove: () => setState(() => _recipients.remove(r)),
                            ),
                          )),
                      const SizedBox(height: 16),
                      _buildValidationNote(),
                      const SizedBox(height: 14),
                      _buildExecutionCockpit(entityId),
                      const SizedBox(height: 24),
                      _buildPastRunsSection(runsAsync),
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
              'Batch Payroll',
              style: ProximTextStyles.headlineSm(),
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.person_add_alt, size: 20, color: ProximColors.primary),
            onPressed: _showAddRecipientDialog,
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
              'CORPORATE DISBURSEMENTS',
              style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                letterSpacing: 1.2,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text('Automated Payroll Run', style: ProximTextStyles.headlineLg()),
      ],
    );
  }

  Widget _buildFundingSourceCard() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: ProximColors.surfaceContainerHighest,
            ),
            child: const Icon(Icons.account_balance_wallet, size: 18, color: ProximColors.primary),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('FUNDING ACCOUNT', style: ProximTextStyles.labelXs()),
                Text('Proxim Operational Treasury', style: ProximTextStyles.bodyLg().copyWith(fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: ProximColors.primary.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text('Active', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionButtons() {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: ProximColors.hairlineBorder),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              padding: const EdgeInsets.symmetric(vertical: 10),
            ),
            onPressed: _showAddRecipientDialog,
            icon: const Icon(Icons.add, size: 16, color: ProximColors.primary),
            label: const Text('Add Employee', style: TextStyle(color: Colors.white, fontSize: 13)),
          ),
        ),
      ],
    );
  }

  Widget _buildBatchQueueHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text('Recipient Queue (${_recipients.length})', style: ProximTextStyles.headlineSm()),
        Text('Total: ₦${_totalBatchAmount.toStringAsFixed(2)}', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
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
    VoidCallback? onRemove,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: ProximColors.surfaceContainerHighest,
                      ),
                      child: Center(
                        child: Text(
                          name.isNotEmpty ? name[0].toUpperCase() : 'E',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: ProximColors.primary),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: ProximTextStyles.bodyLg().copyWith(fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
                          Text(role, style: ProximTextStyles.labelXs()),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(amount, style: ProximTextStyles.bodyLg().copyWith(fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()])),
                      Text(currency, style: ProximTextStyles.labelXs()),
                    ],
                  ),
                  if (onRemove != null && !_isSettled) ...[
                    const SizedBox(width: 4),
                    IconButton(
                      icon: const Icon(Icons.close, size: 14, color: ProximColors.onSurfaceVariant),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: onRemove,
                    ),
                  ],
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(rail, style: ProximTextStyles.labelXs()),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isSuccess ? ProximColors.statusSuccess.withValues(alpha: 0.15) : ProximColors.statusWarning.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(status, style: ProximTextStyles.labelXs(color: isSuccess ? ProximColors.statusSuccess : ProximColors.statusWarning)),
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
            Text('${_recipients.length} Accounts Validated', style: ProximTextStyles.labelXs()),
          ],
        ),
        Text('Proxim Treasury Engine', style: ProximTextStyles.labelXs()),
      ],
    );
  }

  Widget _buildExecutionCockpit(String entityId) {
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
                  Text('TOTAL BATCH DISBURSEMENT', style: ProximTextStyles.labelXs()),
                  const SizedBox(height: 2),
                  Text(
                    '₦${_totalBatchAmount.toStringAsFixed(2)} NGN',
                    style: ProximTextStyles.headlineSm(color: ProximColors.textWhite).copyWith(
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('DISBURSEMENT RAIL', style: ProximTextStyles.labelXs()),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const Icon(Icons.flash_on, size: 14, color: ProximColors.primary),
                      const SizedBox(width: 4),
                      Text('Brails Instant', style: ProximTextStyles.labelSm(color: ProximColors.primary)),
                    ],
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),
          GestureDetector(
            onTap: () => _handleExecuteBatch(entityId),
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
                        child: CircularProgressIndicator(color: ProximColors.surfaceContainerLowest, strokeWidth: 2.5),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(_isSettled ? Icons.check_circle : Icons.bolt, size: 18, color: ProximColors.surfaceContainerLowest),
                          const SizedBox(width: 6),
                          Text(
                            _isSettled ? 'Payroll Disbursed' : 'Disburse Payroll Batch',
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: ProximColors.surfaceContainerLowest),
                          ),
                        ],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPastRunsSection(AsyncValue<List<PayrollRunRecord>>? runsAsync) {
    if (runsAsync == null || runsAsync.isLoading) {
      return const SizedBox.shrink();
    }
    final runs = runsAsync.value ?? [];
    if (runs.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Past Payroll Runs', style: ProximTextStyles.headlineSm()),
        const SizedBox(height: 10),
        ...runs.map((run) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: ProximColors.surfaceContainerLow,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: ProximColors.hairlineBorder),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(run.title, style: ProximTextStyles.bodyLg().copyWith(fontWeight: FontWeight.w600)),
                      Text('${run.employeeCount} recipients • ${run.status}', style: ProximTextStyles.labelXs()),
                    ],
                  ),
                  Text('₦${run.totalAmount.toStringAsFixed(2)}', style: ProximTextStyles.bodyLg().copyWith(fontWeight: FontWeight.w700)),
                ],
              ),
            )),
      ],
    );
  }
}
