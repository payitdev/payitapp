import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/proxim_theme.dart';

class QuickActionButtons extends StatelessWidget {
  final VoidCallback? onSend;
  final VoidCallback? onReceive;
  final VoidCallback? onRequest;
  final VoidCallback? onVault;

  const QuickActionButtons({
    super.key,
    this.onSend,
    this.onReceive,
    this.onRequest,
    this.onVault,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        // Send (Primary CTA with vibrant gradient)
        _buildActionButton(
          context: context,
          label: 'Send',
          icon: Icons.north_east,
          isPrimary: true,
          onTap: onSend ??
              () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Send money sheet coming in Phase 5')),
                );
              },
        ),

        // Receive
        _buildActionButton(
          context: context,
          label: 'Receive',
          icon: Icons.south_west,
          onTap: onReceive ??
              () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Receive deposit options coming in Phase 5')),
                );
              },
        ),

        // Request
        _buildActionButton(
          context: context,
          label: 'Request',
          icon: Icons.call_split,
          onTap: onRequest ??
              () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Payment request hub coming in Phase 5')),
                );
              },
        ),

        // Vault
        _buildActionButton(
          context: context,
          label: 'Vault',
          icon: Icons.lock_outline,
          iconColor: ProximColors.tertiary,
          onTap: onVault ?? () => context.go('/vault'),
        ),
      ],
    );
  }

  Widget _buildActionButton({
    required BuildContext context,
    required String label,
    required IconData icon,
    required VoidCallback onTap,
    bool isPrimary = false,
    Color? iconColor,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Column(
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                gradient: isPrimary ? ProximColors.primaryCtaGradient : null,
                color: isPrimary ? null : ProximColors.surfaceContainerLow,
                border: isPrimary ? null : Border.all(color: ProximColors.hairlineBorder),
                boxShadow: isPrimary
                    ? [
                        BoxShadow(
                          color: ProximColors.primary.withValues(alpha: 0.3),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                        ),
                      ]
                    : null,
              ),
              child: Center(
                child: Icon(
                  icon,
                  size: 22,
                  color: isPrimary
                      ? ProximColors.surfaceContainerLowest
                      : (iconColor ?? Colors.white.withValues(alpha: 0.9)),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: isPrimary ? Colors.white : ProximColors.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
