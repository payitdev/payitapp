import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/proxim_theme.dart';

class ProximNavItem {
  final String label;
  final IconData icon;
  final String path;

  const ProximNavItem({
    required this.label,
    required this.icon,
    required this.path,
  });
}

class ProximBottomNav extends StatelessWidget {
  final String currentPath;

  const ProximBottomNav({
    super.key,
    required this.currentPath,
  });

  static const List<ProximNavItem> items = [
    ProximNavItem(label: 'Home', icon: Icons.account_balance, path: '/'),
    ProximNavItem(label: 'Activity', icon: Icons.sync_alt, path: '/activity'),
    ProximNavItem(label: 'Invest', icon: Icons.trending_up, path: '/invest'),
    ProximNavItem(label: 'Vault', icon: Icons.lock_outline, path: '/vault'),
    ProximNavItem(label: 'Cards', icon: Icons.credit_card, path: '/cards'),
    ProximNavItem(label: 'Profile', icon: Icons.account_circle_outlined, path: '/profile'),
  ];

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.bottomCenter,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(9999),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
              child: Container(
                height: 64,
                decoration: BoxDecoration(
                  color: ProximColors.surfaceContainerLowest.withValues(alpha: 0.92),
                  borderRadius: BorderRadius.circular(9999),
                  border: Border.all(color: ProximColors.elevatedBorder),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.5),
                      blurRadius: 28,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: Row(
                  children: items.map((item) {
                    final isSelected = item.path == '/'
                        ? currentPath == '/'
                        : currentPath.startsWith(item.path);

                    return Expanded(
                      child: _NavItemButton(
                        item: item,
                        isSelected: isSelected,
                        onTap: () {
                          if (currentPath != item.path) {
                            context.go(item.path);
                          }
                        },
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItemButton extends StatelessWidget {
  final ProximNavItem item;
  final bool isSelected;
  final VoidCallback onTap;

  const _NavItemButton({
    required this.item,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final activeColor = ProximColors.primary;
    final inactiveColor = ProximColors.onSurfaceVariant;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(9999),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            child: Icon(
              item.icon,
              size: 20,
              color: isSelected ? activeColor : inactiveColor,
              shadows: isSelected
                  ? [
                      Shadow(
                        color: activeColor.withValues(alpha: 0.7),
                        blurRadius: 10,
                      )
                    ]
                  : null,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            item.label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
              color: isSelected ? activeColor : inactiveColor,
              letterSpacing: -0.2,
            ),
          ),
        ],
      ),
    );
  }
}
