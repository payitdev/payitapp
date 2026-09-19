import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';
import 'auth_provider.dart';

/// Sign-in / sign-up screen, matching the Stitch auth designs.
///
/// Passwordless: email OTP and Google sign-in go through Privy, and the
/// backend auto-registers first-time emails — one flow covers both
/// "log in" and "sign up". "Forgot password" is the passwordless helper
/// sheet (there is no password to reset). Rendered outside the app shell —
/// no top or bottom navigation before authentication.
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
  final _codeFocus = FocusNode();
  int _resendCountdown = 0;

  static const _resendSeconds = 30;

  bool get _isValidEmail {
    final email = _emailController.text.trim();
    return email.contains('@') && email.contains('.') && email.length > 3;
  }

  @override
  void initState() {
    super.initState();
    _emailController.addListener(() => setState(() {}));
    _codeController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _codeFocus.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    if (!_isValidEmail) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid email address.')),
      );
      return;
    }
    final sent = await ref.read(authProvider.notifier).sendEmailCode(
          _emailController.text.trim(),
        );
    if (sent && mounted) {
      setState(() {
        _step = _LoginStep.code;
        _codeController.clear();
        _resendCountdown = _resendSeconds;
      });
      _tickResendCountdown();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _codeFocus.requestFocus();
      });
    }
  }

  void _tickResendCountdown() {
    Future.doWhile(() async {
      await Future<void>.delayed(const Duration(seconds: 1));
      if (!mounted || _step != _LoginStep.code) return false;
      setState(() => _resendCountdown = (_resendCountdown - 1).clamp(0, _resendSeconds));
      return _resendCountdown > 0;
    });
  }

  Future<void> _verifyCode() async {
    if (_codeController.text.length != 6) return;
    final ok = await ref.read(authProvider.notifier).loginWithEmailCode(
          email: _emailController.text.trim(),
          code: _codeController.text.trim(),
        );
    if (!ok && mounted) {
      _codeController.clear();
      _codeFocus.requestFocus();
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
      isScrollControlled: true,
      backgroundColor: ProximColors.surfaceContainerLow,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => _PasswordlessSheet(
        onSendCode: () async {
          Navigator.of(context).pop();
          if (_isValidEmail) await _sendCode();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final isBusy = auth.isLoading || auth.isSendingCode;

    return Scaffold(
      backgroundColor: ProximColors.scaffoldBg,
      body: Stack(
        children: [
          const _AuroraGlow(),
          CenteredAppContainer(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_step == _LoginStep.email)
                    _buildEmailStep(isBusy)
                  else
                    _buildCodeStep(isBusy, auth),
                  if (auth.errorMessage != null) ...[
                    const SizedBox(height: 16),
                    _ErrorBanner(message: auth.errorMessage!),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Step 1 — Email ─────────────────────────────────────────────────────────

  Widget _buildEmailStep(bool isBusy) {
    final isConfigured = AppConfig.privyAppId.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 12),
        const Center(child: _BrandEmblem()),
        const SizedBox(height: 12),
        Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    color: ProximColors.primary,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  'PROXIM TREASURY V2.4',
                  style: ProximTextStyles.labelXs(color: ProximColors.primary)
                      .copyWith(letterSpacing: 2),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'Welcome to Proxim',
          style: ProximTextStyles.headlineLg(),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Enter your email for passwordless sign in. If you\'re new, '
          'verifying your email creates your account automatically.',
          style: ProximTextStyles.bodyMd(),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),

        // Auth card
        Container(
          decoration: BoxDecoration(
            color: ProximColors.surfaceContainerLow,
            borderRadius: BorderRadius.circular(16),
            boxShadow: const [
              BoxShadow(
                color: Color(0x99070E1E),
                blurRadius: 24,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            children: [
              Container(
                height: 2,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.transparent, Color(0x805DF6EC), Colors.transparent],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Flexible(
                          child: Text(
                            'Work or personal email',
                            style: ProximTextStyles.labelSm(),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.verified_user_outlined,
                              size: 13,
                              color: ProximColors.primary,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Privy secured',
                              style: ProximTextStyles.labelXs(
                                color: ProximColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _sendCode(),
                      enabled: !isBusy,
                      style: ProximTextStyles.bodyLg(color: Colors.white),
                      decoration: InputDecoration(
                        hintText: 'alex.rivera@acme.com',
                        hintStyle: ProximTextStyles.bodyLg(
                          color: ProximColors.onSurfaceVariant.withValues(alpha: 0.4),
                        ),
                        prefixIcon: const Icon(
                          Icons.alternate_email,
                          size: 20,
                          color: ProximColors.onSurfaceVariant,
                        ),
                        suffixIcon: _emailController.text.isEmpty
                            ? null
                            : GestureDetector(
                                onTap: () {
                                  _emailController.clear();
                                  _emailController.selection =
                                      const TextSelection.collapsed(offset: 0);
                                },
                                child: const Icon(
                                  Icons.close,
                                  size: 16,
                                  color: ProximColors.onSurfaceVariant,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    _GradientCtaButton(
                      onPressed: isBusy || !isConfigured ? null : _sendCode,
                      busyLabel: 'Authenticating…',
                      isBusy: isBusy,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            'Continue with Email',
                            style: ProximTextStyles.bodyLg(
                              color: ProximColors.onPrimary,
                            ).copyWith(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(width: 8),
                          const Icon(
                            Icons.arrow_forward,
                            size: 20,
                            color: ProximColors.onPrimary,
                          ),
                        ],
                      ),
                    ),
                    if (!isConfigured)
                      Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: Text(
                          'Email sign-in is not configured for this build.',
                          style: ProximTextStyles.bodySm(
                            color: ProximColors.statusWarning,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    const SizedBox(height: 20),

                    // Divider
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        Container(height: 1, color: const Color(0x662E3446)),
                        Container(
                          color: ProximColors.surfaceContainerLow,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text(
                            'OR CONTINUE WITH',
                            style: ProximTextStyles.labelXs().copyWith(letterSpacing: 1.5),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Google
                    Material(
                      color: ProximColors.surfaceContainer,
                      borderRadius: BorderRadius.circular(999),
                      child: InkWell(
                        onTap: isBusy || !isConfigured ? null : _loginWithGoogle,
                        borderRadius: BorderRadius.circular(999),
                        child: Container(
                          height: 48,
                          alignment: Alignment.center,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const _GoogleLogo(size: 18),
                              const SizedBox(width: 10),
                              Text(
                                'Continue with Google',
                                style: ProximTextStyles.bodyLg(color: Colors.white)
                                    .copyWith(fontWeight: FontWeight.w500),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Passwordless recovery link
                    Center(
                      child: GestureDetector(
                        onTap: isBusy ? null : _showPasswordlessSheet,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.lock_reset,
                              size: 16,
                              color: ProximColors.primary,
                            ),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                'Forgot your password? Tap to learn how '
                                'passwordless recovery works.',
                                style: ProximTextStyles.bodySm(),
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Trust banner
        Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.verified_user,
                  size: 16,
                  color: ProximColors.primary,
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    'Protected by Privy cryptographic vaults & 256-bit encryption '
                    '• Instant cross-chain & fiat settlement',
                    style: ProximTextStyles.labelXs().copyWith(height: 1.4),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: [
                _trustChip(Icons.key, 'Non-Custodial', ProximColors.primary),
                _dot(),
                _trustChip(Icons.bolt, 'Sub-second Auth', ProximColors.statusSuccess),
                _dot(),
                _trustChip(Icons.token, 'Multi-Chain', ProximColors.secondary),
              ],
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: isBusy ? null : _loginDemo,
              child: Text(
                'Explore the demo account',
                style: ProximTextStyles.bodySm(color: ProximColors.primary),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _trustChip(IconData icon, String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(
          label,
          style: ProximTextStyles.labelXs().copyWith(
            color: ProximColors.onSurfaceVariant.withValues(alpha: 0.6),
          ),
        ),
      ],
    );
  }

  Widget _dot() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      child: Container(
        width: 3,
        height: 3,
        decoration: const BoxDecoration(
          color: ProximColors.surfaceContainerHighest,
          shape: BoxShape.circle,
        ),
      ),
    );
  }

  // ── Step 2 — Verification code ─────────────────────────────────────────────

  Widget _buildCodeStep(bool isBusy, AuthState auth) {
    final email = _emailController.text.trim();
    final code = _codeController.text;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Top row: change email + step pill
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Material(
              color: ProximColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(999),
              child: InkWell(
                onTap: isBusy
                    ? null
                    : () => setState(() {
                          _step = _LoginStep.email;
                          _codeController.clear();
                        }),
                borderRadius: BorderRadius.circular(999),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.arrow_back,
                        size: 18,
                        color: ProximColors.onSurfaceVariant,
                      ),
                      const SizedBox(width: 6),
                      Text('Change email', style: ProximTextStyles.labelSm()),
                    ],
                  ),
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: ProximColors.surfaceContainerHighest.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: ProximColors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'STEP 2 OF 2',
                    style: ProximTextStyles.labelXs(
                      color: ProximColors.primary,
                    ).copyWith(letterSpacing: 2),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 28),

        // Hero
        Center(
          child: SizedBox(
            width: 80,
            height: 80,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainerHigh,
                    shape: BoxShape.circle,
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x4035D9D0),
                        blurRadius: 24,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.mark_email_read,
                    size: 32,
                    color: ProximColors.primary,
                  ),
                ),
                Positioned(
                  bottom: 2,
                  right: 2,
                  child: Container(
                    width: 26,
                    height: 26,
                    decoration: BoxDecoration(
                      color: ProximColors.surfaceElevated,
                      shape: BoxShape.circle,
                      border: Border.all(color: ProximColors.scaffoldBg, width: 2),
                    ),
                    child: const Icon(
                      Icons.verified_user,
                      size: 14,
                      color: ProximColors.statusSuccess,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Check your email',
          style: ProximTextStyles.displayLg().copyWith(fontWeight: FontWeight.w700),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Text.rich(
            TextSpan(
              text: 'We sent a 6-digit verification code to ',
              style: ProximTextStyles.bodyMd(),
              children: [
                TextSpan(
                  text: email,
                  style: ProximTextStyles.bodyLg(color: ProximColors.primary)
                      .copyWith(fontWeight: FontWeight.w500),
                ),
              ],
            ),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 20),

        // Zero-setup callout
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: ProximColors.surfaceElevated.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(12),
            boxShadow: const [
              BoxShadow(color: Color(0x59000000), blurRadius: 20, offset: Offset(0, 4)),
            ],
          ),
          child: Column(
            children: [
              Container(
                height: 2,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [ProximColors.primary, ProximColors.secondary, Colors.transparent],
                  ),
                ),
              ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    margin: const EdgeInsets.only(top: 2),
                    decoration: BoxDecoration(
                      color: ProximColors.primary.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.auto_awesome,
                      size: 18,
                      color: ProximColors.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ZERO SETUP REQUIRED',
                          style: ProximTextStyles.labelSm(
                            color: ProximColors.primary,
                          ).copyWith(letterSpacing: 1.2),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'New to Proxim? Verifying this code creates your account '
                          'automatically. No password setup required.',
                          style: ProximTextStyles.bodySm(),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // OTP boxes with hidden input
        _OtpInput(
          controller: _codeController,
          focusNode: _codeFocus,
          onCompleted: (_) => _verifyCode(),
        ),
        const SizedBox(height: 10),
        Text(
          'Tap boxes to trigger keypad or paste a 6-digit token',
          style: ProximTextStyles.labelXs().copyWith(letterSpacing: 0.5),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),

        _GradientCtaButton(
          onPressed: isBusy || code.length != 6 ? null : _verifyCode,
          isBusy: isBusy,
          busyLabel: 'Verifying…',
          gradient: ProximColors.primaryCtaGradient,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_open, size: 20, color: Colors.white),
              const SizedBox(width: 8),
              Text(
                'Verify & Sign In',
                style: ProximTextStyles.bodyLg(color: Colors.white)
                    .copyWith(fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Resend + change email
        Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_resendCountdown > 0)
                  const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: ProximColors.primary,
                    ),
                  ),
                const SizedBox(width: 8),
                Text(
                  _resendCountdown > 0
                      ? 'Resend code in ${_resendCountdown}s'
                      : 'Resend code',
                  style: ProximTextStyles.labelSm(
                    color: _resendCountdown > 0
                        ? ProximColors.onSurfaceVariant
                        : ProximColors.primary,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 4),
        GestureDetector(
          onTap: _resendCountdown > 0 || isBusy
              ? null
              : () async {
                  final sent = await ref
                      .read(authProvider.notifier)
                      .sendEmailCode(email);
                  if (sent && mounted) {
                    setState(() => _resendCountdown = _resendSeconds);
                    _tickResendCountdown();
                  }
                },
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 10,
              runSpacing: 6,
              children: [
                Text("Didn't get a code?", style: ProximTextStyles.bodySm()),
                Container(
                  width: 4,
                  height: 4,
                  decoration: const BoxDecoration(
                    color: ProximColors.surfaceContainerHighest,
                    shape: BoxShape.circle,
                  ),
                ),
                GestureDetector(
                  onTap: isBusy
                      ? null
                      : () => setState(() {
                            _step = _LoginStep.email;
                            _codeController.clear();
                          }),
                  child: Text(
                    'Change email address',
                    style: ProximTextStyles.bodySm(
                      color: ProximColors.primary,
                    ).copyWith(fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Session microcopy
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: ProximColors.surfaceContainerLowest.withValues(alpha: 0.8),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  const Icon(Icons.timer, size: 16, color: ProximColors.tertiary),
                  const SizedBox(width: 8),
                  Text(
                    'Codes expire in 10 minutes',
                    style: ProximTextStyles.labelSm(),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'A 7-day cryptographically secured session token (JWT) will be '
                'minted and stored in your device\'s enclave upon verification.',
                style: ProximTextStyles.bodySm().copyWith(height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.security, size: 14, color: ProximColors.primary),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                'PROTECTED BY PRIVY SESSION VAULT • ZERO-KNOWLEDGE RECOVERY',
                style: ProximTextStyles.labelXs().copyWith(letterSpacing: 1),
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                maxLines: 2,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Design-system building blocks
// ─────────────────────────────────────────────────────────────────────────────

/// Soft ambient aurora glow behind the auth content.
class _AuroraGlow extends StatelessWidget {
  const _AuroraGlow();

  @override
  Widget build(BuildContext context) {
    return const Stack(
      children: [
        Positioned(
          top: -60,
          left: 0,
          right: 0,
          child: Center(
            child: _GlowBlob(
              size: Size(320, 280),
              colors: [Color(0x265DF6EC), Color(0x1AC6C0FF), Color(0x00000000)],
            ),
          ),
        ),
        Positioned(
          top: 240,
          right: -70,
          child: _GlowBlob(
            size: Size(256, 256),
            colors: [Color(0x333D27C0), Color(0x00000000)],
          ),
        ),
      ],
    );
  }
}

class _GlowBlob extends StatelessWidget {
  final Size size;
  final List<Color> colors;
  const _GlowBlob({required this.size, required this.colors});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size.width,
      height: size.height,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(colors: colors),
      ),
    );
  }
}

/// Gradient-stroke Proxim emblem (rounded square + aurora mark).
class _BrandEmblem extends StatelessWidget {
  const _BrandEmblem();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1A5DF6EC),
            blurRadius: 18,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: const Center(
        child: SizedBox(width: 32, height: 32, child: CustomPaint(painter: _EmblemPainter())),
      ),
    );
  }
}

class _EmblemPainter extends CustomPainter {
  const _EmblemPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 40;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3 * scale
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF5DF6EC), Color(0xFF35D9D0), Color(0xFFC6C0FF)],
      ).createShader(Offset.zero & size);

    final path = Path()
      ..moveTo(12 * scale, 28 * scale)
      ..lineTo(28 * scale, 12 * scale)
      ..moveTo(12 * scale, 12 * scale)
      ..cubicTo(18 * scale, 10 * scale, 24 * scale, 16 * scale, 28 * scale, 28 * scale)
      ..moveTo(28 * scale, 28 * scale)
      ..cubicTo(22 * scale, 30 * scale, 16 * scale, 24 * scale, 12 * scale, 12 * scale)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Multi-color Google "G" logo (official four-path mark).
class _GoogleLogo extends StatelessWidget {
  final double size;
  const _GoogleLogo({required this.size});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: const CustomPaint(painter: _GoogleLogoPainter()),
    );
  }
}

class _GoogleLogoPainter extends CustomPainter {
  const _GoogleLogoPainter();

  static const blue = Color(0xFF4285F4);
  static const green = Color(0xFF34A853);
  static const yellow = Color(0xFFFBBC05);
  static const red = Color(0xFFEA4335);

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 24, size.height / 24);

    final bluePath = Path()
      ..moveTo(23.745, 12.27)
      ..cubicTo(23.745, 11.57, 23.685, 10.87, 23.555, 10.2)
      ..lineTo(12, 10.2)
      ..lineTo(12, 14.71)
      ..lineTo(18.6, 14.71)
      ..cubicTo(18.31, 16.23, 17.46, 17.53, 16.2, 18.39)
      ..lineTo(16.2, 21.44)
      ..lineTo(20.08, 21.44)
      ..cubicTo(22.35, 19.35, 23.745, 16.27, 23.745, 12.27)
      ..close();

    final greenPath = Path()
      ..moveTo(12, 24)
      ..cubicTo(15.24, 24, 17.95, 22.92, 19.93, 21.09)
      ..lineTo(16.05, 18.04)
      ..cubicTo(14.97, 18.76, 13.6, 19.2, 12, 19.2)
      ..cubicTo(8.88, 19.2, 6.23, 17.1, 5.28, 14.27)
      ..lineTo(1.25, 14.27)
      ..lineTo(1.25, 17.42)
      ..cubicTo(3.26, 21.36, 7.33, 24, 12, 24)
      ..close();

    final yellowPath = Path()
      ..moveTo(5.28, 14.27)
      ..cubicTo(5.03, 13.55, 4.9, 12.78, 4.9, 12)
      ..cubicTo(4.9, 11.22, 5.03, 10.45, 5.28, 9.73)
      ..lineTo(5.28, 6.58)
      ..lineTo(1.25, 6.58)
      ..cubicTo(0.45, 8.18, 0, 9.98, 0, 12)
      ..cubicTo(0, 14.02, 0.45, 15.82, 1.25, 17.42)
      ..lineTo(5.28, 14.27)
      ..close();

    final redPath = Path()
      ..moveTo(12, 4.75)
      ..cubicTo(13.77, 4.75, 15.35, 5.36, 16.6, 6.55)
      ..lineTo(20.02, 3.13)
      ..cubicTo(17.95, 1.19, 15.24, 0, 12, 0)
      ..cubicTo(7.33, 0, 3.26, 2.64, 1.25, 6.58)
      ..lineTo(5.28, 9.73)
      ..cubicTo(6.23, 6.9, 8.88, 4.75, 12, 4.75)
      ..close();

    final fill = Paint()..style = PaintingStyle.fill;
    canvas.drawPath(bluePath, fill..color = blue);
    canvas.drawPath(greenPath, fill..color = green);
    canvas.drawPath(yellowPath, fill..color = yellow);
    canvas.drawPath(redPath, fill..color = red);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Pill CTA with the aurora gradient fill.
class _GradientCtaButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final Widget child;
  final bool isBusy;
  final String busyLabel;
  final Gradient gradient;

  const _GradientCtaButton({
    required this.onPressed,
    required this.child,
    this.isBusy = false,
    this.busyLabel = 'Working…',
    this.gradient = ProximColors.auroraBarTrack,
  });

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !isBusy;
    return Opacity(
      opacity: enabled ? 1 : 0.6,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          onTap: enabled ? onPressed : null,
          borderRadius: BorderRadius.circular(999),
          child: Ink(
            height: 48,
            decoration: BoxDecoration(
              gradient: gradient,
              borderRadius: BorderRadius.circular(999),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x335DF6EC),
                  blurRadius: 22,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: Center(
              child: isBusy
                  ? Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          busyLabel,
                          style: const TextStyle(
                            color: ProximColors.onPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(width: 8),
                        const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: ProximColors.onPrimary,
                          ),
                        ),
                      ],
                    )
                  : child,
            ),
          ),
        ),
      ),
    );
  }
}

/// Inline error surface.
class _ErrorBanner extends StatelessWidget {
  final String message;
  const _ErrorBanner({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ProximColors.statusDanger.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ProximColors.statusDanger.withValues(alpha: 0.4)),
      ),
      child: Text(
        message,
        style: ProximTextStyles.bodySm(color: ProximColors.error),
      ),
    );
  }
}

/// Six OTP boxes driven by a transparent TextField (keyboard + paste support).
class _OtpInput extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onCompleted;

  const _OtpInput({
    required this.controller,
    required this.focusNode,
    required this.onCompleted,
  });

  @override
  Widget build(BuildContext context) {
    const boxHeight = 64.0;
    const gap = 8.0;

    return LayoutBuilder(
      builder: (context, constraints) {
        final totalWidth = math.min(constraints.maxWidth, 360.0);
        final boxWidth = (totalWidth - gap * 5) / 6;
        final code = controller.text;

        return SizedBox(
          height: boxHeight,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(6, (i) {
                  final isFilled = i < code.length;
                  final isActive = !isFilled && i == code.length;
                  return Padding(
                    padding: EdgeInsets.only(right: i < 5 ? gap : 0),
                    child: _OtpBox(
                      width: boxWidth,
                      height: boxHeight,
                      digit: isFilled ? code[i] : null,
                      active: isActive,
                    ),
                  );
                }),
              ),
              // Invisible capture layer for taps / keyboard / paste
              Positioned.fill(
                child: Center(
                  child: SizedBox(
                    width: totalWidth,
                    height: boxHeight,
                    child: TextField(
                      controller: controller,
                      focusNode: focusNode,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(6),
                      ],
                      style: const TextStyle(color: Colors.transparent),
                      cursorColor: Colors.transparent,
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        filled: false,
                        contentPadding: EdgeInsets.zero,
                      ),
                      onChanged: (value) {
                        if (value.length == 6) onCompleted(value);
                      },
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _OtpBox extends StatelessWidget {
  final double width;
  final double height;
  final String? digit;
  final bool active;

  const _OtpBox({
    required this.width,
    required this.height,
    required this.digit,
    required this.active,
  });

  @override
  Widget build(BuildContext context) {
    final filled = digit != null;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: active
            ? ProximColors.surfaceContainerHighest
            : filled
                ? ProximColors.surfaceContainerHigh
                : ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
        boxShadow: active
            ? const [
                BoxShadow(
                  color: Color(0x595DF6EC),
                  blurRadius: 16,
                ),
              ]
            : null,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            digit ?? '',
            style: ProximTextStyles.displayLg().copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          if (filled)
            Container(
              width: 12,
              height: 2,
              decoration: BoxDecoration(
                color: ProximColors.primary.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(2),
              ),
            )
          else if (active)
            Container(
              width: 2,
              height: 16,
              decoration: BoxDecoration(
                color: ProximColors.primary,
                borderRadius: BorderRadius.circular(2),
                boxShadow: const [
                  BoxShadow(color: Color(0xCC5DF6EC), blurRadius: 8),
                ],
              ),
            )
          else
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: ProximColors.surfaceBright,
                shape: BoxShape.circle,
              ),
            ),
        ],
      ),
    );
  }
}

/// "No Passwords at Proxim" bottom sheet (passwordless recovery explainer).
class _PasswordlessSheet extends StatelessWidget {
  final VoidCallback onSendCode;
  const _PasswordlessSheet({required this.onSendCode});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: ProximColors.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: ProximColors.primary.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.key_off, size: 18, color: ProximColors.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('No Passwords at Proxim', style: ProximTextStyles.headlineSm()),
                      const SizedBox(height: 2),
                      Text(
                        'Proxim is engineered completely passwordless by design.',
                        style: ProximTextStyles.bodySm(),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _sheetRow(
              icon: Icons.lock_reset,
              title: 'Why no passwords?',
              badge: 'ZERO TRUST',
              body: 'Passwords can be intercepted, phished, or forgotten. Proxim '
                  'utilizes institutional cryptographic infrastructure and dynamic '
                  'verification codes dispatched directly to your verified email.',
            ),
            const SizedBox(height: 12),
            _sheetRow(
              icon: Icons.mark_email_read,
              title: 'How account recovery works',
              body: 'There are no fragile password resets. Simply provide your '
                  'verified inbox on any registered device to instantly validate '
                  'via a dynamic 6-digit one-time code.',
            ),
            const SizedBox(height: 12),
            _sheetRow(
              icon: Icons.account_balance_wallet,
              title: 'Automatic Wallet Setup',
              badge: 'INSTANT',
              body: 'First time on Proxim? Verifying your first one-time access '
                  'code automatically compiles and initializes your personal and '
                  'enterprise liquidity vaults.',
            ),
            const SizedBox(height: 24),
            _GradientCtaButton(
              onPressed: onSendCode,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Got it, Send me a Code',
                    style: ProximTextStyles.bodyLg(color: ProximColors.onPrimary)
                        .copyWith(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(width: 8),
                  const Icon(
                    Icons.arrow_forward,
                    size: 20,
                    color: ProximColors.onPrimary,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(
                'Close & Return to Login',
                style: ProximTextStyles.bodyMd(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sheetRow({
    required IconData icon,
    required String title,
    required String body,
    String? badge,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: ProximColors.surfaceContainerHighest,
            child: Icon(icon, size: 16, color: ProximColors.onSurfaceVariant),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        title,
                        style: ProximTextStyles.labelSm(color: Colors.white),
                      ),
                    ),
                    if (badge != null) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: ProximColors.primary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          badge,
                          style: ProximTextStyles.labelXs(color: ProximColors.primary)
                              .copyWith(letterSpacing: 1),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(body, style: ProximTextStyles.bodySm().copyWith(height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
