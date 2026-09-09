import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/proxim_theme.dart';
import 'centered_app_container.dart';

enum AccountMode { personal, business }

/// Standard scaffold for all Proxim screens.
/// Enforces max-width: 440px, safe area padding, optional top header,
/// ambient aurora background blur circles, and floating bottom nav.
class ProximScaffold extends StatefulWidget {
  final Widget body;
  final Widget? bottomNavigationBar;
  final bool showHeader;
  final AccountMode initialMode;
  final ValueChanged<AccountMode>? onModeChanged;

  const ProximScaffold({
    super.key,
    required this.body,
    this.bottomNavigationBar,
    this.showHeader = true,
    this.initialMode = AccountMode.personal,
    this.onModeChanged,
  });

  @override
  State<ProximScaffold> createState() => _ProximScaffoldState();
}

class _ProximScaffoldState extends State<ProximScaffold> {
  late AccountMode _mode;

  @override
  void initState() {
    super.initState();
    _mode = widget.initialMode;
  }

  void _switchMode(AccountMode mode) {
    if (_mode == mode) return;
    setState(() => _mode = mode);
    widget.onModeChanged?.call(mode);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ProximColors.scaffoldBg,
      body: CenteredAppContainer(
        child: Stack(
          children: [
            // Ambient aurora glow background meshes
            Positioned(
              top: -60,
              left: -60,
              child: Container(
                width: 240,
                height: 240,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: ProximColors.primary.withValues(alpha: 0.08),
                ),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 70, sigmaY: 70),
                  child: const SizedBox.shrink(),
                ),
              ),
            ),
            Positioned(
              top: 40,
              right: -50,
              child: Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: ProximColors.secondary.withValues(alpha: 0.08),
                ),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 70, sigmaY: 70),
                  child: const SizedBox.shrink(),
                ),
              ),
            ),

            // Main content
            SafeArea(
              bottom: false,
              child: Column(
                children: [
                  if (widget.showHeader) _buildHeader(context),
                  Expanded(
                    child: widget.body,
                  ),
                ],
              ),
            ),

            // Floating bottom navigation bar if provided
            if (widget.bottomNavigationBar != null)
              widget.bottomNavigationBar!,
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(
        color: Color(0xCC0C1323),
        border: Border(
          bottom: BorderSide(color: Color(0x0AFFFFFF)),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Proxim Brand Title
          Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: ProximColors.auroraGradient,
                ),
                child: const Center(
                  child: Icon(
                    Icons.bolt,
                    size: 18,
                    color: ProximColors.surfaceContainerLowest,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Proxim',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ),

          // Personal / Business Switcher
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: ProximColors.surfaceContainerLow.withValues(alpha: 0.9),
              borderRadius: BorderRadius.circular(9999),
              border: Border.all(color: ProximColors.hairlineBorder),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildModeButton(
                  title: 'Personal',
                  isSelected: _mode == AccountMode.personal,
                  onTap: () => _switchMode(AccountMode.personal),
                ),
                _buildModeButton(
                  title: 'Business',
                  isSelected: _mode == AccountMode.business,
                  onTap: () => _switchMode(AccountMode.business),
                ),
              ],
            ),
          ),

          // Avatar / Profile Shortcut
          GestureDetector(
            onTap: () => context.go('/profile'),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ProximColors.surfaceContainerHigh,
                border: Border.all(color: ProximColors.hairlineBorder),
              ),
              child: const Center(
                child: Icon(
                  Icons.person,
                  size: 20,
                  color: ProximColors.onSurfaceVariant,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModeButton({
    required String title,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? ProximColors.surfaceContainerHighest : Colors.transparent,
          borderRadius: BorderRadius.circular(9999),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: ProximColors.primary.withValues(alpha: 0.15),
                    blurRadius: 8,
                  )
                ]
              : null,
        ),
        child: Text(
          title,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
            color: isSelected ? ProximColors.primary : ProximColors.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}
