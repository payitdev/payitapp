import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';

class ReceiveDepositScreen extends StatefulWidget {
  const ReceiveDepositScreen({super.key});

  @override
  State<ReceiveDepositScreen> createState() => _ReceiveDepositScreenState();
}

class _ReceiveDepositScreenState extends State<ReceiveDepositScreen> {
  int _selectedTab = 0; // 0: Crypto, 1: Bank (NGN), 2: MoMo
  int _selectedChain = 0; // 0: Base, 1: Solana, 2: Ethereum, 3: Arbitrum, 4: Polygon

  static const _chains = ['Base', 'Solana', 'Ethereum', 'Arbitrum', 'Polygon'];
  static const _cryptoAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f2b6';
  static const _bankAccountNum = '0123984571';

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copied to clipboard'),
        duration: const Duration(seconds: 2),
        backgroundColor: ProximColors.surfaceContainerHigh,
      ),
    );
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
                      _buildFundingTabs(),
                      const SizedBox(height: 14),
                      if (_selectedTab == 0) ...[
                        _buildChainSelector(),
                        const SizedBox(height: 14),
                        _buildQrVaultCard(),
                      ] else if (_selectedTab == 1) ...[
                        _buildVirtualBankCard(),
                      ] else ...[
                        _buildMoMoCard(),
                      ],
                      const SizedBox(height: 16),
                      if (_selectedTab != 1) _buildVirtualBankCard(),
                      const SizedBox(height: 16),
                      _buildMoMoSection(),
                      const SizedBox(height: 20),
                      _buildActionButtons(),
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
          Text('Receive & Deposit', style: ProximTextStyles.headlineSm()),
          IconButton(
            icon: const Icon(Icons.help_outline, size: 20, color: ProximColors.onSurfaceVariant),
            onPressed: () {},
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
                color: ProximColors.statusSuccess,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              'INBOUND LIQUIDITY',
              style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text('Add Money to Vault', style: ProximTextStyles.headlineLg()),
      ],
    );
  }

  Widget _buildFundingTabs() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(9999),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Row(
        children: [
          _buildTabItem(0, 'Crypto'),
          _buildTabItem(1, 'Bank (NGN)'),
          _buildTabItem(2, 'MoMo'),
        ],
      ),
    );
  }

  Widget _buildTabItem(int index, String label) {
    final isSelected = _selectedTab == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedTab = index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? ProximColors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(9999),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: ProximColors.primary.withValues(alpha: 0.3),
                      blurRadius: 10,
                    ),
                  ]
                : null,
          ),
          child: Center(
            child: Text(
              label,
              style: ProximTextStyles.labelSm(
                color: isSelected ? ProximColors.surfaceContainerLowest : ProximColors.onSurfaceVariant,
              ).copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildChainSelector() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(_chains.length, (index) {
          final isSelected = _selectedChain == index;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => setState(() => _selectedChain = index),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: isSelected ? ProximColors.surfaceContainerHigh : ProximColors.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(9999),
                  border: Border.all(
                    color: isSelected ? ProximColors.primary : ProximColors.hairlineBorder,
                  ),
                ),
                child: Row(
                  children: [
                    if (isSelected) ...[
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: ProximColors.primary,
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],
                    Text(
                      _chains[index],
                      style: ProximTextStyles.labelSm(
                        color: isSelected ? ProximColors.primary : ProximColors.onSurfaceVariant,
                      ).copyWith(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildQrVaultCard() {
    return Container(
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Column(
        children: [
          Container(
            height: 3,
            decoration: const BoxDecoration(
              gradient: ProximColors.auroraBarTrack,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                // Asset Info
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: ProximColors.primary.withValues(alpha: 0.15),
                          ),
                          child: const Icon(Icons.token, size: 20, color: ProximColors.primary),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text('USD Coin', style: ProximTextStyles.headlineSm()),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: ProximColors.surfaceContainerHighest,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text('USDC', style: ProximTextStyles.labelXs()),
                                ),
                              ],
                            ),
                            Text(
                              '${_chains[_selectedChain]} Mainnet Protocol',
                              style: ProximTextStyles.bodySm(),
                            ),
                          ],
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: ProximColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(9999),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.bolt, size: 12, color: ProximColors.primary),
                          const SizedBox(width: 2),
                          Text(
                            'Zero Gas Fee',
                            style: ProximTextStyles.labelXs(color: ProximColors.primary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Stylized Optical QR Representation
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: ProximColors.hairlineBorder),
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Reticle corners
                      Positioned(
                        top: 0,
                        left: 0,
                        child: Container(
                          width: 12,
                          height: 12,
                          decoration: const BoxDecoration(
                            border: Border(
                              top: BorderSide(color: ProximColors.primary, width: 2),
                              left: BorderSide(color: ProximColors.primary, width: 2),
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        top: 0,
                        right: 0,
                        child: Container(
                          width: 12,
                          height: 12,
                          decoration: const BoxDecoration(
                            border: Border(
                              top: BorderSide(color: ProximColors.primary, width: 2),
                              right: BorderSide(color: ProximColors.primary, width: 2),
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        bottom: 0,
                        left: 0,
                        child: Container(
                          width: 12,
                          height: 12,
                          decoration: const BoxDecoration(
                            border: Border(
                              bottom: BorderSide(color: ProximColors.primary, width: 2),
                              left: BorderSide(color: ProximColors.primary, width: 2),
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        bottom: 0,
                        right: 0,
                        child: Container(
                          width: 12,
                          height: 12,
                          decoration: const BoxDecoration(
                            border: Border(
                              bottom: BorderSide(color: ProximColors.primary, width: 2),
                              right: BorderSide(color: ProximColors.primary, width: 2),
                            ),
                          ),
                        ),
                      ),

                      // QR Matrix Graphic
                      Container(
                        width: 150,
                        height: 150,
                        decoration: BoxDecoration(
                          color: ProximColors.surfaceContainer,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: ProximColors.auroraGradient,
                                  boxShadow: [
                                    BoxShadow(
                                      color: ProximColors.primary.withValues(alpha: 0.4),
                                      blurRadius: 14,
                                    ),
                                  ],
                                ),
                                child: const Icon(Icons.qr_code_2, size: 28, color: Colors.white),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Proxim Optical QR',
                                style: ProximTextStyles.labelXs(color: ProximColors.onSurfaceVariant),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Address Box
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('${_chains[_selectedChain]} USDC Address', style: ProximTextStyles.labelXs()),
                        Row(
                          children: [
                            Container(
                              width: 5,
                              height: 5,
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                color: ProximColors.statusSuccess,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Verified Contract',
                              style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: ProximColors.surfaceContainerLowest,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.account_balance_wallet_outlined, size: 18, color: ProximColors.primary),
                          const SizedBox(width: 8),
                          const Expanded(
                            child: Text(
                              _cryptoAddress,
                              style: TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 12,
                                color: ProximColors.onSurface,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: () => _copyToClipboard(_cryptoAddress, 'Address'),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: ProximColors.surfaceContainerHigh,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.copy, size: 12, color: ProximColors.primary),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Copy',
                                    style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                                      fontWeight: FontWeight.w700,
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
                const SizedBox(height: 12),

                // Network notice
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, size: 16, color: ProximColors.statusWarning),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Send only USDC on the ${_chains[_selectedChain]} network. Deposits settle in ~2 seconds.',
                          style: ProximTextStyles.labelXs(),
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

  Widget _buildVirtualBankCard() {
    return Container(
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
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: ProximColors.surfaceContainerHigh,
                    ),
                    child: const Icon(Icons.account_balance, size: 18, color: ProximColors.onSurface),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Virtual Bank Account', style: ProximTextStyles.headlineSm()),
                      Text('NGN Direct On-Ramp', style: ProximTextStyles.bodySm()),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: ProximColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(9999),
                ),
                child: Text('Instant NIBSS', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Bank Name
          _buildDetailRow('BANK NAME', 'Wema Bank / First Bank PLC'),
          const SizedBox(height: 8),

          // Account Number
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('ACCOUNT NUMBER', style: ProximTextStyles.labelXs()),
                    const SizedBox(height: 2),
                    Text(
                      _bankAccountNum,
                      style: ProximTextStyles.headlineSm(color: ProximColors.primary).copyWith(
                        letterSpacing: 1.2,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.copy, size: 18, color: ProximColors.onSurfaceVariant),
                  onPressed: () => _copyToClipboard(_bankAccountNum, 'Account number'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Beneficiary Name
          _buildDetailRow('BENEFICIARY NAME', 'Proxim / Alex Rivera', statusBadge: 'Active'),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {String? statusBadge}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: ProximTextStyles.labelXs()),
              const SizedBox(height: 2),
              Text(
                value,
                style: ProximTextStyles.bodySm(color: ProximColors.textWhite).copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          if (statusBadge != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: ProximColors.statusSuccess.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                statusBadge,
                style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMoMoSection() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: ProximColors.surfaceContainerHighest,
                ),
                child: const Icon(Icons.contactless_outlined, size: 20, color: ProximColors.onSurface),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Mobile Money & QR Cash', style: ProximTextStyles.headlineSm()),
                  Text('M-Pesa, MTN MoMo, Orange Money', style: ProximTextStyles.bodySm()),
                ],
              ),
            ],
          ),
          const Icon(Icons.chevron_right, size: 20, color: ProximColors.onSurfaceVariant),
        ],
      ),
    );
  }

  Widget _buildMoMoCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Rapid Mobile Money Settlement', style: ProximTextStyles.headlineSm()),
          const SizedBox(height: 6),
          Text(
            'Supported corridors: Kenya (M-Pesa), Ghana (MTN MoMo), Nigeria (Paga, PalmPay).',
            style: ProximTextStyles.bodySm(),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons() {
    return Column(
      children: [
        GestureDetector(
          onTap: () => _copyToClipboard('proxim.app/pay/alex-rivera', 'Payment link'),
          child: Container(
            width: double.infinity,
            height: 50,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF35D9D0), Color(0xFF5DF6EC), Color(0xFF7567F8)],
              ),
              borderRadius: BorderRadius.circular(9999),
              boxShadow: [
                BoxShadow(
                  color: ProximColors.primary.withValues(alpha: 0.3),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.share, size: 18, color: ProximColors.surfaceContainerLowest),
                const SizedBox(width: 8),
                Text(
                  'Share Deposit Details',
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
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: GestureDetector(
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('QR Code saved to photos')),
                  );
                },
                child: Container(
                  height: 42,
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(9999),
                    border: Border.all(color: ProximColors.hairlineBorder),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.download, size: 16, color: ProximColors.onSurface),
                      const SizedBox(width: 6),
                      Text('Save QR Code', style: ProximTextStyles.labelSm(color: ProximColors.textWhite)),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: GestureDetector(
                onTap: () => context.push('/payment-hub'),
                child: Container(
                  height: 42,
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(9999),
                    border: Border.all(color: ProximColors.hairlineBorder),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.request_quote_outlined, size: 16, color: ProximColors.onSurface),
                      const SizedBox(width: 6),
                      Text('Request P2P', style: ProximTextStyles.labelSm(color: ProximColors.textWhite)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
