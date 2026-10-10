import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/providers/account_mode_provider.dart';
import '../../../core/theme/proxim_theme.dart';
import '../../auth/presentation/auth_provider.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _biometricsEnabled = true;
  bool _notificationsEnabled = true;

  Future<void> _openHelpCenter() async {
    final uri = Uri.parse('https://t.me/proximsupport');
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open help center.')),
        );
      }
    }
  }

  void _showTermsOfService() {
    showModalBottomSheet(
      context: context,
      backgroundColor: ProximColors.surfaceContainerLow,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Terms of Service', style: ProximTextStyles.headlineSm()),
                const SizedBox(height: 12),
                Text(
                  'Proxim provides multi-currency payments, corporate treasury accounts, yield vaults, and digital asset settlements in compliance with applicable financial regulations.',
                  style: ProximTextStyles.bodySm(),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ProximColors.primary,
                      foregroundColor: ProximColors.surfaceContainerLowest,
                    ),
                    child: const Text('Close'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final mode = ref.watch(accountModeProvider);
    final user = ref.watch(currentUserProvider);
    final entity = ref.watch(activeEntityProvider);
    final displayName = user?.fullName ?? '';
    final email = user?.email ?? '';
    final isBusiness = mode == AccountMode.business;
    final dueStatus = entity?.dueStatus;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 108),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title
          const Text(
            'Profile',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 16),

          // User Identity Card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: ProximColors.hairlineBorder),
            ),
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: ProximColors.surfaceContainerHigh,
                    border: Border.all(color: ProximColors.primary.withValues(alpha: 0.4)),
                  ),
                  child: Center(
                    child: displayName.isNotEmpty
                        ? Text(
                            displayName[0].toUpperCase(),
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.person_outline, size: 24, color: ProximColors.onSurfaceVariant),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: displayName.isEmpty
                                ? _placeholderBar(width: 120, height: 14)
                                : Text(
                                    displayName,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                    ),
                                  ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: ProximColors.tertiary.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(9999),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.verified, size: 10, color: ProximColors.tertiary),
                                const SizedBox(width: 3),
                                Text(
                                  isBusiness ? 'Business' : 'Personal',
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: ProximColors.tertiary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      email.isEmpty
                          ? _placeholderBar(width: 170, height: 10)
                          : Text(
                              email,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 12,
                                color: ProximColors.onSurfaceVariant,
                              ),
                            ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Account Section (PRS Spec §7.11)
          const Text(
            'Account',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 10),
          _buildSettingsGroup([
            _buildSettingsTile(
              icon: Icons.sync_alt,
              title: 'Account Type',
              subtitle: isBusiness ? 'Corporate Business Account' : 'Personal Banking Account',
              trailing: GestureDetector(
                onTap: () {
                  final newMode = isBusiness ? AccountMode.personal : AccountMode.business;
                  ref.read(accountModeProvider.notifier).setMode(newMode);
                  ref.read(authProvider.notifier).setMode(!isBusiness);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: ProximColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(9999),
                    border: Border.all(color: ProximColors.primary.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    'Switch',
                    style: ProximTextStyles.labelXs(color: ProximColors.primary).copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              onTap: () {
                final newMode = isBusiness ? AccountMode.personal : AccountMode.business;
                ref.read(accountModeProvider.notifier).setMode(newMode);
                ref.read(authProvider.notifier).setMode(!isBusiness);
              },
            ),
            _buildSettingsTile(
              icon: Icons.verified_user_outlined,
              title: 'Identity Verification',
              subtitle: _verificationSubtitle(dueStatus, entity?.kycTierLabel),
              trailing: _verificationChip(dueStatus),
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      dueStatus == 'approved'
                          ? 'Identity verified. All features unlocked.'
                          : 'Identity verification is coming soon.',
                    ),
                  ),
                );
              },
            ),
          ]),
          const SizedBox(height: 24),

          // Security Section
          const Text(
            'Security',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 10),
          _buildSettingsGroup([
            _buildSettingsTile(
              icon: Icons.pin_outlined,
              title: 'Security PIN',
              subtitle: 'Change your 6-digit transaction passcode',
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Passcode setup coming in Phase 4')),
                );
              },
            ),
            _buildSwitchTile(
              icon: Icons.fingerprint,
              title: 'Biometric Unlock',
              subtitle: 'Use Face ID / Touch ID to authenticate',
              value: _biometricsEnabled,
              onChanged: (val) => setState(() => _biometricsEnabled = val),
            ),
          ]),
          const SizedBox(height: 24),

          // Preferences Section
          const Text(
            'Preferences',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 10),
          _buildSettingsGroup([
            _buildSwitchTile(
              icon: Icons.notifications_none,
              title: 'Payment Alerts',
              subtitle: 'Instant push notifications for transfers',
              value: _notificationsEnabled,
              onChanged: (val) => setState(() => _notificationsEnabled = val),
            ),
            _buildSettingsTile(
              icon: Icons.download_outlined,
              title: 'Account Statements',
              subtitle: 'Export PDF & CSV monthly statements',
              onTap: () {},
            ),
          ]),
          const SizedBox(height: 24),

          // Integrations Section
          const Text(
            'Integrations',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 10),
          _buildSettingsGroup([
            _buildSettingsTile(
              icon: Icons.send,
              title: 'Telegram Account',
              subtitle: 'Not connected',
            ),
            _buildSettingsTile(
              icon: Icons.code,
              title: 'Developer & API Hub',
              subtitle: 'Programmatic treasury, API keys & webhooks',
              trailing: const Icon(Icons.chevron_right, size: 18, color: ProximColors.onSurfaceVariant),
              onTap: () => context.push('/developer'),
            ),
          ]),
          const SizedBox(height: 24),

          // Support Section (PRS Spec §7.11)
          const Text(
            'Support',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 10),
          _buildSettingsGroup([
            _buildSettingsTile(
              icon: Icons.help_outline,
              title: 'Help Center',
              subtitle: 'Live support via Telegram (@proximsupport)',
              onTap: _openHelpCenter,
            ),
            _buildSettingsTile(
              icon: Icons.description_outlined,
              title: 'Terms of Service',
              subtitle: 'User agreement and service policies',
              onTap: _showTermsOfService,
            ),
          ]),
          const SizedBox(height: 28),

          // Sign Out Button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton(
              onPressed: () async {
                await ref.read(authProvider.notifier).logout();
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: ProximColors.error,
                side: BorderSide(color: ProximColors.error.withValues(alpha: 0.3)),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.logout, size: 16),
                  SizedBox(width: 8),
                  Text(
                    'Sign Out',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Loading placeholder bar shown while the session / profile is still loading —
  // never a fabricated name or email.
  Widget _placeholderBar({required double width, required double height}) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(6),
      ),
    );
  }

  String _verificationSubtitle(String? dueStatus, String? tierLabel) {
    return switch (dueStatus) {
      'approved' => '${tierLabel ?? 'Verified'} · Verified Account',
      'pending' || 'under_review' => 'Verification in review',
      'rejected' => 'Verification rejected',
      _ => 'Not verified',
    };
  }

  Widget? _verificationChip(String? dueStatus) {
    Widget chip({required Color color, required String label}) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(9999),
          ),
          child: Text(label, style: ProximTextStyles.labelXs(color: color)),
        );

    return switch (dueStatus) {
      'approved' => chip(color: ProximColors.statusSuccess, label: 'Verified'),
      'pending' || 'under_review' => chip(color: ProximColors.statusWarning, label: 'In review'),
      'rejected' => chip(color: ProximColors.error, label: 'Rejected'),
      _ => null,
    };
  }

  Widget _buildSettingsGroup(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: ProximColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: ProximColors.subtleBorder),
      ),
      child: Column(children: children),
    );
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required String title,
    required String subtitle,
    Widget? trailing,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: ProximColors.surfaceContainer,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Icon(icon, size: 18, color: ProximColors.onSurfaceVariant),
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
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 11,
                      color: ProximColors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            trailing ??
                const Icon(
                  Icons.chevron_right,
                  size: 18,
                  color: ProximColors.onSurfaceVariant,
                ),
          ],
        ),
      ),
    );
  }

  Widget _buildSwitchTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainer,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Icon(icon, size: 18, color: ProximColors.onSurfaceVariant),
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
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 11,
                    color: ProximColors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Switch.adaptive(
            value: value,
            onChanged: onChanged,
            activeTrackColor: ProximColors.primary,
          ),
        ],
      ),
    );
  }
}
