import 'package:flutter/material.dart';

/// Responsive container that adapts content cleanly across all form factors and screen sizes:
/// - Compact phones (< 540px): 100% natural width
/// - Large phones / Foldables (540px - 768px): up to 580px width
/// - Tablets / Desktop / Web (>= 768px): up to 680px (or custom [maxWidth])
///
/// Ensures full vertical expansion ([minHeight: constraints.maxHeight])
/// so scroll views, backgrounds, and full-height layouts never collapse or float awkwardly.
class CenteredAppContainer extends StatelessWidget {
  final Widget child;
  final double? maxWidth;
  final EdgeInsetsGeometry? padding;

  const CenteredAppContainer({
    super.key,
    required this.child,
    this.maxWidth,
    this.padding,
  });

  /// Legacy default preserved for backward compatibility.
  static const double defaultMaxWidth = 440;

  /// Dynamic responsive breakpoint resolver.
  static double resolveMaxWidth(double screenWidth) {
    if (screenWidth < 540) {
      return double.infinity;
    } else if (screenWidth < 768) {
      return 580.0;
    } else if (screenWidth < 1024) {
      return 680.0;
    } else {
      return 740.0;
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final screenWidth = constraints.maxWidth;
        final targetMaxWidth = maxWidth ?? resolveMaxWidth(screenWidth);

        Widget content = ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: targetMaxWidth,
            minHeight: constraints.maxHeight,
          ),
          child: child,
        );

        if (padding != null) {
          content = Padding(padding: padding!, child: content);
        }

        return Align(
          alignment: Alignment.topCenter,
          child: content,
        );
      },
    );
  }
}
