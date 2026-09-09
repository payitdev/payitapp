import 'package:flutter/material.dart';

import '../../../core/config/app_config.dart';

/// Placeholder home screen. Verifies the dart-define config wiring:
/// shows the app name and the configured API base URL.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Proxim', style: theme.textTheme.displayMedium),
          const SizedBox(height: 12),
          Text(
            'API: ${AppConfig.apiBaseUrl}',
            style: theme.textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}
