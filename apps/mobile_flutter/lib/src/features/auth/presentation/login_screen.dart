import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';
import 'auth_provider.dart';

/// Sign-in / sign-up screen.
///
/// Proxim is passwordless: email and Google sign-in go through Privy, and the
/// backend auto-registers first-time emails — so one flow covers both
/// "log in" and "sign up". "Forgot password" is therefore "resend a fresh
/// code" — there is no password to reset.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

enum _LoginStep { email, code }

class _LoginScreenState extends ConsumerState<LoginScreen> {
  _LoginStep _step = _LoginStep.email;
  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  int _resendCountdown = 0;

  static const _demoNotice =
      'No password? Correct — Proxim signs you in with a one-time code sent to '
      'your email.';

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    final email = _emailController.text.trim();
    if (!_isValidEmail(email)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid email address.')),
      );
      return;
    }
    final sent = await ref.read(authProvider.notifier).sendEmailCode(email);
    if (sent && mounted) {
      setState(() {
        _step = _LoginStep.code;
        _codeController.clear();
        _resendCountdown = 30;
      });
      _tickResendCountdown();
    }
  }

  void _tickResendCountdown() {
    Future.doWhile(() async {
      await Future<void>.delayed(const Duration(seconds: 1));
      if (!mounted || _step != _LoginStep.code) return false;
      setState(() => _resendCountdown = (_resendCountdown - 1).clamp(0, 30));
      return _resendCountdown > 0;
    });
  }

  Future<void> _verifyCode() async {
    final ok = await ref.read(authProvider.notifier).loginWithEmailCode(
          email: _emailController.text.trim(),
          code: _codeController.text.trim(),
        );
    if (!ok && mounted) {
      _codeController.clear();
    }
  }

  Future<void> _loginWithGoogle() async {
    await ref.read(authProvider.notifier).loginWithGoogle();
  }

  Future<void> _loginDemo() async {
    await ref.read(authProvider.notifier).loginDemo();
  }

  void _showPasswordlessSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: ProximColors.surfaceContainerLow,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('No passwords here', style: ProximTextStyles.headlineSm()),
              const SizedBox(height: 12),
              Text(
                'Proxim uses one-time codes instead of passwords, so there is '
                'nothing to forget or reset. Enter your email on the sign-in '
                'screen and we will send you a fresh code — the same flow '
                'creates your account if you are new.',
                style: ProximTextStyles.bodyMd(),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    Navigator.of(context).pop();
                    if (_step == _LoginStep.code) {
                      setState(() => _step = _LoginStep.email);
                    }
                    _emailController.clear();
                  },
                  child: const Text('Got it'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  bool _isValidEmail(String email) =>
      email.contains('@') && email.contains('.') && email.length > 3;

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final isBusy = auth.isLoading || auth.isSendingCode;

    return Scaffold(
      body: CenteredAppContainer(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 48, 24, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Brand
              Text('Proxim', style: ProximTextStyles.displayLg(), textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Text(
                'Money without limits.',
                style: ProximTextStyles.bodyMd(),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),

              if (_step == _LoginStep.email) ...[
                _buildEmailStep(isBusy),
              ] else ...[
                _buildCodeStep(isBusy),
              ],

              if (auth.errorMessage != null) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: ProximColors.statusDanger.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: ProximColors.statusDanger.withValues(alpha: 0.4),
                    ),
                  ),
                  child: Text(
                    auth.errorMessage!,
                    style: ProximTextStyles.bodySm(color: ProximColors.error),
                  ),
                ),
              ],

              const SizedBox(height: 24),
              Text(
                _demoNotice,
                style: ProximTextStyles.bodySm(),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: isBusy ? null : _showPasswordlessSheet,
                child: const Text('Forgot your password?'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmailStep(bool isBusy) {
    final isConfigured = AppConfig.privyAppId.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _emailController,
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _sendCode(),
          style: ProximTextStyles.bodyLg(color: Colors.white),
          decoration: const InputDecoration(
            hintText: 'you@company.com',
            prefixIcon: Icon(Icons.mail_outline, size: 20),
          ),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: isBusy || !isConfigured ? null : _sendCode,
          child: isBusy
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Continue with Email'),
        ),
        if (!isConfigured)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              'Email sign-in is not configured for this build.',
              style: ProximTextStyles.bodySm(color: ProximColors.statusWarning),
              textAlign: TextAlign.center,
            ),
          ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: isBusy || !isConfigured ? null : _loginWithGoogle,
          icon: const Icon(Icons.g_mobiledata, size: 24),
          label: const Text('Continue with Google'),
        ),
        const SizedBox(height: 12),
        TextButton(
          onPressed: isBusy ? null : _loginDemo,
          child: const Text('Explore the demo account'),
        ),
      ],
    );
  }

  Widget _buildCodeStep(bool isBusy) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Check your email', style: ProximTextStyles.headlineMd()),
        const SizedBox(height: 8),
        Text(
          'We sent a 6-digit code to ${_emailController.text.trim()}. '
          'New here? Verifying the code creates your account.',
          style: ProximTextStyles.bodyMd(),
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _codeController,
          keyboardType: TextInputType.number,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(6),
          ],
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _verifyCode(),
          textAlign: TextAlign.center,
          style: ProximTextStyles.headlineMd().copyWith(letterSpacing: 8),
          decoration: const InputDecoration(hintText: '••••••'),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: isBusy ? null : _verifyCode,
          child: isBusy
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Verify & Sign In'),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton(
              onPressed: isBusy
                  ? null
                  : () => setState(() {
                        _step = _LoginStep.email;
                        _codeController.clear();
                      }),
              child: const Text('Change email'),
            ),
            TextButton(
              onPressed: isBusy || _resendCountdown > 0
                  ? null
                  : () async {
                      final sent = await ref
                          .read(authProvider.notifier)
                          .sendEmailCode(_emailController.text.trim());
                      if (sent && mounted) {
                        setState(() => _resendCountdown = 30);
                        _tickResendCountdown();
                      }
                    },
              child: Text(
                _resendCountdown > 0
                    ? 'Resend code in ${_resendCountdown}s'
                    : 'Resend code',
              ),
            ),
          ],
        ),
      ],
    );
  }
}
