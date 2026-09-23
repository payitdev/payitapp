import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/transaction_tile.dart';
import '../data/cards_repository.dart';
import '../domain/card_models.dart';
import 'cards_provider.dart';

class CardsScreen extends ConsumerWidget {
  const CardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardsAsync = ref.watch(cardsListProvider);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 108),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Cards',
                style: TextStyle(
                    fontSize: 22, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -0.4),
              ),
              GestureDetector(
                onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Card issuance coming soon')),
                ),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: ProximColors.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(9999),
                    border: Border.all(color: ProximColors.hairlineBorder),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.add, size: 14, color: ProximColors.primary),
                      SizedBox(width: 4),
                      Text('New Card',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: ProximColors.primary)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          cardsAsync.when(
            data: (cards) {
              if (cards.isEmpty) {
                return _NoCardsView(
                    onIssue: () => ScaffoldMessenger.of(context)
                        .showSnackBar(const SnackBar(content: Text('Card issuance coming soon'))));
              }
              return _CardsBody(cards: cards);
            },
            loading: () => _CardsBody(cards: CardsRepository.demoCards()),
            error: (err, _) => _CardsError(onRetry: () => ref.invalidate(cardsListProvider)),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cards Body — renders first card + freeze/top-up controls + transactions
// ─────────────────────────────────────────────────────────────────────────────

class _CardsBody extends ConsumerStatefulWidget {
  final List<ProximCard> cards;
  const _CardsBody({required this.cards});

  @override
  ConsumerState<_CardsBody> createState() => _CardsBodyState();
}

class _CardsBodyState extends ConsumerState<_CardsBody> {
  bool _showDetails = false;

  ProximCard get card => widget.cards.first;

  Future<void> _toggleFreeze(BuildContext context) async {
    final repo = ref.read(cardsRepositoryProvider);
    try {
      await repo.toggleFreeze(card.id, freeze: !card.isFrozen);
      ref.invalidate(cardsListProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(card.isFrozen ? 'Card is now active.' : 'Card has been frozen.')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final txAsync = ref.watch(cardTransactionsProvider(card.id));
    final isFrozen = card.isFrozen;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Card Visual
        Container(
          height: 210,
          width: double.infinity,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isFrozen
                  ? [const Color(0xFF1B2230), const Color(0xFF101520)]
                  : [const Color(0xFF132A32), const Color(0xFF22174B)],
            ),
            border: Border.all(
              color: isFrozen ? ProximColors.hairlineBorder : ProximColors.primary.withValues(alpha: 0.3),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: isFrozen
                    ? Colors.black.withValues(alpha: 0.4)
                    : ProximColors.primary.withValues(alpha: 0.15),
                blurRadius: 28,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Proxim Virtual',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: 0.5)),
                  if (isFrozen)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(9999)),
                      child: const Row(
                        children: [
                          Icon(Icons.ac_unit, size: 12, color: Colors.white),
                          SizedBox(width: 4),
                          Text('Frozen',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white)),
                        ],
                      ),
                    )
                  else
                    const Icon(Icons.contactless, size: 24, color: Colors.white70),
                ],
              ),
              Text(
                _showDetails
                    ? card.maskedNumber.replaceAll('••••  ••••  ••••', '4829  5512  9041')
                    : card.maskedNumber,
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    letterSpacing: 2.0,
                    fontFeatures: [FontFeature.tabularFigures()]),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('CARDHOLDER',
                          style: TextStyle(
                              fontSize: 9, fontWeight: FontWeight.w600, color: ProximColors.onSurfaceVariant, letterSpacing: 0.8)),
                      const SizedBox(height: 2),
                      Text(card.holderName.toUpperCase(),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: 0.5)),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('EXPIRES',
                          style: TextStyle(
                              fontSize: 9, fontWeight: FontWeight.w600, color: ProximColors.onSurfaceVariant, letterSpacing: 0.8)),
                      const SizedBox(height: 2),
                      Text(
                        _showDetails ? '${card.expiryDisplay}  CVV: •••' : card.expiryDisplay,
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                            fontFeatures: [FontFeature.tabularFigures()]),
                      ),
                    ],
                  ),
                  Text(
                    card.network,
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w900, fontStyle: FontStyle.italic, color: Colors.white),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Controls
        Row(
          children: [
            _buildControlTile(
              icon: isFrozen ? Icons.lock_open : Icons.ac_unit,
              label: isFrozen ? 'Unfreeze' : 'Freeze',
              isActive: isFrozen,
              onTap: () => _toggleFreeze(context),
            ),
            const SizedBox(width: 8),
            _buildControlTile(
              icon: _showDetails ? Icons.visibility_off : Icons.visibility,
              label: _showDetails ? 'Hide' : 'Details',
              isActive: _showDetails,
              onTap: () => setState(() => _showDetails = !_showDetails),
            ),
            const SizedBox(width: 8),
            _buildControlTile(
              icon: Icons.add_card,
              label: 'Top Up',
              onTap: () => ScaffoldMessenger.of(context)
                  .showSnackBar(const SnackBar(content: Text('Top up coming soon'))),
            ),
            const SizedBox(width: 8),
            _buildControlTile(
              icon: Icons.tune,
              label: 'Limits',
              onTap: () => ScaffoldMessenger.of(context)
                  .showSnackBar(const SnackBar(content: Text('Spending limits coming soon'))),
            ),
          ],
        ),
        const SizedBox(height: 24),

        const Text('Card Activity',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
        const SizedBox(height: 12),

        txAsync.when(
          data: (txList) {
            if (txList.isEmpty) {
              return const Padding(
                padding: EdgeInsets.all(24),
                child: Center(
                    child: Text('No card activity yet.',
                        style: TextStyle(color: ProximColors.onSurfaceVariant, fontSize: 13))),
              );
            }
            return Column(
              children: txList.map((tx) {
                return TransactionTile(
                  item: TransactionItem(
                    id: tx.id,
                    title: tx.description,
                    subtitle: _formatDate(tx.timestamp),
                    amount: tx.amount,
                    type: tx.isDebit ? TransactionType.sent : TransactionType.received,
                  ),
                );
              }).toList(),
            );
          },
          loading: () => const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2, value: 0.8),
              ),
            ),
          ),
          // ignore: avoid_types_on_closure_parameters
          error: (err, st) => const Text('Unable to load card activity.',
              style: TextStyle(color: Colors.white70, fontSize: 13)),
        ),
      ],
    );
  }

  Widget _buildControlTile({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isActive = false,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isActive ? ProximColors.primary.withValues(alpha: 0.15) : ProximColors.surfaceContainerLow,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: isActive ? ProximColors.primary : ProximColors.hairlineBorder),
          ),
          child: Column(
            children: [
              Icon(icon, size: 20, color: isActive ? ProximColors.primary : Colors.white),
              const SizedBox(height: 6),
              Text(label,
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isActive ? ProximColors.primary : ProximColors.onSurfaceVariant)),
            ],
          ),
        ),
      ),
    );
  }

  static String _formatDate(DateTime dt) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '${months[dt.month - 1]} ${dt.day}, $h:$m';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty / Error states
// ─────────────────────────────────────────────────────────────────────────────

class _NoCardsView extends StatelessWidget {
  final VoidCallback onIssue;
  const _NoCardsView({required this.onIssue});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 60),
      child: Column(
        children: [
          const Icon(Icons.credit_card_off_outlined, size: 40, color: ProximColors.onSurfaceVariant),
          const SizedBox(height: 16),
          const Text('No cards yet.', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
          const SizedBox(height: 8),
          const Text('Issue a virtual card to start spending.',
              style: TextStyle(fontSize: 13, color: ProximColors.onSurfaceVariant)),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: onIssue,
            style: ElevatedButton.styleFrom(
                backgroundColor: ProximColors.primary,
                foregroundColor: ProximColors.surfaceContainerLowest,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
            child: const Text('Issue a Card'),
          ),
        ],
      ),
    );
  }
}

class _CardsError extends StatelessWidget {
  final VoidCallback onRetry;
  const _CardsError({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 60),
      child: Column(
        children: [
          const Icon(Icons.wifi_off_outlined, size: 36, color: ProximColors.onSurfaceVariant),
          const SizedBox(height: 12),
          const Text('Unable to load cards.', style: TextStyle(fontSize: 14, color: Colors.white70)),
          const SizedBox(height: 12),
          TextButton(
              onPressed: onRetry,
              child: const Text('Try again', style: TextStyle(color: ProximColors.primary))),
        ],
      ),
    );
  }
}
