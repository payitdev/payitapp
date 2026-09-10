import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/proxim_theme.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _biometricsEnabled = true;
  bool _notificationsEnabled = true;

  @override
  Widget build(BuildContext context) {
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
                child: const Center(
                  child: Icon(
                    Icons.person,
                    size: 28,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Text(
                          'Alex Rivera',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: ProximColors.tertiary.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(9999),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.verified, size: 10, color: ProximColors.tertiary),
                              SizedBox(width: 3),
                              Text(
                                'Tier 1',
                                style: TextStyle(
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
                    const Text(
                      'alex.rivera@proxim.app',
                      style: TextStyle(
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
          _buildSettingsTile(
            icon: Icons.currency_exchange,
            title: 'Default Currency',
            subtitle: 'USD (\$)',
            onTap: () {},
          ),
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
            subtitle: 'Connected as @alex_rivera',
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: ProximColors.primary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(9999),
              ),
              child: const Text(
                'Linked',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: ProximColors.primary,
                ),
              ),
            ),
            onTap: () {},
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

        // Sign Out Button
        SizedBox(
          width: double.infinity,
          height: 48,
          child: OutlinedButton(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("You've been signed out.")),
              );
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
