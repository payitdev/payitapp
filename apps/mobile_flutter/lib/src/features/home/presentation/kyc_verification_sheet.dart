import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_config.dart';
import '../../../core/theme/proxim_theme.dart';
import '../../auth/presentation/auth_provider.dart';
import 'kyc_provider.dart';

class KycVerificationSheet extends ConsumerStatefulWidget {
  const KycVerificationSheet({super.key});

  @override
  ConsumerState<KycVerificationSheet> createState() => _KycVerificationSheetState();
}

class _KycVerificationSheetState extends ConsumerState<KycVerificationSheet> {
  final _bvnController = TextEditingController();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _dobController = TextEditingController();

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final user = ref.read(currentUserProvider);
    if (user != null && user.fullName.isNotEmpty) {
      final parts = user.fullName.trim().split(RegExp(r'\s+'));
      if (parts.isNotEmpty) _firstNameController.text = parts.first;
      if (parts.length > 1) _lastNameController.text = parts.sublist(1).join(' ');
    }
  }

  @override
  void dispose() {
    _bvnController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _dobController.dispose();
    super.dispose();
  }

  Future<void> _selectDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(1995, 1, 1),
      firstDate: DateTime(1940),
      lastDate: DateTime(now.year - 16, now.month, now.day),
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: ProximColors.primary,
              surface: ProximColors.surfaceElevated,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      final y = picked.year.toString().padLeft(4, '0');
      final m = picked.month.toString().padLeft(2, '0');
      final d = picked.day.toString().padLeft(2, '0');
      setState(() => _dobController.text = '$y-$m-$d');
    }
  }

  Future<void> _handleSubmit() async {
    final bvn = _bvnController.text.trim();
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    final dob = _dobController.text.trim();

    if (bvn.length != 11 || !RegExp(r'^\d{11}$').hasMatch(bvn)) {
      setState(() => _errorMessage = 'Please enter a valid 11-digit BVN.');
      return;
    }
    if (firstName.isEmpty || lastName.isEmpty) {
      setState(() => _errorMessage = 'Please enter your legal first and last name.');
      return;
    }
    if (dob.isEmpty) {
      setState(() => _errorMessage = 'Please select your date of birth.');
      return;
    }

    final entity = ref.read(activeEntityProvider);
    if (entity == null) {
      setState(() => _errorMessage = 'No active account found.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final repo = ref.read(kycRepositoryProvider);
      await repo.submitTier1Kyc(
        entityId: entity.id,
        accountType: entity.isBusiness ? 'business' : 'personal',
        bvn: bvn,
        dateOfBirth: dob,
        firstName: firstName,
        lastName: lastName,
      );

      ref.invalidate(kycStatusProvider);

      if (!mounted) return;
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Identity verification submitted for review.'),
          backgroundColor: ProximColors.surfaceContainerHigh,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _errorMessage = e is ProximException
            ? e.message
            : 'Could not submit verification. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
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
              Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: ProximColors.primary.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.verified_user_outlined, color: ProximColors.primary, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Verify Identity', style: ProximTextStyles.headlineSm(color: Colors.white)),
                        const SizedBox(height: 2),
                        Text('Unlock dedicated bank accounts & higher limits',
                            style: ProximTextStyles.bodySm(color: ProximColors.onSurfaceVariant)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // BVN Field
              Text('BANK VERIFICATION NUMBER (BVN)', style: ProximTextStyles.labelSm()),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                decoration: BoxDecoration(
                  color: ProximColors.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: ProximColors.hairlineBorder),
                ),
                child: TextField(
                  controller: _bvnController,
                  keyboardType: TextInputType.number,
                  maxLength: 11,
                  style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    counterText: '',
                    hintText: '11-digit BVN',
                    hintStyle: TextStyle(color: ProximColors.onSurfaceVariant),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // First and Last Name
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('FIRST NAME', style: ProximTextStyles.labelSm()),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                          decoration: BoxDecoration(
                            color: ProximColors.surfaceContainerLow,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: ProximColors.hairlineBorder),
                          ),
                          child: TextField(
                            controller: _firstNameController,
                            style: const TextStyle(color: Colors.white, fontSize: 15),
                            decoration: const InputDecoration(
                              border: InputBorder.none,
                              hintText: 'First name',
                              hintStyle: TextStyle(color: ProximColors.onSurfaceVariant),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('LAST NAME', style: ProximTextStyles.labelSm()),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                          decoration: BoxDecoration(
                            color: ProximColors.surfaceContainerLow,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: ProximColors.hairlineBorder),
                          ),
                          child: TextField(
                            controller: _lastNameController,
                            style: const TextStyle(color: Colors.white, fontSize: 15),
                            decoration: const InputDecoration(
                              border: InputBorder.none,
                              hintText: 'Last name',
                              hintStyle: TextStyle(color: ProximColors.onSurfaceVariant),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Date of Birth
              Text('DATE OF BIRTH', style: ProximTextStyles.labelSm()),
              const SizedBox(height: 6),
              GestureDetector(
                onTap: _selectDate,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: ProximColors.hairlineBorder),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _dobController.text.isEmpty ? 'YYYY-MM-DD' : _dobController.text,
                        style: TextStyle(
                          color: _dobController.text.isEmpty
                              ? ProximColors.onSurfaceVariant
                              : Colors.white,
                          fontSize: 15,
                        ),
                      ),
                      const Icon(Icons.calendar_today_outlined, size: 18, color: ProximColors.onSurfaceVariant),
                    ],
                  ),
                ),
              ),

              if (_errorMessage != null) ...[
                const SizedBox(height: 14),
                Text(_errorMessage!, style: ProximTextStyles.labelXs(color: ProximColors.statusError)),
              ],

              const SizedBox(height: 18),

              // Security notice
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.shield_outlined, size: 15, color: ProximColors.statusSuccess),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Your data is encrypted end-to-end and verified with regulated identity clearance registries.',
                      style: ProximTextStyles.labelXs(color: ProximColors.onSurfaceVariant),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Submit CTA
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _handleSubmit,
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
                          'Submit Verification',
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
}
