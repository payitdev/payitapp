import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_guard.dart';
import '../core/widgets/proxim_bottom_nav.dart';
import '../core/widgets/proxim_scaffold.dart';
import '../features/activity/presentation/activity_screen.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/cards/presentation/cards_screen.dart';
import '../features/home/presentation/home_screen.dart';
import '../features/invest/presentation/invest_screen.dart';
import '../features/profile/presentation/profile_screen.dart';
import '../features/vault/presentation/vault_screen.dart';

import '../features/developer/presentation/developer_console_screen.dart';
import '../features/invoices/presentation/invoices_builder_screen.dart';
import '../features/invoices/presentation/payment_request_hub_screen.dart';
import '../features/invoices/presentation/public_invoice_checkout_screen.dart';
import '../features/payroll/presentation/batch_payroll_screen.dart';
import '../features/transfers/presentation/receive_deposit_screen.dart';
import '../features/transfers/presentation/send_payout_screen.dart';
import '../features/treasury/presentation/balance_sheet_cashflow_screen.dart';
import '../features/treasury/presentation/multi_sig_approvals_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

/// App router with persistent shell navigation across the 6 primary tabs
/// and dedicated full-screen routes for execution flows.
///
/// Auth guard: unauthenticated users are redirected to /login, except for
/// public routes (invoice checkout). [authGuard] is updated by AuthNotifier
/// and drives both the redirect and router refresh.
final router = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/',
  refreshListenable: authGuard,
  redirect: (context, state) {
    final loggedIn = authGuard.isAuthenticated;
    final location = state.matchedLocation;
    final onLogin = location == '/login';
    final isPublic = location.startsWith('/checkout');

    if (!loggedIn && !onLogin && !isPublic) return '/login';
    if (loggedIn && onLogin) return '/';
    return null;
  },
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
          path: '/savings',
          builder: (context, state) => const VaultScreen(),
        ),
        GoRoute(
          path: '/vault',
          redirect: (context, state) => '/savings',
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
      path: '/send',
      builder: (context, state) => const SendPayoutScreen(),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/receive',
      builder: (context, state) => const ReceiveDepositScreen(),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/payroll',
      builder: (context, state) => const BatchPayrollScreen(),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/invoices',
      builder: (context, state) => const InvoicesBuilderScreen(),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/payment-hub',
      builder: (context, state) => const PaymentRequestHubScreen(),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/multi-sig',
      builder: (context, state) => const MultiSigApprovalsScreen(),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/balance-sheet',
      builder: (context, state) => const BalanceSheetCashflowScreen(),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/developer',
      builder: (context, state) => const DeveloperConsoleScreen(),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/checkout/:id',
      builder: (context, state) {
        final id = state.pathParameters['id'] ?? 'INV-2026-095';
        return PublicInvoiceCheckoutScreen(invoiceId: id);
      },
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/login',
      builder: (context, state) => const LoginScreen(),
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
