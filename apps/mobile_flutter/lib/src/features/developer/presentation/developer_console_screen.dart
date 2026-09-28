import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';
import '../../auth/presentation/auth_provider.dart';
import '../data/developer_repository.dart';
import 'developer_provider.dart';

class DeveloperConsoleScreen extends ConsumerStatefulWidget {
  const DeveloperConsoleScreen({super.key});

  @override
  ConsumerState<DeveloperConsoleScreen> createState() => _DeveloperConsoleScreenState();
}

class _DeveloperConsoleScreenState extends ConsumerState<DeveloperConsoleScreen> {
  bool _isProd = true;

  /// Backend stores environments as 'live' | 'test'.
  String get _environment => _isProd ? 'live' : 'test';

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
    final entityId = ref.watch(activeEntityProvider)?.id;

    final keysAsync = entityId == null ? null : ref.watch(apiKeysProvider(entityId));
    final webhooksAsync = entityId == null ? null : ref.watch(webhooksProvider(entityId));
    final deliveriesAsync = entityId == null ? null : ref.watch(webhookDeliveriesProvider(entityId));
    final logsAsync = entityId == null ? null : ref.watch(apiLogsProvider(entityId));

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
                      _buildApiKeysCard(entityId, keysAsync),
                      const SizedBox(height: 16),
                      _buildWebhooksSection(entityId, webhooksAsync, deliveriesAsync),
                      const SizedBox(height: 16),
                      _buildEventLogSection(entityId, logsAsync),
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

  Widget _buildApiKeysCard(String? entityId, AsyncValue<List<ApiKeyItem>>? keysAsync) {
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
              if (keysAsync != null)
                keysAsync.maybeWhen(
                  data: (keys) {
                    final count = keys.where((k) => k.environment == _environment).length;
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: ProximColors.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(9999),
                      ),
                      child: Text(
                        '$count Key${count == 1 ? '' : 's'}',
                        style: ProximTextStyles.labelXs(color: ProximColors.primary),
                      ),
                    );
                  },
                  orElse: () => const SizedBox.shrink(),
                ),
            ],
          ),
          const SizedBox(height: 12),

          if (entityId == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'Sign in with an active entity to manage API keys.',
                style: TextStyle(fontSize: 13, color: ProximColors.onSurfaceVariant),
              ),
            )
          else
            keysAsync!.when(
              loading: _inlineSpinner,
              error: (err, _) => _errorRow('Unable to load API keys.', () => ref.invalidate(apiKeysProvider(entityId))),
              data: (keys) {
                final envKeys = keys.where((k) => k.environment == _environment).toList();
                if (envKeys.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      'No API keys for this environment yet. Roll a new key to get started.',
                      style: TextStyle(fontSize: 13, color: ProximColors.onSurfaceVariant),
                    ),
                  );
                }
                return Column(
                  children: [
                    for (final key in envKeys) ...[
                      _buildKeyItem(key),
                      if (key != envKeys.last) const SizedBox(height: 8),
                    ],
                  ],
                );
              },
            ),

          const SizedBox(height: 12),
          GestureDetector(
            onTap: entityId == null
                ? null
                : () async {
                    try {
                      final key = await ref.read(developerRepositoryProvider).rollKey(
                            entityId,
                            _environment,
                            name: _isProd ? 'Production API Key' : 'Sandbox API Key',
                          );
                      ref.invalidate(apiKeysProvider(entityId));
                      if (!mounted) return;
                      if (key.secretKey != null) {
                        _showNewKeyDialog(key);
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('New ${key.name} (${key.keyPrefix}) generated & rotated')),
                        );
                      }
                    } catch (e) {
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(e.toString())),
                      );
                    }
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

  Widget _buildKeyItem(ApiKeyItem key) {
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
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Text(
                  key.name,
                  style: ProximTextStyles.labelSm(color: ProximColors.textWhite),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: ProximColors.secondary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  key.scopes.isEmpty ? 'Standard' : key.scopes.first,
                  style: ProximTextStyles.labelXs(color: ProximColors.secondary),
                  overflow: TextOverflow.ellipsis,
                ),
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
                    key.keyPrefix.isEmpty ? '••••' : key.keyPrefix,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 11,
                      color: ProximColors.primary,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => _copyToClipboard(key.keyPrefix, 'API Key'),
                  child: const Icon(Icons.copy, size: 16, color: ProximColors.primary),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                key.lastUsedAt != null ? 'Last used ${_formatDay(key.lastUsedAt!)}' : 'Never used',
                style: ProximTextStyles.labelXs(),
              ),
              Text('Created ${_formatDay(key.createdAt)}', style: ProximTextStyles.labelXs()),
            ],
          ),
        ],
      ),
    );
  }

  void _showNewKeyDialog(ApiKeyItem key) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: ProximColors.surfaceContainerLow,
        title: Text('Key generated', style: ProximTextStyles.headlineSm()),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Copy this secret now — it will not be shown again.',
              style: ProximTextStyles.bodySm(),
            ),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: ProximColors.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(8),
              ),
              child: SelectableText(
                key.secretKey!,
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: ProximColors.primary,
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Done'),
          ),
          ElevatedButton(
            onPressed: () {
              _copyToClipboard(key.secretKey!, 'Secret key');
              Navigator.pop(dialogContext);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: ProximColors.primary,
              foregroundColor: ProximColors.surfaceContainerLowest,
            ),
            child: const Text('Copy'),
          ),
        ],
      ),
    );
  }

  Widget _buildWebhooksSection(
    String? entityId,
    AsyncValue<List<WebhookEndpoint>>? webhooksAsync,
    AsyncValue<List<WebhookDelivery>>? deliveriesAsync,
  ) {
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
            ],
          ),
          const SizedBox(height: 12),
          if (entityId == null)
            const Text(
              'Sign in with an active entity to view webhooks.',
              style: TextStyle(fontSize: 13, color: ProximColors.onSurfaceVariant),
            )
          else
            webhooksAsync!.when(
              loading: _inlineSpinner,
              error: (err, _) => _errorRow('Unable to load webhooks.', () => ref.invalidate(webhooksProvider(entityId))),
              data: (endpoints) {
                if (endpoints.isEmpty) {
                  return const Text(
                    'No webhook endpoints registered yet.',
                    style: TextStyle(fontSize: 13, color: ProximColors.onSurfaceVariant),
                  );
                }
                final deliveries = deliveriesAsync?.value ?? [];
                WebhookDelivery? latestFor(String endpointId) {
                  for (final d in deliveries) {
                    if (d.webhookEndpointId == endpointId) return d;
                  }
                  return null;
                }

                return Column(
                  children: [
                    for (final endpoint in endpoints) ...[
                      _buildEndpointItem(endpoint, latestFor(endpoint.id)),
                      if (endpoint != endpoints.last) const SizedBox(height: 8),
                    ],
                  ],
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildEndpointItem(WebhookEndpoint endpoint, WebhookDelivery? latestDelivery) {
    final (statusColor, statusText) = !endpoint.isActive
        ? (ProximColors.onSurfaceVariant, 'Disabled')
        : latestDelivery == null
            ? (ProximColors.onSurfaceVariant, 'No deliveries yet')
            : switch (latestDelivery.status) {
                'DELIVERED' => (ProximColors.statusSuccess, 'Delivered • ${latestDelivery.responseStatus ?? '—'}'),
                'FAILED' => (ProximColors.error, 'Failed • ${latestDelivery.responseStatus ?? '—'}'),
                'RETRYING' => (ProximColors.statusWarning, 'Retrying (attempt ${latestDelivery.attempts})'),
                _ => (ProximColors.statusWarning, latestDelivery.status),
              };

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
                decoration: BoxDecoration(shape: BoxShape.circle, color: statusColor),
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  statusText,
                  style: ProximTextStyles.labelXs(color: statusColor),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(endpoint.url, style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: ProximColors.textWhite)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: endpoint.events.map((ev) {
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

  Widget _buildEventLogSection(String? entityId, AsyncValue<List<ApiLogItem>>? logsAsync) {
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
          Text('API Request Logs', style: ProximTextStyles.headlineSm()),
          const SizedBox(height: 8),
          if (entityId == null)
            const Text(
              'Sign in with an active entity to view request logs.',
              style: TextStyle(fontSize: 13, color: ProximColors.onSurfaceVariant),
            )
          else
            logsAsync!.when(
              loading: _inlineSpinner,
              error: (err, _) => _errorRow('Unable to load request logs.', () => ref.invalidate(apiLogsProvider(entityId))),
              data: (logs) {
                if (logs.isEmpty) {
                  return const Text(
                    'No API requests logged yet.',
                    style: TextStyle(fontSize: 13, color: ProximColors.onSurfaceVariant),
                  );
                }
                return Column(
                  children: [
                    for (final log in logs.take(10)) ...[
                      _buildLogRow(log),
                      if (log != logs.take(10).last) const SizedBox(height: 6),
                    ],
                  ],
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildLogRow(ApiLogItem log) {
    final isSuccess = log.statusCode >= 200 && log.statusCode < 400;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: Text(
              '${log.method} ${log.endpoint}',
              style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: ProximColors.onSurface),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 8),
          Row(
            children: [
              Text(
                '${log.statusCode}',
                style: ProximTextStyles.labelXs(
                  color: isSuccess ? ProximColors.statusSuccess : ProximColors.error,
                ),
              ),
              const SizedBox(width: 8),
              Text(_formatTime(log.createdAt), style: ProximTextStyles.labelXs()),
            ],
          ),
        ],
      ),
    );
  }

  Widget _inlineSpinner() {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 16),
      child: Center(
        child: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2, value: 0.8),
        ),
      ),
    );
  }

  Widget _errorRow(String message, VoidCallback onRetry) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: Text(message, style: const TextStyle(color: Colors.white70, fontSize: 13)),
          ),
          TextButton(
            onPressed: onRetry,
            child: const Text('Retry', style: TextStyle(color: ProximColors.primary, fontSize: 13)),
          ),
        ],
      ),
    );
  }

  static const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  String _formatDay(DateTime dt) => '${_months[dt.month - 1]} ${dt.day}';

  String _formatTime(DateTime dt) {
    String two(int v) => v.toString().padLeft(2, '0');
    return '${two(dt.hour)}:${two(dt.minute)}:${two(dt.second)}';
  }
}
