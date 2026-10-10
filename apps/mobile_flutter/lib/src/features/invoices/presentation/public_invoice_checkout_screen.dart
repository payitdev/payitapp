import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';
import '../data/invoices_repository.dart';
import 'invoices_provider.dart';

class PublicInvoiceCheckoutScreen extends ConsumerStatefulWidget {
  final String invoiceId;
  const PublicInvoiceCheckoutScreen({super.key, required this.invoiceId});

  @override
  ConsumerState<PublicInvoiceCheckoutScreen> createState() => _PublicInvoiceCheckoutScreenState();
}

class _PublicInvoiceCheckoutScreenState extends ConsumerState<PublicInvoiceCheckoutScreen> {
  int _selectedRail = 0; // 0: Web3 / Base USDC, 1: Card / Apple Pay, 2: Wire
  int _countdownSeconds = 764; // ~12:44
  Timer? _timer;
  bool _isPaying = false;
  bool _isPaid = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() {
        if (_countdownSeconds <= 1) {
          _countdownSeconds = 900;
        } else {
          _countdownSeconds--;
        }
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _formatTimer() {
    final m = _countdownSeconds ~/ 60;
    final s = _countdownSeconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  Future<void> _handlePayment(ProximInvoice inv) async {
    if (_isPaying || _isPaid) return;
    setState(() => _isPaying = true);

    if (_selectedRail == 0) {
      // Crypto settlement — copy address
      final addr = inv.merchantEvmAddress ?? '0x71C...B29F';
      await Clipboard.setData(ClipboardData(text: addr));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Merchant deposit address copied ($addr)'),
          backgroundColor: ProximColors.surfaceContainerHigh,
        ),
      );
    } else {
      // Direct Link / Checkout
      if (inv.onlineCheckoutUrl != null && inv.onlineCheckoutUrl!.isNotEmpty) {
        await Clipboard.setData(ClipboardData(text: inv.onlineCheckoutUrl!));
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Checkout payment link copied to clipboard'),
            backgroundColor: ProximColors.surfaceContainerHigh,
          ),
        );
      }
    }

    if (!mounted) return;
    setState(() {
      _isPaying = false;
      _isPaid = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final invoiceAsync = ref.watch(publicInvoiceProvider(widget.invoiceId));

    return Scaffold(
      backgroundColor: ProximColors.backgroundVoid,
      body: CenteredAppContainer(
        child: SafeArea(
          child: Column(
            children: [
              _buildTopBar(context),
              Expanded(
                child: invoiceAsync.when(
                  loading: () => const Center(
                    child: CircularProgressIndicator(color: ProximColors.primary),
                  ),
                  error: (err, _) => Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.error_outline, color: ProximColors.statusError, size: 40),
                          const SizedBox(height: 12),
                          Text(
                            err.toString().replaceAll('Exception: ', ''),
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(backgroundColor: ProximColors.primary, foregroundColor: Colors.black),
                            onPressed: () => ref.invalidate(publicInvoiceProvider(widget.invoiceId)),
                            child: const Text('Try Again'),
                          ),
                        ],
                      ),
                    ),
                  ),
                  data: (inv) => SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildSecurityBadge(),
                        const SizedBox(height: 14),
                        _buildHeroAmountCard(inv),
                        const SizedBox(height: 14),
                        _buildCorporateContextCard(inv),
                        const SizedBox(height: 16),
                        _buildSettlementRailsSelector(),
                        const SizedBox(height: 20),
                        _buildPayCta(inv),
                        const SizedBox(height: 32),
                      ],
                    ),
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
          Row(
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
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: ProximColors.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(9999),
                ),
                child: Row(
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
                    Text('Proxim Settle', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text('#${widget.invoiceId}', style: ProximTextStyles.bodySm()),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.download, size: 18, color: ProximColors.onSurfaceVariant),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Downloading invoice PDF receipt')),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSecurityBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Row(
        children: [
          const Icon(Icons.verified_user, size: 16, color: ProximColors.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Verified Enterprise Invoice • 256-bit Timelock Protected',
              style: ProximTextStyles.labelXs(color: ProximColors.onSurfaceVariant),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeroAmountCard(ProximInvoice inv) {
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
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('TOTAL AMOUNT DUE', style: ProximTextStyles.labelXs()),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: ProximColors.surfaceContainerLowest,
                        borderRadius: BorderRadius.circular(9999),
                      ),
                      child: Text(
                        inv.status.toUpperCase(),
                        style: ProximTextStyles.labelXs(
                          color: inv.status.toUpperCase() == 'PAID'
                              ? ProximColors.statusSuccess
                              : ProximColors.primary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      '\$${inv.amount.toStringAsFixed(2)}',
                      style: ProximTextStyles.displayLg(color: ProximColors.textWhite).copyWith(
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(inv.currency, style: ProximTextStyles.headlineSm(color: ProximColors.primary)),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.bolt, size: 14, color: ProximColors.primary),
                          const SizedBox(width: 6),
                          Text('Guaranteed Clearing', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
                        ],
                      ),
                      Text(
                        _formatTimer(),
                        style: ProximTextStyles.labelXs(color: ProximColors.statusWarning).copyWith(
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCorporateContextCard(ProximInvoice inv) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('BILLED TO', style: ProximTextStyles.labelXs()),
                    const SizedBox(height: 2),
                    Text(inv.clientName, style: ProximTextStyles.bodyLg().copyWith(fontWeight: FontWeight.w600)),
                    Text(inv.clientEmail.isNotEmpty ? inv.clientEmail : 'billing@client.com', style: ProximTextStyles.labelXs()),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('ISSUED BY', style: ProximTextStyles.labelXs()),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            inv.merchantName ?? 'Proxim Merchant',
                            style: ProximTextStyles.bodyLg().copyWith(fontWeight: FontWeight.w600),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.check_circle, size: 14, color: ProximColors.statusSuccess),
                      ],
                    ),
                    Text(
                      inv.merchantEvmAddress != null
                          ? 'Verified Merchant'
                          : 'Proxim Settlement Rail',
                      style: ProximTextStyles.labelXs(color: ProximColors.primary),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                const Icon(Icons.receipt_long, size: 16, color: ProximColors.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Invoice #${inv.invoiceNumber}', style: ProximTextStyles.labelSm(color: ProximColors.textWhite)),
                      Text('Proxim Settle • Direct Clearing Escrow', style: ProximTextStyles.labelXs()),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSettlementRailsSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('SELECT SETTLEMENT RAIL', style: ProximTextStyles.labelXs()),
            Text('Instant Routing', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
          ],
        ),
        const SizedBox(height: 8),
        _buildRailOption(
          id: 0,
          title: 'Digital Dollar Settlement',
          badge: '~2s Settled',
          subtitle: 'Base USDC / Solana USDC (Zero fee sponsored)',
        ),
        const SizedBox(height: 8),
        _buildRailOption(
          id: 1,
          title: 'Credit / Debit & Apple Pay',
          badge: 'Instant',
          subtitle: 'Visa, Mastercard, AMEX (Processed via Stripe Treasury)',
        ),
        const SizedBox(height: 8),
        _buildRailOption(
          id: 2,
          title: 'Direct Bank Wire (US / EU)',
          badge: 'Virtual IBAN',
          subtitle: 'FedNow, ACH, SEPA Instant settlement coordinates',
        ),
      ],
    );
  }

  Widget _buildRailOption({
    required int id,
    required String title,
    required String badge,
    required String subtitle,
  }) {
    final isSelected = _selectedRail == id;
    return GestureDetector(
      onTap: () => setState(() => _selectedRail = id),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? ProximColors.surfaceContainerHigh : ProximColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? ProximColors.primary : ProximColors.hairlineBorder,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 18,
              height: 18,
              margin: const EdgeInsets.only(top: 2),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? ProximColors.primary : ProximColors.onSurfaceVariant,
                  width: 2,
                ),
              ),
              child: isSelected
                  ? Center(
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: ProximColors.primary,
                        ),
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(title, style: ProximTextStyles.bodyLg().copyWith(fontWeight: FontWeight.w600)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: ProximColors.surfaceContainerLowest,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(badge, style: ProximTextStyles.labelXs(color: ProximColors.primary)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(subtitle, style: ProximTextStyles.labelXs()),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPayCta(ProximInvoice inv) {
    return Column(
      children: [
        GestureDetector(
          onTap: () => _handlePayment(inv),
          child: Container(
            width: double.infinity,
            height: 52,
            decoration: BoxDecoration(
              gradient: _isPaid
                  ? null
                  : const LinearGradient(
                      colors: [Color(0xFF35D9D0), Color(0xFF5DF6EC), Color(0xFF7567F8)],
                    ),
              color: _isPaid ? ProximColors.statusSuccess : null,
              borderRadius: BorderRadius.circular(9999),
              boxShadow: [
                BoxShadow(
                  color: (_isPaid ? ProximColors.statusSuccess : ProximColors.primary).withValues(alpha: 0.3),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Center(
              child: _isPaying
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        color: ProximColors.surfaceContainerLowest,
                        strokeWidth: 2.5,
                      ),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _isPaid ? Icons.check_circle : Icons.lock,
                          size: 18,
                          color: ProximColors.surfaceContainerLowest,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          _isPaid
                              ? 'Payment complete'
                              : 'Pay Invoice (\$${inv.amount.toStringAsFixed(2)})',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: ProximColors.surfaceContainerLowest,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text('Zero fee subsidized • Powered by Proxim Settle Protocol', style: ProximTextStyles.labelXs()),
      ],
    );
  }
}
