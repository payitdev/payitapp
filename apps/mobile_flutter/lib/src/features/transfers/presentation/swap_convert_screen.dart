import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';

class SwapConvertScreen extends StatefulWidget {
  const SwapConvertScreen({super.key});

  @override
  State<SwapConvertScreen> createState() => _SwapConvertScreenState();
}

class _SwapConvertScreenState extends State<SwapConvertScreen> {
  final TextEditingController _payController = TextEditingController(text: '2,500.00');
  static const double _rate = 1595.20;
  bool _isUsdToNgn = true;
  int _secondsLeft = 285;
  Timer? _timer;
  bool _isExecuting = false;
  bool _isSuccess = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() {
        if (_secondsLeft <= 1) {
          _secondsLeft = 300;
        } else {
          _secondsLeft--;
        }
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _payController.dispose();
    super.dispose();
  }

  String _formatTimer() {
    final m = _secondsLeft ~/ 60;
    final s = _secondsLeft % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  double get _payAmount {
    final clean = _payController.text.replaceAll(',', '').trim();
    return double.tryParse(clean) ?? 0.0;
  }

  String get _calculatedReceive {
    final pay = _payAmount;
    final numberFormat = NumberFormat('#,##0.00', 'en_US');
    if (_isUsdToNgn) {
      return numberFormat.format(pay * _rate);
    } else {
      return numberFormat.format(pay / _rate);
    }
  }

  void _flipCurrencies() {
    setState(() {
      _isUsdToNgn = !_isUsdToNgn;
    });
  }

  Future<void> _handleExecute() async {
    if (_isExecuting || _isSuccess) return;
    setState(() => _isExecuting = true);
    await Future.delayed(const Duration(milliseconds: 1500));
    if (!mounted) return;
    setState(() {
      _isExecuting = false;
      _isSuccess = true;
    });
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
                      const SizedBox(height: 16),
                      _buildSwapModule(),
                      const SizedBox(height: 16),
                      _buildFxRateCapsule(),
                      const SizedBox(height: 16),
                      _buildRouteVisualization(),
                      const SizedBox(height: 16),
                      _buildExecutionLedger(),
                      const SizedBox(height: 20),
                      _buildExecuteCta(),
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
              'Convert & Swap',
              style: ProximTextStyles.headlineSm(),
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.history, size: 20, color: ProximColors.onSurfaceVariant),
            onPressed: () => context.push('/activity'),
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
              'INSTANT LIQUIDITY',
              style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text('FX Quote & Swap', style: ProximTextStyles.headlineLg()),
      ],
    );
  }

  Widget _buildSwapModule() {
    return Stack(
      alignment: Alignment.center,
      children: [
        Column(
          children: [
            // "You Pay" Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: ProximColors.surfaceContainerLow,
                borderRadius: BorderRadius.circular(16),
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
                            Text('YOU PAY', style: ProximTextStyles.labelXs()),
                            const SizedBox(width: 6),
                            Text('•', style: ProximTextStyles.labelXs()),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                _isUsdToNgn ? 'Bal: \$24,100.00' : 'Bal: ₦38,420,000',
                                style: ProximTextStyles.bodySm(),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 6),
                      GestureDetector(
                        onTap: () {
                          setState(() {
                            _payController.text = _isUsdToNgn ? '24,100.00' : '38,420,000.00';
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: ProximColors.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(9999),
                          ),
                          child: Text(
                            'MAX',
                            style: ProximTextStyles.labelXs(color: ProximColors.primary),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              _isUsdToNgn ? '\$' : '₦',
                              style: ProximTextStyles.headlineLg(color: ProximColors.onSurfaceVariant),
                            ),
                            const SizedBox(width: 4),
                            Expanded(
                              child: TextField(
                                controller: _payController,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                onChanged: (_) => setState(() {}),
                                style: ProximTextStyles.headlineLg().copyWith(
                                  fontFeatures: const [FontFeature.tabularFigures()],
                                ),
                                decoration: const InputDecoration(
                                  border: InputBorder.none,
                                  isDense: true,
                                  contentPadding: EdgeInsets.zero,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      _buildAssetPill(
                        symbol: _isUsdToNgn ? 'USDC' : 'NGN',
                        network: _isUsdToNgn ? 'Base Rail' : 'Naira Rail',
                        icon: _isUsdToNgn ? Icons.token : Icons.payments_outlined,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // "You Receive" Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: ProximColors.surfaceContainer,
                borderRadius: BorderRadius.circular(16),
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
                            Text('YOU RECEIVE', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
                            const SizedBox(width: 6),
                            Text('•', style: ProximTextStyles.labelXs()),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.bolt, size: 13, color: ProximColors.statusSuccess),
                                  const SizedBox(width: 2),
                                  Flexible(
                                    child: Text(
                                      '~2s settlement',
                                      style: ProximTextStyles.bodySm(),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: ProximColors.surfaceContainerLowest,
                          borderRadius: BorderRadius.circular(9999),
                        ),
                        child: Text(
                          'OTC Liquidity',
                          style: ProximTextStyles.labelXs(color: ProximColors.primary),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Text(
                                _isUsdToNgn ? '₦' : '\$',
                                style: ProximTextStyles.headlineLg(color: ProximColors.primary),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                _calculatedReceive,
                                style: ProximTextStyles.headlineLg(color: ProximColors.primary).copyWith(
                                  fontFeatures: const [FontFeature.tabularFigures()],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      _buildAssetPill(
                        symbol: _isUsdToNgn ? 'NGN' : 'USDC',
                        network: _isUsdToNgn ? 'Naira Rail' : 'Base Rail',
                        icon: _isUsdToNgn ? Icons.payments_outlined : Icons.token,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),

        // Floating Flip Button
        GestureDetector(
          onTap: _flipCurrencies,
          child: Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerHighest,
              shape: BoxShape.circle,
              border: Border.all(color: ProximColors.primary.withValues(alpha: 0.4), width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: ProximColors.primary.withValues(alpha: 0.25),
                  blurRadius: 16,
                ),
              ],
            ),
            child: const Icon(Icons.swap_vert, color: ProximColors.primary, size: 22),
          ),
        ),
      ],
    );
  }

  Widget _buildAssetPill({
    required String symbol,
    required String network,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(9999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: ProximColors.primary.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 14, color: ProximColors.primary),
          ),
          const SizedBox(width: 6),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                symbol,
                style: ProximTextStyles.labelSm(color: ProximColors.textWhite).copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(network, style: ProximTextStyles.labelXs()),
            ],
          ),
          const SizedBox(width: 4),
          const Icon(Icons.expand_more, size: 16, color: ProximColors.onSurfaceVariant),
        ],
      ),
    );
  }

  Widget _buildFxRateCapsule() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: Row(
              children: [
                const Icon(Icons.lock_outline, size: 16, color: ProximColors.primary),
                const SizedBox(width: 8),
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '1 USD = 1,595.20 NGN',
                        overflow: TextOverflow.ellipsis,
                        style: ProximTextStyles.bodySm(color: ProximColors.textWhite).copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        'Zero slippage • Direct OTC treasury rail',
                        overflow: TextOverflow.ellipsis,
                        style: ProximTextStyles.labelXs(),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.timer_outlined, size: 12, color: ProximColors.primary),
                const SizedBox(width: 4),
                Text(
                  _formatTimer(),
                  style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                    fontFeatures: const [FontFeature.tabularFigures()],
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRouteVisualization() {
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
              Text('ALGORITHMIC ROUTE', style: ProximTextStyles.labelXs()),
              Row(
                children: [
                  const Icon(Icons.verified, size: 13, color: ProximColors.statusSuccess),
                  const SizedBox(width: 3),
                  Text('Optimal Path', style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildStepCircle('USDC', 'Base'),
              const Expanded(child: Divider(color: ProximColors.primary, thickness: 1.5)),
              _buildStepCircle('OTC', 'Institutional'),
              const Expanded(child: Divider(color: ProximColors.statusSuccess, thickness: 1.5)),
              _buildStepCircle('NGN', 'Pocket', isSuccess: true),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStepCircle(String title, String subtitle, {bool isSuccess = false}) {
    return Column(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: ProximColors.surfaceContainerHighest,
            shape: BoxShape.circle,
            border: Border.all(
              color: isSuccess ? ProximColors.statusSuccess : ProximColors.primary,
            ),
          ),
          child: Center(
            child: Text(
              title,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: isSuccess ? ProximColors.statusSuccess : ProximColors.primary,
              ),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(subtitle, style: ProximTextStyles.labelXs()),
      ],
    );
  }

  Widget _buildExecutionLedger() {
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
              Flexible(
                child: Text(
                  'Execution Ledger',
                  style: ProximTextStyles.headlineSm(),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: ProximColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text('Batch #9042-TX', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildLedgerRow('Network Liquidity Rail', 'Proxim Deep OTC Bridge'),
          const SizedBox(height: 8),
          _buildLedgerRow('Platform Protocol Fee', '\$0.00 (Zero Fee Promo)', isHighlight: true),
          const SizedBox(height: 8),
          _buildLedgerRow('Slippage Tolerance', '0.0% (Guaranteed Lock)'),
          const SizedBox(height: 8),
          _buildLedgerRow('Destination Vault', 'Proxim NGN Cash Pocket'),
        ],
      ),
    );
  }

  Widget _buildLedgerRow(String label, String value, {bool isHighlight = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Flexible(
          child: Text(
            label,
            style: ProximTextStyles.bodySm(),
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            value,
            overflow: TextOverflow.ellipsis,
            style: ProximTextStyles.bodySm(
              color: isHighlight ? ProximColors.statusSuccess : ProximColors.textWhite,
            ).copyWith(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }

  Widget _buildExecuteCta() {
    return Column(
      children: [
        GestureDetector(
          onTap: _handleExecute,
          child: Container(
            width: double.infinity,
            height: 52,
            decoration: BoxDecoration(
              gradient: _isSuccess
                  ? null
                  : const LinearGradient(
                      colors: [Color(0xFF35D9D0), Color(0xFF5DF6EC), Color(0xFF7567F8)],
                    ),
              color: _isSuccess ? ProximColors.statusSuccess : null,
              borderRadius: BorderRadius.circular(9999),
              boxShadow: [
                BoxShadow(
                  color: (_isSuccess ? ProximColors.statusSuccess : ProximColors.primary).withValues(alpha: 0.3),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Center(
              child: _isExecuting
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        color: ProximColors.surfaceContainerLowest,
                        strokeWidth: 2.5,
                      ),
                    )
                  : Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              _isSuccess ? 'Order Executed Successfully' : 'Confirm & Execute Swap',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: ProximColors.surfaceContainerLowest,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Icon(
                              _isSuccess ? Icons.check_circle : Icons.bolt,
                              size: 18,
                              color: ProximColors.surfaceContainerLowest,
                            ),
                          ],
                        ),
                      ),
                    ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.verified_user_outlined, size: 14, color: ProximColors.onSurfaceVariant),
                const SizedBox(width: 4),
                Text('Protected by multi-party timelock & treasury consensus', style: ProximTextStyles.labelXs()),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
