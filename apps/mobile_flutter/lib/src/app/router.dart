import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/widgets/centered_app_container.dart';
import '../features/home/presentation/home_screen.dart';

/// App router. Redirects/auth guards come in a later phase (Phase 4).
final router = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const HomeShell(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const _LoginPlaceholderScreen(),
    ),
  ],
);

/// Placeholder shell: wraps every tab/screen in the 440px-max-width
/// centered container. Bottom navigation arrives with Phase 2 screens.
class HomeShell extends StatelessWidget {
  const HomeShell({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: CenteredAppContainer(
        child: HomeScreen(),
      ),
    );
  }
}

class _LoginPlaceholderScreen extends StatelessWidget {
  const _LoginPlaceholderScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: CenteredAppContainer(
        child: Center(child: Text('Login — coming in Phase 4')),
      ),
    );
  }
}
