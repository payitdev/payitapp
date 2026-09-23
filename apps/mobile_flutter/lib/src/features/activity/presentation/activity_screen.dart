import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/transaction_tile.dart';
import '../../transfers/domain/transfers_models.dart';
import '../../transfers/presentation/transfers_provider.dart';

enum ActivityFilter { all, received, sent }

class ActivityScreen extends ConsumerStatefulWidget {
  const ActivityScreen({super.key});

  @override
  ConsumerState<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends ConsumerState<ActivityScreen> {
  ActivityFilter _selectedFilter = ActivityFilter.all;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<TransferHistoryItem> _applyFilter(List<TransferHistoryItem> items) {
    return items.where((item) {
      final matchesFilter = switch (_selectedFilter) {
        ActivityFilter.all => true,
        ActivityFilter.received => item.isReceived,
        ActivityFilter.sent => item.isSent,
      };
      final matchesQuery = _searchQuery.isEmpty ||
          item.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          item.subtitle.toLowerCase().contains(_searchQuery.toLowerCase());
      return matchesFilter && matchesQuery;
    }).toList();
  }

  void _showTransactionDetail(TransferHistoryItem item) {
    showModalBottomSheet(
      context: context,
      backgroundColor: ProximColors.surfaceContainerLow,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        final isCredit = item.isReceived;
        final amountColor = isCredit ? ProximColors.tertiary : Colors.white;
        final sign = isCredit ? '+' : '-';

        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      item.title,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white),
                    ),
                  ),
                  Text(
                    '$sign${item.currency == 'NGN' ? '₦' : '\$'}${item.amount.abs().toStringAsFixed(2)}',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: amountColor),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                item.subtitle,
                style: const TextStyle(fontSize: 12, color: ProximColors.onSurfaceVariant),
              ),
              const SizedBox(height: 18),

              // Payment Details
              Container(
                padding: const EdgeInsets.all(14),
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: ProximColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: ProximColors.hairlineBorder),
                ),
                child: Column(
                  children: [
                    _buildDetailRow('Reference', 'UETR-${item.id.toUpperCase()}'),
                    const SizedBox(height: 8),
                    _buildDetailRow(
                      'Status',
                      item.status == 'CLEARED' ? 'Completed' : item.status,
                      isStatus: true,
                    ),
                    const SizedBox(height: 8),
                    _buildDetailRow('Rail', 'Direct Clearing / Local Settlement'),
                    const SizedBox(height: 8),
                    _buildDetailRow('Estimated delivery', 'Instant (under 10 seconds)'),
                  ],
                ),
              ),

              // Status Steps
              _buildTrackerStep(
                title: 'Initiated',
                subtitle: 'Account debited',
                timestamp: item.subtitle,
                isCompleted: true,
              ),
              _buildTrackerStep(
                title: 'Partner Bank Processing',
                subtitle: 'Settlement clearing in progress',
                timestamp: 'Est. 4m',
                isCompleted: item.status == 'CLEARED',
                isActive: item.status == 'PENDING',
              ),
              _buildTrackerStep(
                title: 'Settled',
                subtitle: 'Credited to recipient',
                timestamp: item.status == 'CLEARED' ? 'Done' : 'Pending',
                isCompleted: item.status == 'CLEARED',
              ),

              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.receipt_long, size: 16),
                      label: const Text('Share Receipt'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: ProximColors.hairlineBorder),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.support_agent, size: 16),
                      label: const Text('Support'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: ProximColors.primary,
                        foregroundColor: ProximColors.surfaceContainerLowest,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildDetailRow(String label, String value, {bool isStatus = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: ProximColors.onSurfaceVariant)),
        if (isStatus)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: ProximColors.tertiary.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(9999),
            ),
            child: Text(value,
                style: const TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w600, color: ProximColors.tertiary)),
          )
        else
          Text(value,
              style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white)),
      ],
    );
  }

  Widget _buildTrackerStep({
    required String title,
    required String subtitle,
    required String timestamp,
    required bool isCompleted,
    bool isActive = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isActive
                  ? ProximColors.primary.withValues(alpha: 0.2)
                  : isCompleted
                      ? ProximColors.primary
                      : ProximColors.surfaceContainerHigh,
            ),
            child: Center(
              child: Icon(
                isActive ? Icons.refresh : isCompleted ? Icons.check : Icons.circle,
                size: 14,
                color: isActive || !isCompleted
                    ? ProximColors.primary
                    : ProximColors.surfaceContainerLowest,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isCompleted || isActive ? Colors.white : ProximColors.onSurfaceVariant)),
                Text(subtitle,
                    style: const TextStyle(fontSize: 11, color: ProximColors.onSurfaceVariant)),
              ],
            ),
          ),
          Text(timestamp,
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: isActive ? Colors.amber : ProximColors.onSurfaceVariant)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final historyAsync = ref.watch(transfersHistoryProvider);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 108),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Activity',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -0.4),
          ),
          const SizedBox(height: 16),

          // Search
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: ProximColors.subtleBorder),
            ),
            child: TextField(
              controller: _searchController,
              onChanged: (val) => setState(() => _searchQuery = val),
              style: const TextStyle(fontSize: 14, color: Colors.white),
              decoration: InputDecoration(
                icon: const Icon(Icons.search, size: 18, color: ProximColors.onSurfaceVariant),
                hintText: 'Search transfers or contacts',
                hintStyle: const TextStyle(fontSize: 14, color: ProximColors.onSurfaceVariant),
                border: InputBorder.none,
                suffixIcon: _searchQuery.isNotEmpty
                    ? GestureDetector(
                        onTap: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                        child: const Icon(Icons.clear, size: 16, color: ProximColors.onSurfaceVariant),
                      )
                    : null,
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Filter Pills
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(9999),
              border: Border.all(color: ProximColors.hairlineBorder),
            ),
            child: Row(
              children: [
                _buildFilterTab('All', ActivityFilter.all),
                _buildFilterTab('Received', ActivityFilter.received),
                _buildFilterTab('Sent', ActivityFilter.sent),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Transaction List — live from API
          historyAsync.when(
            data: (allItems) {
              final filtered = _applyFilter(allItems);
              if (filtered.isEmpty) {
                return Container(
                  padding: const EdgeInsets.all(32),
                  alignment: Alignment.center,
                  child: const Column(
                    children: [
                      Icon(Icons.inbox_outlined, size: 36, color: ProximColors.onSurfaceVariant),
                      SizedBox(height: 12),
                      Text(
                        'No transactions found',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white),
                      ),
                    ],
                  ),
                );
              }
              return Column(
                children: filtered.map((item) {
                  return TransactionTile(
                    item: TransactionItem(
                      id: item.id,
                      title: item.title,
                      subtitle: item.subtitle,
                      amount: item.amount,
                      type: item.isSent
                          ? TransactionType.sent
                          : item.type == 'YIELD'
                              ? TransactionType.yieldReturn
                              : TransactionType.received,
                    ),
                    onTap: () => _showTransactionDetail(item),
                  );
                }).toList(),
              );
            },
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.all(40),
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2, value: 0.8),
                ),
              ),
            ),
            error: (err, _) => Column(
              children: [
                const SizedBox(height: 32),
                const Icon(Icons.wifi_off_outlined, size: 32, color: ProximColors.onSurfaceVariant),
                const SizedBox(height: 12),
                const Text(
                  'Unable to load activity.',
                  style: TextStyle(fontSize: 14, color: Colors.white70),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => ref.invalidate(transfersHistoryProvider),
                  child: const Text('Try again', style: TextStyle(color: ProximColors.primary)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTab(String label, ActivityFilter filter) {
    final isSelected = _selectedFilter == filter;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedFilter = filter),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? ProximColors.surfaceContainerHighest : Colors.transparent,
            borderRadius: BorderRadius.circular(9999),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color: isSelected ? ProximColors.primary : ProximColors.onSurfaceVariant,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
