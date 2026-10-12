import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';
import '../../auth/presentation/auth_provider.dart';
import '../data/payment_requests_repository.dart';
import 'invoices_provider.dart';

class PaymentRequestHubScreen extends ConsumerStatefulWidget {
  const PaymentRequestHubScreen({super.key});

  @override
  ConsumerState<PaymentRequestHubScreen> createState() => _PaymentRequestHubScreenState();
}

class _PaymentRequestHubScreenState extends ConsumerState<PaymentRequestHubScreen> {
  int _selectedTab = 0; // 0: Inbound, 1: Outbound, 2: Settled / Archived
  String? _processingRequestId;

  Future<void> _handleApprove(PaymentRequestItem item, String entityId) async {
    if (_processingRequestId != null) return;
    setState(() => _processingRequestId = item.id);
    try {
      final repo = ref.read(paymentRequestsRepositoryProvider);
      await repo.fulfillRequest(entityId: entityId, requestId: item.id);
      ref.invalidate(paymentRequestsProvider(entityId));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.verified, size: 18, color: ProximColors.primary),
              const SizedBox(width: 8),
              Text('Payment of \$${item.amount.toStringAsFixed(2)} to ${item.requesterName} completed'),
            ],
          ),
          backgroundColor: ProximColors.surfaceContainerHigh,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: ProximColors.statusError,
        ),
      );
    } finally {
      if (mounted) setState(() => _processingRequestId = null);
    }
  }

  Future<void> _handleDecline(PaymentRequestItem item, String entityId) async {
    if (_processingRequestId != null) return;
    setState(() => _processingRequestId = item.id);
    try {
      final repo = ref.read(paymentRequestsRepositoryProvider);
      await repo.declineRequest(entityId: entityId, requestId: item.id);
      ref.invalidate(paymentRequestsProvider(entityId));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Request from ${item.requesterName} declined'),
          backgroundColor: ProximColors.surfaceContainerHigh,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: ProximColors.statusError,
        ),
      );
    } finally {
      if (mounted) setState(() => _processingRequestId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final entity = ref.watch(activeEntityProvider);
    final entityId = entity?.id ?? '';
    final requestsAsync = entityId.isEmpty ? null : ref.watch(paymentRequestsProvider(entityId));
    final data = requestsAsync?.value;

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
                      _buildSegmentedTabs(data),
                      const SizedBox(height: 14),
                      _buildMetricsBento(data),
                      const SizedBox(height: 16),
                      _buildSectionHeader(),
                      const SizedBox(height: 10),
                      _buildRequestsList(requestsAsync, entityId),
                      const SizedBox(height: 20),
                      _buildCreateRequestCta(context),
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
              'Payment Hub',
              style: ProximTextStyles.headlineSm(),
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.refresh, size: 20, color: ProximColors.primary),
            onPressed: () {
              final entity = ref.read(activeEntityProvider);
              if (entity != null) ref.invalidate(paymentRequestsProvider(entity.id));
            },
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
              'PEER CLEARING PROTOCOL',
              style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                letterSpacing: 1.2,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text('Payment Requests', style: ProximTextStyles.headlineLg()),
      ],
    );
  }

  Widget _buildSegmentedTabs(PaymentRequestsData? data) {
    final inboundCount = data?.allInbound.length ?? 0;
    final outboundCount = data?.outbound.length ?? 0;
    final tabs = [
      'Inbound ($inboundCount)',
      'Outbound ($outboundCount)',
      'Settled',
    ];

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(9999),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Row(
        children: List.generate(tabs.length, (index) {
          final isSelected = _selectedTab == index;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _selectedTab = index),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  gradient: isSelected ? ProximColors.auroraGradient : null,
                  borderRadius: BorderRadius.circular(9999),
                ),
                child: Center(
                  child: Text(
                    tabs[index],
                    style: ProximTextStyles.labelSm(
                      color: isSelected ? ProximColors.surfaceContainerLowest : ProximColors.onSurfaceVariant,
                    ).copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildMetricsBento(PaymentRequestsData? data) {
    final pendingOutbound = data?.outbound.where((r) => r.status == 'PENDING').toList() ?? [];
    final pendingOutboundTotal = pendingOutbound.fold<double>(0.0, (sum, r) => sum + r.amount);

    final pendingInbound = data?.allInbound.where((r) => r.status == 'PENDING').toList() ?? [];

    return Row(
      children: [
        Expanded(
          child: Container(
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
                    Text('PENDING INFLOW', style: ProximTextStyles.labelXs()),
                    const Icon(Icons.south_east, size: 16, color: ProximColors.primary),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  '\$${pendingOutboundTotal.toStringAsFixed(2)}',
                  style: ProximTextStyles.headlineLg(color: ProximColors.textWhite).copyWith(
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(height: 2),
                Text('${pendingOutbound.length} Active Outbound', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
              ],
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Container(
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
                    Text('ACTION REQUIRED', style: ProximTextStyles.labelXs()),
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: ProximColors.statusWarning,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text('${pendingInbound.length} Inbound', style: ProximTextStyles.headlineLg(color: ProximColors.textWhite)),
                const SizedBox(height: 2),
                Text(
                  pendingInbound.isNotEmpty ? 'Awaiting your approval' : 'All clear',
                  style: ProximTextStyles.labelXs(
                    color: pendingInbound.isNotEmpty ? ProximColors.statusWarning : ProximColors.statusSuccess,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSectionHeader() {
    final title = _selectedTab == 0
        ? 'Inbound Approval Queue'
        : (_selectedTab == 1 ? 'Outbound Requests' : 'Settled History');
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: ProximTextStyles.headlineSm()),
        if (_selectedTab == 0)
          Row(
            children: [
              const Icon(Icons.shield_outlined, size: 14, color: ProximColors.primary),
              const SizedBox(width: 4),
              Text('Secured by NEAR MPC', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
            ],
          ),
      ],
    );
  }

  Widget _buildRequestsList(AsyncValue<PaymentRequestsData>? requestsAsync, String entityId) {
    if (requestsAsync == null || requestsAsync.isLoading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: CircularProgressIndicator(strokeWidth: 2, color: ProximColors.primary),
        ),
      );
    }

    if (requestsAsync.hasError) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: ProximColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Center(
          child: Text(
            'Unable to load requests.',
            style: ProximTextStyles.bodyMd(color: ProximColors.statusError),
          ),
        ),
      );
    }

    final data = requestsAsync.value;
    if (data == null) return const SizedBox.shrink();

    List<PaymentRequestItem> items;
    if (_selectedTab == 0) {
      items = data.allInbound.where((r) => r.status == 'PENDING').toList();
    } else if (_selectedTab == 1) {
      items = data.outbound.where((r) => r.status == 'PENDING').toList();
    } else {
      items = [...data.allInbound, ...data.outbound].where((r) => r.status != 'PENDING').toList();
    }

    if (items.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: ProximColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: ProximColors.hairlineBorder),
        ),
        child: Text(
          _selectedTab == 0
              ? 'No pending inbound requests.'
              : (_selectedTab == 1 ? 'No active outbound requests.' : 'No archived requests.'),
          style: ProximTextStyles.bodyMd(color: ProximColors.onSurfaceVariant),
        ),
      );
    }

    return Column(
      children: items.map((item) {
        final isProcessing = _processingRequestId == item.id;
        final isInbound = _selectedTab == 0;

        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _buildRequestCard(
            item: item,
            isInbound: isInbound,
            isProcessing: isProcessing,
            onApprove: () => _handleApprove(item, entityId),
            onDecline: () => _handleDecline(item, entityId),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildRequestCard({
    required PaymentRequestItem item,
    required bool isInbound,
    required bool isProcessing,
    required VoidCallback onApprove,
    required VoidCallback onDecline,
  }) {
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
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: ProximColors.surfaceContainerHighest,
                    ),
                    child: Center(
                      child: Text(
                        item.requesterName.isNotEmpty ? item.requesterName.substring(0, 1).toUpperCase() : 'U',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: ProximColors.primary),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(item.requesterName, style: ProximTextStyles.bodyLg().copyWith(fontWeight: FontWeight.w600)),
                          if (item.isMutualContact) ...[
                            const SizedBox(width: 4),
                            const Icon(Icons.verified, size: 14, color: ProximColors.primary),
                          ],
                        ],
                      ),
                      Text('@${item.requesterUsername}', style: ProximTextStyles.labelXs()),
                    ],
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '\$${item.amount.toStringAsFixed(2)}',
                    style: ProximTextStyles.headlineSm(color: ProximColors.textWhite).copyWith(
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                  Text(item.currency, style: ProximTextStyles.labelXs(color: ProximColors.primary)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                const Icon(Icons.receipt_long, size: 16, color: ProximColors.onSurfaceVariant),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    item.narration,
                    style: ProximTextStyles.bodySm(),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          if (isInbound && item.status == 'PENDING') ...[
            const SizedBox(height: 10),
            if (isProcessing)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: CircularProgressIndicator(strokeWidth: 2, color: ProximColors.primary),
                ),
              )
            else
              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: GestureDetector(
                      onTap: onDecline,
                      child: Container(
                        height: 38,
                        decoration: BoxDecoration(
                          color: ProximColors.surfaceContainerHigh,
                          borderRadius: BorderRadius.circular(9999),
                        ),
                        child: Center(
                          child: Text('Decline', style: ProximTextStyles.labelSm()),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 3,
                    child: GestureDetector(
                      onTap: onApprove,
                      child: Container(
                        height: 38,
                        decoration: BoxDecoration(
                          gradient: ProximColors.auroraGradient,
                          borderRadius: BorderRadius.circular(9999),
                        ),
                        child: const Center(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.check, size: 16, color: ProximColors.surfaceContainerLowest),
                              SizedBox(width: 4),
                              Text(
                                'Approve & Pay',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: ProximColors.surfaceContainerLowest,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
          ] else ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: item.status == 'PAID'
                    ? ProximColors.statusSuccess.withValues(alpha: 0.15)
                    : (item.status == 'DECLINED'
                        ? ProximColors.statusError.withValues(alpha: 0.15)
                        : ProximColors.statusWarning.withValues(alpha: 0.15)),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                item.status,
                style: ProximTextStyles.labelXs(
                  color: item.status == 'PAID'
                      ? ProximColors.statusSuccess
                      : (item.status == 'DECLINED' ? ProximColors.statusError : ProximColors.statusWarning),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCreateRequestCta(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/receive'),
      child: Container(
        width: double.infinity,
        height: 50,
        decoration: BoxDecoration(
          color: ProximColors.surfaceContainerHigh,
          borderRadius: BorderRadius.circular(9999),
          border: Border.all(color: ProximColors.primary.withValues(alpha: 0.4)),
        ),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add_link, size: 18, color: ProximColors.primary),
            SizedBox(width: 8),
            Text(
              'Request Payment from Someone',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: ProximColors.textWhite,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
