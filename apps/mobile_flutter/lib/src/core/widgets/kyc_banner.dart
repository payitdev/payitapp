import 'package:flutter/material.dart';

import '../theme/proxim_theme.dart';

enum KycBannerState { unverified, pending, approved }

/// KYC Status Banner conforming strictly to PRS Spec §7.1:
/// - Unverified: "Unlock your Naira account — Verify your identity in 60 seconds" + Verify ID button
/// - Pending: "Verification in review — Your bank accounts will activate once confirmed."
/// - Approved: "Verified Personal Account — Tier 1 · Bank accounts active" + Verified chip
class KycBanner extends StatelessWidget {
  final KycBannerState status;
  final VoidCallback? onVerify;

  const KycBanner({
    super.key,
    this.status = KycBannerState.unverified,
    this.onVerify,
  });

  @override
  Widget build(BuildContext context) {
    final title = switch (status) {
      KycBannerState.unverified => 'Unlock your Naira account',
      KycBannerState.pending => 'Verification in review',
      KycBannerState.approved => 'Verified Personal Account',
    };

    final subtitle = switch (status) {
      KycBannerState.unverified => 'Verify your identity in 60 seconds',
      KycBannerState.pending => 'Your bank accounts will activate once confirmed.',
      KycBannerState.approved => 'Tier 1 · Bank accounts active',
    };

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
              color: status == KycBannerState.approved
                  ? ProximColors.statusSuccess.withValues(alpha: 0.15)
                  : ProximColors.primary.withValues(alpha: 0.12),
            ),
            child: Center(
              child: Icon(
                status == KycBannerState.approved
                    ? Icons.verified
                    : Icons.verified_user_outlined,
                size: 20,
                color: status == KycBannerState.approved
                    ? ProximColors.statusSuccess
                    : ProximColors.primary,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 11,
                    color: ProximColors.onSurfaceVariant,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          if (status == KycBannerState.unverified)
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
                  'Verify ID',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: ProximColors.primary,
                  ),
                ),
              ),
            )
          else if (status == KycBannerState.approved)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: ProximColors.statusSuccess.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(9999),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check, size: 12, color: ProximColors.statusSuccess),
                  const SizedBox(width: 4),
                  Text(
                    'Verified',
                    style: ProximTextStyles.labelXs(color: ProximColors.statusSuccess).copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: ProximColors.statusWarning.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(9999),
              ),
              child: Text(
                'In review',
                style: ProximTextStyles.labelXs(color: ProximColors.statusWarning),
              ),
            ),
        ],
      ),
    );
  }
}
