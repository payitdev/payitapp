import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/widgets/centered_app_container.dart';
import '../core/widgets/proxim_bottom_nav.dart';
import '../core/widgets/proxim_scaffold.dart';
import '../features/activity/presentation/activity_screen.dart';
import '../features/cards/presentation/cards_screen.dart';
import '../features/home/presentation/home_screen.dart';
import '../features/invest/presentation/invest_screen.dart';
import '../features/profile/presentation/profile_screen.dart';
import '../features/vault/presentation/vault_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

/// App router with persistent shell navigation across the 6 primary tabs.
final router = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/',
  routes: [
    ShellRoute(
      navigatorKey: _shellNavigatorKey,
      builder: (context, state, child) {
        return _AppShell(
          currentPath: state.uri.path,
          child: child,
        );
      },
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const HomeScreen(),
        ),
        GoRoute(
          path: '/activity',
          builder: (context, state) => const ActivityScreen(),
        ),
        GoRoute(
          path: '/invest',
          builder: (context, state) => const InvestScreen(),
        ),
        GoRoute(
          path: '/vault',
          builder: (context, state) => const VaultScreen(),
        ),
        GoRoute(
          path: '/cards',
          builder: (context, state) => const CardsScreen(),
        ),
        GoRoute(
          path: '/profile',
          builder: (context, state) => const ProfileScreen(),
        ),
      ],
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/login',
      builder: (context, state) => const _LoginPlaceholderScreen(),
    ),
  ],
);

class _AppShell extends StatelessWidget {
  final String currentPath;
  final Widget child;

  const _AppShell({
    required this.currentPath,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return ProximScaffold(
      bottomNavigationBar: ProximBottomNav(currentPath: currentPath),
      body: child,
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
