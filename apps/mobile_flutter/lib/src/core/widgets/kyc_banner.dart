import 'package:flutter/material.dart';

import '../theme/proxim_theme.dart';

class KycBanner extends StatelessWidget {
  final VoidCallback? onVerify;

  const KycBanner({
    super.key,
    this.onVerify,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ProximColors.hairlineBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: ProximColors.primary.withValues(alpha: 0.12),
            ),
            child: const Center(
              child: Icon(
                Icons.verified_user_outlined,
                size: 20,
                color: ProximColors.primary,
              ),
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Unlock full account features',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Verify your identity to unlock higher limits and international transfers.',
                  style: TextStyle(
                    fontSize: 11,
                    color: ProximColors.onSurfaceVariant,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: onVerify ??
                () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Identity verification coming in Phase 5')),
                  );
                },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: ProximColors.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(9999),
                border: Border.all(color: ProximColors.hairlineBorder),
              ),
              child: const Text(
                'Verify',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: ProximColors.primary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
