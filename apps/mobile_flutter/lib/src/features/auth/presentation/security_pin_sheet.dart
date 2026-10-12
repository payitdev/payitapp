import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_config.dart';
import '../../../core/theme/proxim_theme.dart';
import 'auth_provider.dart';

class SecurityPinSheet extends ConsumerStatefulWidget {
  const SecurityPinSheet({super.key});

  @override
  ConsumerState<SecurityPinSheet> createState() => _SecurityPinSheetState();
}

class _SecurityPinSheetState extends ConsumerState<SecurityPinSheet> {
  int _step = 0; // 0 = enter pin, 1 = confirm pin
  String _firstPin = '';
  String _currentInput = '';
  bool _isLoading = false;
  String? _errorMessage;

  void _onKeyPress(String val) {
    if (_isLoading) return;
    if (_currentInput.length >= 6) return;

    setState(() {
      _errorMessage = null;
      _currentInput += val;
    });

    if (_currentInput.length == 6) {
      _handleCompletePin(_currentInput);
    }
  }

  void _onBackspace() {
    if (_isLoading || _currentInput.isEmpty) return;
    setState(() {
      _errorMessage = null;
      _currentInput = _currentInput.substring(0, _currentInput.length - 1);
    });
  }

  Future<void> _handleCompletePin(String pin) async {
    if (_step == 0) {
      // Move to confirm step
      await Future.delayed(const Duration(milliseconds: 150));
      if (!mounted) return;
      setState(() {
        _firstPin = pin;
        _currentInput = '';
        _step = 1;
      });
    } else {
      // Verify match
      if (pin != _firstPin) {
        setState(() {
          _errorMessage = 'PINs do not match. Please start again.';
          _currentInput = '';
          _firstPin = '';
          _step = 0;
        });
        return;
      }

      setState(() => _isLoading = true);
      try {
        await ref.read(authRepositoryProvider).setPasscode(pin);
        if (!mounted) return;
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Security PIN set successfully.'),
            backgroundColor: ProximColors.surfaceContainerHigh,
          ),
        );
      } catch (e) {
        if (!mounted) return;
        setState(() {
          _isLoading = false;
          _errorMessage = e is ProximException
              ? e.message
              : 'Could not set PIN. Please try again.';
          _currentInput = '';
          _firstPin = '';
          _step = 0;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = _step == 0 ? 'Create Security PIN' : 'Confirm Security PIN';
    final subtitle = _step == 0
        ? 'Enter a 6-digit passcode for authorizing transactions'
        : 'Re-enter your 6-digit passcode to confirm';

    return Container(
      decoration: const BoxDecoration(
        color: ProximColors.surfaceElevated,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
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
            const SizedBox(height: 20),

            // Icon & Header
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: ProximColors.primary.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.lock_outline, color: ProximColors.primary, size: 22),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              style: ProximTextStyles.headlineSm(color: Colors.white),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: ProximTextStyles.bodySm(color: ProximColors.onSurfaceVariant),
            ),
            const SizedBox(height: 24),

            // PIN Dots Indicator
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(6, (index) {
                final isFilled = index < _currentInput.length;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  margin: const EdgeInsets.symmetric(horizontal: 8),
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isFilled
                        ? ProximColors.primary
                        : Colors.white.withValues(alpha: 0.1),
                    border: Border.all(
                      color: isFilled
                          ? ProximColors.primary
                          : Colors.white.withValues(alpha: 0.2),
                      width: 1.5,
                    ),
                  ),
                );
              }),
            ),

            if (_errorMessage != null) ...[
              const SizedBox(height: 16),
              Text(
                _errorMessage!,
                style: ProximTextStyles.labelXs(color: ProximColors.statusError),
                textAlign: TextAlign.center,
              ),
            ],

            const SizedBox(height: 24),

            // Numeric Keypad
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: CircularProgressIndicator(color: ProximColors.primary),
              )
            else
              _buildKeypad(),
          ],
        ),
      ),
    );
  }

  Widget _buildKeypad() {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: ['1', '2', '3'].map(_buildKeypadButton).toList(),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: ['4', '5', '6'].map(_buildKeypadButton).toList(),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: ['7', '8', '9'].map(_buildKeypadButton).toList(),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            const SizedBox(width: 72, height: 56),
            _buildKeypadButton('0'),
            SizedBox(
              width: 72,
              height: 56,
              child: IconButton(
                icon: const Icon(Icons.backspace_outlined, color: Colors.white, size: 22),
                onPressed: _onBackspace,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildKeypadButton(String digit) {
    return SizedBox(
      width: 72,
      height: 56,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(28),
          onTap: () => _onKeyPress(digit),
          child: Center(
            child: Text(
              digit,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
