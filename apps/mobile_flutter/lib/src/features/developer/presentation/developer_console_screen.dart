import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';
import 'developer_provider.dart';

class DeveloperConsoleScreen extends ConsumerStatefulWidget {
  const DeveloperConsoleScreen({super.key});

  @override
  ConsumerState<DeveloperConsoleScreen> createState() => _DeveloperConsoleScreenState();
}

class _DeveloperConsoleScreenState extends ConsumerState<DeveloperConsoleScreen> {
  bool _isProd = true;
  bool _showKey = false;
  String _prodKey = 'prox_live_98a7f471e9803bf2a819c81e';
  String _testKey = 'prox_test_41b8a92026fed091ba5501ef';

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copied to clipboard'),
        backgroundColor: ProximColors.surfaceContainerHigh,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final activeKey = _isProd ? _prodKey : _testKey;
    final displayKey = _showKey ? activeKey : '${activeKey.substring(0, 14)}••••••••••••${activeKey.substring(activeKey.length - 4)}';

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
                      _buildEnvironmentSwitcher(),
                      const SizedBox(height: 14),
                      _buildApiKeysCard(displayKey, activeKey),
                      const SizedBox(height: 16),
                      _buildWebhooksSection(),
                      const SizedBox(height: 16),
                      _buildEventLogSection(),
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
          Text('Developer & API Hub', style: ProximTextStyles.headlineSm()),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(9999),
            ),
            child: Row(
              children: [
                Text('Docs', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
                const SizedBox(width: 2),
                const Icon(Icons.north_east, size: 12, color: ProximColors.primary),
              ],
            ),
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
              'BAAS PROGRAMMATIC TREASURY',
              style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text('API Integration', style: ProximTextStyles.headlineLg()),
      ],
    );
  }

  Widget _buildEnvironmentSwitcher() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(9999),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _isProd = true),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: _isProd ? ProximColors.surfaceContainerHigh : Colors.transparent,
                  borderRadius: BorderRadius.circular(9999),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(shape: BoxShape.circle, color: ProximColors.statusSuccess),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Production (Live)',
                      style: ProximTextStyles.labelSm(
                        color: _isProd ? ProximColors.primary : ProximColors.onSurfaceVariant,
                      ).copyWith(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _isProd = false),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: !_isProd ? ProximColors.surfaceContainerHigh : Colors.transparent,
                  borderRadius: BorderRadius.circular(9999),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(shape: BoxShape.circle, color: ProximColors.secondary),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Sandbox (Testnet)',
                      style: ProximTextStyles.labelSm(
                        color: !_isProd ? ProximColors.primary : ProximColors.onSurfaceVariant,
                      ).copyWith(fontWeight: FontWeight.bold),
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

  Widget _buildApiKeysCard(String displayKey, String activeKey) {
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
                  const Icon(Icons.key, size: 18, color: ProximColors.primary),
                  const SizedBox(width: 6),
                  Text('API Keys & Secrets', style: ProximTextStyles.headlineSm()),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: ProximColors.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(9999),
                ),
                child: Text('Active • 2 Keys', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Key Container
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Primary Treasury API Key', style: ProximTextStyles.labelSm(color: ProximColors.textWhite)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: ProximColors.secondary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text('Full Payouts', style: ProximTextStyles.labelXs(color: ProximColors.secondary)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainerHigh,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          displayKey,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 11,
                            color: ProximColors.primary,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      IconButton(
                        icon: Icon(_showKey ? Icons.visibility_off : Icons.visibility, size: 16, color: ProximColors.onSurfaceVariant),
                        onPressed: () => setState(() => _showKey = !_showKey),
                        constraints: const BoxConstraints(),
                        padding: EdgeInsets.zero,
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        icon: const Icon(Icons.copy, size: 16, color: ProximColors.primary),
                        onPressed: () => _copyToClipboard(activeKey, 'API Key'),
                        constraints: const BoxConstraints(),
                        padding: EdgeInsets.zero,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.bolt, size: 12, color: ProximColors.statusSuccess),
                        const SizedBox(width: 4),
                        Text('Used 2m ago from IP 192.168.1.1', style: ProximTextStyles.labelXs()),
                      ],
                    ),
                    Text('Created Jan 12', style: ProximTextStyles.labelXs()),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () async {
              final env = _isProd ? 'production' : 'sandbox';
              final key = await ref.read(developerRepositoryProvider).rollKey('ent_demo_business_01', env);
              setState(() {
                if (_isProd) {
                  _prodKey = key.keyPrefix;
                } else {
                  _testKey = key.keyPrefix;
                }
              });
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('New ${key.name} (${key.keyPrefix}) generated & rotated')),
              );
            },
            child: Container(
              width: double.infinity,
              height: 42,
              decoration: BoxDecoration(
                color: ProximColors.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.autorenew, size: 16, color: ProximColors.primary),
                  const SizedBox(width: 6),
                  Text('Roll / Generate New Secret', style: ProximTextStyles.labelSm(color: ProximColors.textWhite)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWebhooksSection() {
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
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Settlement Webhooks', style: ProximTextStyles.headlineSm()),
                  Text('Real-time asynchronous dispatch nodes', style: ProximTextStyles.labelXs()),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: ProximColors.statusSuccess.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(9999),
                ),
                child: Text('99.98% Delivery', style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildEndpointItem('https://api.acme.com/webhooks/proxim', ['payment.settled', 'payout.completed', 'fx.locked']),
        ],
      ),
    );
  }

  Widget _buildEndpointItem(String url, List<String> events) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(shape: BoxShape.circle, color: ProximColors.statusSuccess),
              ),
              const SizedBox(width: 6),
              Text('200 OK • Latency 142ms', style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess)),
            ],
          ),
          const SizedBox(height: 4),
          Text(url, style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: ProximColors.textWhite)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: events.map((ev) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: ProximColors.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(ev, style: ProximTextStyles.labelXs(color: ProximColors.primary)),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildEventLogSection() {
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
          Text('Sandbox Simulation & Logs', style: ProximTextStyles.headlineSm()),
          const SizedBox(height: 8),
          _buildLogRow('POST /v1/payouts/create', '200 OK', '14:28:01'),
          const SizedBox(height: 6),
          _buildLogRow('POST /v1/rates/quote', '200 OK', '14:26:44'),
          const SizedBox(height: 6),
          _buildLogRow('GET /v1/treasury/balance', '200 OK', '14:20:12'),
        ],
      ),
    );
  }

  Widget _buildLogRow(String endpoint, String status, String time) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(endpoint, style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: ProximColors.onSurface)),
          Row(
            children: [
              Text(status, style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess)),
              const SizedBox(width: 8),
              Text(time, style: ProximTextStyles.labelXs()),
            ],
          ),
        ],
      ),
    );
  }
}
