import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_config.dart';
import '../../../core/theme/proxim_theme.dart';
import '../../auth/presentation/auth_provider.dart';
import 'cards_provider.dart';

class IssueCardSheet extends ConsumerStatefulWidget {
  const IssueCardSheet({super.key});

  @override
  ConsumerState<IssueCardSheet> createState() => _IssueCardSheetState();
}

class _IssueCardSheetState extends ConsumerState<IssueCardSheet> {
  String _selectedBrand = 'VISA'; // 'VISA' or 'MASTERCARD'
  String _selectedType = 'VIRTUAL'; // 'VIRTUAL', 'BUSINESS', 'BURNER'
  final TextEditingController _amountController = TextEditingController(text: '0');
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _handleIssue() async {
    final entity = ref.read(activeEntityProvider);
    if (entity == null) {
      setState(() => _errorMessage = 'No active entity found.');
      return;
    }

    final amount = double.tryParse(_amountController.text.trim()) ?? 0.0;
    if (amount < 0) {
      setState(() => _errorMessage = 'Please enter a valid amount.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      await ref.read(cardsRepositoryProvider).issueCard(
            entityId: entity.id,
            brand: _selectedBrand,
            cardType: _selectedType,
            amount: amount,
            currency: 'USD',
          );
      ref.invalidate(cardsListProvider);

      if (!mounted) return;
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Your virtual card is ready.'),
          backgroundColor: ProximColors.surfaceContainerHigh,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _errorMessage = e is ProximException
            ? e.message
            : 'Could not issue card. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeEntity = ref.watch(activeEntityProvider);
    final user = ref.watch(currentUserProvider);
    final holderName = activeEntity?.legalName ?? user?.fullName ?? 'Cardholder';

    return Container(
      decoration: const BoxDecoration(
        color: ProximColors.surfaceElevated,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Handle
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),

              // Title
              Text(
                'Get Virtual Card',
                style: ProximTextStyles.headlineSm(color: Colors.white),
              ),
              const SizedBox(height: 4),
              Text(
                'Spend globally with instant conversion and zero foreign transaction fees.',
                style: ProximTextStyles.bodySm(color: ProximColors.onSurfaceVariant),
              ),
              const SizedBox(height: 20),

              // Visual Card Preview
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(18),
                  gradient: LinearGradient(
                    colors: _selectedBrand == 'VISA'
                        ? [const Color(0xFF132832), const Color(0xFF0F172A)]
                        : [const Color(0xFF2E1A1A), const Color(0xFF0F172A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.4),
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
                        Text(
                          'Proxim',
                          style: ProximTextStyles.headlineSm(color: Colors.white)
                              .copyWith(letterSpacing: 1.2),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            _selectedBrand,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 28),
                    const Text(
                      '••••  ••••  ••••  4829',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                        letterSpacing: 2.0,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    const SizedBox(height: 18),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'CARDHOLDER',
                                style: ProximTextStyles.labelXs(
                                    color: Colors.white.withValues(alpha: 0.6)),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                holderName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              'EXPIRES',
                              style: ProximTextStyles.labelXs(
                                  color: Colors.white.withValues(alpha: 0.6)),
                            ),
                            const SizedBox(height: 2),
                            const Text(
                              '12/29',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Brand Selector
              Text('CARD NETWORK', style: ProximTextStyles.labelSm()),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _buildChoiceChip(
                      label: 'Visa',
                      selected: _selectedBrand == 'VISA',
                      onTap: () => setState(() => _selectedBrand = 'VISA'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildChoiceChip(
                      label: 'Mastercard',
                      selected: _selectedBrand == 'MASTERCARD',
                      onTap: () => setState(() => _selectedBrand = 'MASTERCARD'),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 18),

              // Card Type Selector
              Text('CARD USE', style: ProximTextStyles.labelSm()),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _buildChoiceChip(
                      label: 'Spender',
                      selected: _selectedType == 'VIRTUAL',
                      onTap: () => setState(() => _selectedType = 'VIRTUAL'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildChoiceChip(
                      label: 'Corporate',
                      selected: _selectedType == 'BUSINESS',
                      onTap: () => setState(() => _selectedType = 'BUSINESS'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildChoiceChip(
                      label: 'Single-Use',
                      selected: _selectedType == 'BURNER',
                      onTap: () => setState(() => _selectedType = 'BURNER'),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 18),

              // Optional Initial Top-Up
              Text('INITIAL FUNDING (USD)', style: ProximTextStyles.labelSm()),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                decoration: BoxDecoration(
                  color: ProximColors.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: ProximColors.hairlineBorder),
                ),
                child: Row(
                  children: [
                    const Text('\$', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _amountController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                          hintText: '0.00',
                          hintStyle: TextStyle(color: ProximColors.onSurfaceVariant),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              if (_errorMessage != null) ...[
                const SizedBox(height: 12),
                Text(
                  _errorMessage!,
                  style: ProximTextStyles.labelXs(color: ProximColors.statusError),
                ),
              ],

              const SizedBox(height: 24),

              // Submit CTA
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _handleIssue,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: ProximColors.primary,
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2),
                        )
                      : const Text(
                          'Issue Card',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChoiceChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: selected
              ? ProximColors.primary.withValues(alpha: 0.15)
              : ProximColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? ProximColors.primary : ProximColors.hairlineBorder,
            width: selected ? 1.5 : 1.0,
          ),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              color: selected ? Colors.white : ProximColors.onSurfaceVariant,
            ),
          ),
        ),
      ),
    );
  }
}
