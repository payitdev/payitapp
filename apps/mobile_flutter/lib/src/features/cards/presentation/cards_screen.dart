import 'package:flutter/material.dart';

import '../../../core/theme/proxim_theme.dart';
import '../../../core/widgets/transaction_tile.dart';

class CardsScreen extends StatefulWidget {
  const CardsScreen({super.key});

  @override
  State<CardsScreen> createState() => _CardsScreenState();
}

class _CardsScreenState extends State<CardsScreen> {
  bool _isFrozen = false;
  bool _showDetails = false;

  static const List<TransactionItem> _cardTransactions = [
    TransactionItem(
      id: 'ctx-1',
      title: 'Netflix Subscription',
      subtitle: 'Yesterday, 10:14 PM',
      amount: 19.99,
      type: TransactionType.sent,
    ),
    TransactionItem(
      id: 'ctx-2',
      title: 'Apple Store',
      subtitle: 'May 17, 2:45 PM',
      amount: 129.00,
      type: TransactionType.sent,
    ),
    TransactionItem(
      id: 'ctx-3',
      title: 'Card Top-up',
      subtitle: 'May 15, 9:00 AM',
      amount: 500.00,
      type: TransactionType.received,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 108),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
        // Title & Add Card button
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Cards',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                letterSpacing: -0.4,
              ),
            ),
            GestureDetector(
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Card issuance coming in Phase 5')),
                );
              },
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
                    Text(
                      'New Card',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: ProximColors.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Aurora Virtual Card Visual
        Container(
          height: 210,
          width: double.infinity,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: _isFrozen
                  ? [const Color(0xFF1B2230), const Color(0xFF101520)]
                  : [const Color(0xFF132A32), const Color(0xFF22174B)],
            ),
            border: Border.all(
              color: _isFrozen
                  ? ProximColors.hairlineBorder
                  : ProximColors.primary.withValues(alpha: 0.3),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: _isFrozen
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
              // Top row: Brand & Status pill
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Proxim Virtual',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      letterSpacing: 0.5,
                    ),
                  ),
                  if (_isFrozen)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(9999),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.ac_unit, size: 12, color: Colors.white),
                          SizedBox(width: 4),
                          Text(
                            'Frozen',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    const Icon(Icons.contactless, size: 24, color: Colors.white70),
                ],
              ),

              // Middle: Card Number
              Text(
                _showDetails ? '4829  5512  9041  4829' : '••••  ••••  ••••  4829',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  letterSpacing: 2.0,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),

              // Bottom Row: Holder, Expiry & Visa Logo
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'CARDHOLDER',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          color: ProximColors.onSurfaceVariant,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'ALEX RIVERA',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'EXPIRES',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          color: ProximColors.onSurfaceVariant,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _showDetails ? '08/29  CVV: 712' : '08/29',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                  ),
                  const Text(
                    'VISA',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      fontStyle: FontStyle.italic,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Quick Card Controls
        Row(
          children: [
            _buildControlTile(
              icon: _isFrozen ? Icons.lock_open : Icons.ac_unit,
              label: _isFrozen ? 'Unfreeze' : 'Freeze',
              isActive: _isFrozen,
              onTap: () {
                setState(() => _isFrozen = !_isFrozen);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      _isFrozen ? 'Card has been frozen.' : 'Card is now active.',
                    ),
                  ),
                );
              },
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
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Top up card coming in Phase 5')),
                );
              },
            ),
            const SizedBox(width: 8),
            _buildControlTile(
              icon: Icons.tune,
              label: 'Limits',
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Spending limits coming in Phase 5')),
                );
              },
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Recent Card Activity
        const Text(
          'Card Activity',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 12),
        ..._cardTransactions.map((tx) => TransactionTile(item: tx)),
      ],
    ),
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
            color: isActive
                ? ProximColors.primary.withValues(alpha: 0.15)
                : ProximColors.surfaceContainerLow,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isActive ? ProximColors.primary : ProximColors.hairlineBorder,
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                size: 20,
                color: isActive ? ProximColors.primary : Colors.white,
              ),
              const SizedBox(height: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: isActive ? ProximColors.primary : ProximColors.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
