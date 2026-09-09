import 'package:flutter/material.dart';

/// Constrains content to the app target width (440px) and centers it,
/// so phone, web, and Telegram Mini App layouts stay consistent.
class CenteredAppContainer extends StatelessWidget {
  const CenteredAppContainer({super.key, required this.child});

  static const double maxWidth = 440;

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}
