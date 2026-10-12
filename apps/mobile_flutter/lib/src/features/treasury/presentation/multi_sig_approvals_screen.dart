import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/centered_app_container.dart';
import '../../auth/presentation/auth_provider.dart';
import '../domain/treasury_models.dart';
import 'treasury_provider.dart';

/// Multi-sig approval queue — fully data-driven from GET /api/approvals.
/// Queue tab shows PENDING approvals (with per-signer Sign / Reject
/// actions against POST /api/approvals/:id/sign); History tab shows
/// everything that has left the queue (APPROVED / REJECTED / EXECUTED /
/// EXPIRED).
class MultiSigApprovalsScreen extends ConsumerStatefulWidget {
  const MultiSigApprovalsScreen({super.key});

  @override
  ConsumerState<MultiSigApprovalsScreen> createState() => _MultiSigApprovalsScreenState();
}

class _MultiSigApprovalsScreenState extends ConsumerState<MultiSigApprovalsScreen> {
  int _selectedTab = 0; // 0: Queue, 1: History
  bool _acting = false;

  final NumberFormat _moneyFormat = NumberFormat('#,##0.00', 'en_US');
  final DateFormat _dateFormat = DateFormat('MMM d, h:mm a');

  String _currencySymbol(String currency) {
    switch (currency) {
      case 'NGN':
        return '₦';
      case 'EUR':
        return '€';
      case 'GBP':
        return '£';
      default:
        return '\$';
    }
  }

  Future<void> _refresh() async {
    ref.invalidate(approvalsProvider);
    ref.invalidate(pendingApprovalsProvider);
    await Future.wait([
      ref.read(approvalsProvider('PENDING').future),
      ref.read(approvalsProvider(null).future),
    ]);
  }

  Future<void> _handleSign(PendingApproval approval, ApprovalSigner signer) async {
    if (_acting) return;
    setState(() => _acting = true);
    try {
      final repo = ref.read(treasuryRepositoryProvider);
      final updated = await repo.signApproval(approval.id, signer.id);
      _invalidateApprovals();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.verified, size: 18, color: ProximColors.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    updated.isPending
                        ? 'Signature recorded for ${signer.label}'
                        : '${updated.title} ${updated.status.toLowerCase()}',
                  ),
                ),
              ],
            ),
            backgroundColor: ProximColors.surfaceContainerHigh,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _handleReject(PendingApproval approval, ApprovalSigner signer) async {
    if (_acting) return;
    setState(() => _acting = true);
    try {
      final repo = ref.read(treasuryRepositoryProvider);
      await repo.signApproval(approval.id, signer.id, reject: true);
      _invalidateApprovals();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${signer.label} rejected ${approval.title}'),
            backgroundColor: ProximColors.surfaceContainerHigh,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  void _invalidateApprovals() {
    ref.invalidate(approvalsProvider('PENDING'));
    ref.invalidate(approvalsProvider(null));
    ref.invalidate(pendingApprovalsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final queueAsync = ref.watch(approvalsProvider('PENDING'));
    final historyAsync = ref.watch(approvalsProvider(null));
    final entity = ref.watch(activeEntityProvider);

    final queue = queueAsync.value ?? const <PendingApproval>[];
    final history = (historyAsync.value ?? const <PendingApproval>[])
        .where((a) => !a.isPending)
        .toList();

    return Scaffold(
      backgroundColor: ProximColors.backgroundVoid,
      body: CenteredAppContainer(
        child: SafeArea(
          child: Column(
            children: [
              _buildTopBar(context),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _refresh,
                  color: ProximColors.primary,
                  backgroundColor: ProximColors.surfaceContainerHigh,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    children: [
                      _buildHeader(entity?.legalName ?? 'Organization'),
                      const SizedBox(height: 12),
                      if (queueAsync.hasError)
                        const SizedBox.shrink()
                      else
                        _buildNoticePill(queueAsync.isLoading ? null : queue.length),
                      const SizedBox(height: 14),
                      _buildQuorumOverviewCard(queueAsync.isLoading ? const [] : queue),
                      const SizedBox(height: 14),
                      _buildFilterTabs(queue.length, history.length),
                      const SizedBox(height: 14),
                      if (_selectedTab == 0)
                        _buildQueueBody(queueAsync)
                      else
                        _buildHistoryBody(historyAsync, history),
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
          Text('Approval Queue', style: ProximTextStyles.headlineSm()),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(9999),
              border: Border.all(color: ProximColors.primary.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.tune, size: 14, color: ProximColors.primary),
                const SizedBox(width: 4),
                Text('Policy', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(String entityName) {
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
                color: ProximColors.statusWarning,
              ),
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                '${entityName.toUpperCase()} • MULTI-SIG',
                style: ProximTextStyles.labelXs(color: ProximColors.onSurfaceVariant).copyWith(
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text('Executive Sign-Off', style: ProximTextStyles.headlineLg()),
      ],
    );
  }

  Widget _buildNoticePill(int? pendingCount) {
    if (pendingCount == null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: ProximColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: ProximColors.hairlineBorder),
        ),
        child: Row(
          children: [
            const Icon(Icons.lock_clock, size: 16, color: ProximColors.statusWarning),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                'Checking for approvals that need your signature…',
                style: ProximTextStyles.labelSm(color: ProximColors.textWhite),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      );
    }

    final hasPending = pendingCount > 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: Row(
              children: [
                Icon(
                  hasPending ? Icons.lock_clock : Icons.check_circle,
                  size: 16,
                  color: hasPending ? ProximColors.statusWarning : ProximColors.statusSuccess,
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    hasPending
                        ? '$pendingCount pending approval${pendingCount == 1 ? '' : 's'} require${pendingCount == 1 ? 's' : ''} your signature'
                        : 'No signatures outstanding',
                    style: ProximTextStyles.labelSm(color: ProximColors.textWhite),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          if (hasPending) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: ProximColors.statusWarning.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                'ACTION',
                style: ProximTextStyles.labelXs(color: ProximColors.statusWarning).copyWith(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildQuorumOverviewCard(List<PendingApproval> queue) {
    final totalRequired = queue.fold<int>(0, (sum, a) => sum + a.requiredSignatures);
    final totalSigned = queue.fold<int>(0, (sum, a) => sum + a.signedCount);
    final outstanding = totalRequired - totalSigned;

    // Distinct signer slots across the queue, deduped by label, most
    // advanced status wins (SIGNED > REJECTED > PENDING).
    final slots = <String, ApprovalSigner>{};
    for (final approval in queue) {
      for (final signer in approval.signers) {
        final existing = slots[signer.label];
        if (existing == null || _statusRank(signer.status) > _statusRank(existing.status)) {
          slots[signer.label] = signer;
        }
      }
    }
    final signers = slots.values.toList()
      ..sort((a, b) => _statusRank(a.status).compareTo(_statusRank(b.status)));

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
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Row(
                        children: [
                          const Icon(Icons.verified_user, size: 16, color: ProximColors.primary),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              'VAULT QUORUM THRESHOLD',
                              style: ProximTextStyles.labelXs(),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: ProximColors.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(9999),
                      ),
                      child: Text('M-of-N Policy', style: ProximTextStyles.labelXs(color: ProximColors.primary)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  queue.isEmpty
                      ? 'No signatures outstanding'
                      : '$totalSigned of $totalRequired signatures collected across ${queue.length} queued approval${queue.length == 1 ? '' : 's'}',
                  style: ProximTextStyles.headlineSm(),
                ),
                if (queue.isNotEmpty && outstanding > 0)
                  Text(
                    '$outstanding signature${outstanding == 1 ? '' : 's'} still required',
                    style: ProximTextStyles.labelXs(color: ProximColors.statusWarning),
                  ),
                const SizedBox(height: 12),
                if (signers.isEmpty)
                  Text(
                    'Signer slots will appear here once an approval is queued.',
                    style: ProximTextStyles.labelXs(),
                  )
                else
                  ...signers.map(
                    (signer) => Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: _buildSignerTile(signer: signer),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  int _statusRank(String status) {
    switch (status) {
      case 'SIGNED':
        return 2;
      case 'REJECTED':
        return 1;
      default:
        return 0;
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'SIGNED':
      case 'APPROVED':
      case 'EXECUTED':
        return ProximColors.statusSuccess;
      case 'REJECTED':
        return ProximColors.statusDanger;
      default:
        return ProximColors.statusWarning;
    }
  }

  IconData _statusIcon(String status) {
    switch (status) {
      case 'SIGNED':
      case 'APPROVED':
      case 'EXECUTED':
        return Icons.check;
      case 'REJECTED':
        return Icons.close;
      default:
        return Icons.key;
    }
  }

  Widget _buildSignerTile({required ApprovalSigner signer}) {
    final color = _statusColor(signer.status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: color.withValues(alpha: 0.15),
                  ),
                  child: Icon(_statusIcon(signer.status), size: 16, color: color),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        signer.label,
                        style: ProximTextStyles.bodySm(color: ProximColors.textWhite).copyWith(fontWeight: FontWeight.w600),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        [
                          if (signer.keyNote != null && signer.keyNote!.isNotEmpty) signer.keyNote,
                          if (signer.isSigned && signer.signedAt != null) 'Signed ${_dateFormat.format(signer.signedAt!)}',
                          if (signer.isRejected && signer.signedAt != null) 'Rejected ${_dateFormat.format(signer.signedAt!)}',
                        ].whereType<String>().join(' • '),
                        style: ProximTextStyles.labelXs(color: color),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              signer.status,
              style: ProximTextStyles.labelXs(color: color).copyWith(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTabs(int queueCount, int historyCount) {
    final tabs = ['Queue ($queueCount)', 'History ($historyCount)'];
    return Row(
      children: List.generate(tabs.length, (index) {
        final isSelected = _selectedTab == index;
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: index == tabs.length - 1 ? 0 : 6),
            child: GestureDetector(
              onTap: () => setState(() => _selectedTab = index),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? ProximColors.surfaceContainerHigh : ProximColors.surfaceContainerLowest,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Center(
                  child: Text(
                    tabs[index],
                    style: ProximTextStyles.labelSm(
                      color: isSelected ? ProximColors.primary : ProximColors.onSurfaceVariant,
                    ).copyWith(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _buildQueueBody(AsyncValue<List<PendingApproval>> queueAsync) {
    return queueAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(child: CircularProgressIndicator(color: ProximColors.primary)),
      ),
      error: (error, _) => _buildErrorState(
        error,
        onRetry: () => ref.invalidate(approvalsProvider('PENDING')),
      ),
      data: (approvals) {
        if (approvals.isEmpty) {
          return _buildEmptyState(
            icon: Icons.inbox_outlined,
            message: 'No approvals queued',
            detail: 'New approval requests will appear here for signature.',
          );
        }
        return Column(
          children: [
            for (final approval in approvals) ...[
              _buildApprovalCard(approval),
              const SizedBox(height: 12),
            ],
          ],
        );
      },
    );
  }

  Widget _buildHistoryBody(
    AsyncValue<List<PendingApproval>> historyAsync,
    List<PendingApproval> history,
  ) {
    return historyAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(child: CircularProgressIndicator(color: ProximColors.primary)),
      ),
      error: (error, _) => _buildErrorState(
        error,
        onRetry: () => ref.invalidate(approvalsProvider(null)),
      ),
      data: (_) {
        if (history.isEmpty) {
          return _buildEmptyState(
            icon: Icons.history,
            message: 'No approvals yet',
            detail: 'Approved, rejected and executed approvals will show here.',
          );
        }
        return Column(
          children: [
            for (final approval in history) ...[
              _buildHistoryCard(approval),
              const SizedBox(height: 12),
            ],
          ],
        );
      },
    );
  }

  Widget _buildErrorState(Object error, {required VoidCallback onRetry}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Column(
        children: [
          Text(error.toString(), style: ProximTextStyles.bodySm()),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: onRetry,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: ProximColors.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(9999),
              ),
              child: Text(
                'Retry',
                style: ProximTextStyles.labelSm(color: ProximColors.primary).copyWith(fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState({
    required IconData icon,
    required String message,
    required String detail,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Column(
        children: [
          Icon(icon, size: 28, color: ProximColors.onSurfaceVariant),
          const SizedBox(height: 10),
          Text(message, style: ProximTextStyles.headlineSm()),
          const SizedBox(height: 4),
          Text(detail, style: ProximTextStyles.labelXs(), textAlign: TextAlign.center),
        ],
      ),
    );
  }

  Widget _buildApprovalCard(PendingApproval approval) {
    final fraction = approval.requiredSignatures > 0
        ? (approval.signedCount / approval.requiredSignatures).clamp(0.0, 1.0)
        : 0.0;

    return Container(
      padding: const EdgeInsets.all(14),
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
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: ProximColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  approval.status,
                  style: ProximTextStyles.labelXs(color: ProximColors.primary),
                ),
              ),
              if (approval.createdAt != null)
                Text(
                  'Created ${_dateFormat.format(approval.createdAt!)}',
                  style: ProximTextStyles.labelXs(),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                '${_currencySymbol(approval.currency)}${_moneyFormat.format(approval.amount)}',
                style: ProximTextStyles.headlineLg(color: ProximColors.textWhite).copyWith(
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(width: 6),
              Text(approval.currency, style: ProximTextStyles.headlineSm()),
            ],
          ),
          const SizedBox(height: 10),

          // Detail box
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainer,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  approval.title,
                  style: ProximTextStyles.labelSm(color: ProximColors.textWhite).copyWith(fontWeight: FontWeight.w600),
                ),
                if (approval.description != null && approval.description!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(approval.description!, style: ProximTextStyles.labelXs()),
                ],
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Progress
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${approval.signedCount} of ${approval.requiredSignatures} Signed',
                style: ProximTextStyles.labelXs(color: ProximColors.primary),
              ),
              if (approval.updatedAt != null)
                Text(
                  'Updated ${_dateFormat.format(approval.updatedAt!)}',
                  style: ProximTextStyles.labelXs(),
                ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(9999),
            child: LinearProgressIndicator(
              value: fraction,
              backgroundColor: ProximColors.surfaceContainerLowest,
              valueColor: const AlwaysStoppedAnimation<Color>(ProximColors.primary),
              minHeight: 4,
            ),
          ),
          const SizedBox(height: 10),

          // Signer slots with per-slot actions
          for (final signer in approval.signers) ...[
            _buildSignerTile(signer: signer),
            if (signer.isPending) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: _acting ? null : () => _handleReject(approval, signer),
                      child: Container(
                        height: 36,
                        decoration: BoxDecoration(
                          color: ProximColors.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(9999),
                        ),
                        child: Center(
                          child: Text(
                            'Decline for ${signer.label}',
                            style: ProximTextStyles.labelXs(color: ProximColors.statusDanger),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: GestureDetector(
                      onTap: _acting ? null : () => _handleSign(approval, signer),
                      child: Container(
                        height: 36,
                        decoration: BoxDecoration(
                          gradient: ProximColors.auroraGradient,
                          borderRadius: BorderRadius.circular(9999),
                        ),
                        child: Center(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.fingerprint, size: 16, color: ProximColors.surfaceContainerLowest),
                              const SizedBox(width: 6),
                              Text(
                                'Sign as ${signer.label}',
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: ProximColors.surfaceContainerLowest,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 6),
          ],
        ],
      ),
    );
  }

  Widget _buildHistoryCard(PendingApproval approval) {
    final color = _statusColor(approval.status);
    return Container(
      padding: const EdgeInsets.all(14),
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
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  approval.status,
                  style: ProximTextStyles.labelXs(color: color).copyWith(fontWeight: FontWeight.w600),
                ),
              ),
              if (approval.updatedAt != null)
                Text(
                  _dateFormat.format(approval.updatedAt!),
                  style: ProximTextStyles.labelXs(),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      approval.title,
                      style: ProximTextStyles.labelSm(color: ProximColors.textWhite).copyWith(fontWeight: FontWeight.w600),
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (approval.description != null && approval.description!.isNotEmpty)
                      Text(
                        approval.description!,
                        style: ProximTextStyles.labelXs(),
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '${_currencySymbol(approval.currency)}${_moneyFormat.format(approval.amount)} ${approval.currency}',
                style: ProximTextStyles.bodySm(color: ProximColors.textWhite).copyWith(
                  fontWeight: FontWeight.w600,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${approval.signedCount} of ${approval.requiredSignatures} signatures collected',
            style: ProximTextStyles.labelXs(color: ProximColors.primary),
          ),
        ],
      ),
    );
  }
}
