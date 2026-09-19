import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:proxim_app/src/core/config/app_config.dart';
import 'package:proxim_app/src/core/widgets/proxim_bottom_nav.dart';
import 'package:proxim_app/src/features/auth/presentation/auth_provider.dart';
import 'package:proxim_app/src/features/auth/presentation/login_screen.dart';

/// Inert auth notifier for the login screen: Privy calls are stubbed to
/// succeed so the widget flow (email step → code step) can be exercised
/// without a backend or Privy SDK.
class _FakeAuthNotifier extends AuthNotifier {
  @override
  AuthState build() => const AuthState();

  @override
  Future<bool> sendEmailCode(String email) async => true;

  @override
  Future<bool> loginWithEmailCode({
    required String email,
    required String code,
  }) async =>
      true;
}

Future<void> pumpLoginScreen(WidgetTester tester) {
  return tester.pumpWidget(
    ProviderScope(
      overrides: [authProvider.overrideWith(() => _FakeAuthNotifier())],
      child: const MaterialApp(home: LoginScreen()),
    ),
  );
}

void main() {
  setUp(() {
    // Pretend Privy is configured so the email CTA is enabled.
    AppConfig.privyAppId = 'test-app-id';
  });

  tearDown(() {
    AppConfig.privyAppId = '';
  });

  testWidgets('Login renders the email step without any navigation chrome',
      (tester) async {
    await pumpLoginScreen(tester);
    await tester.pumpAndSettle();

    expect(find.text('Welcome to Proxim'), findsOneWidget);
    expect(find.text('Continue with Email'), findsOneWidget);
    expect(find.text('OR CONTINUE WITH'), findsOneWidget);

    // Auth flow must not show the shell's bottom nav (or any top bar).
    expect(find.byType(ProximBottomNav), findsNothing);
    expect(find.byType(AppBar), findsNothing);
  });

  testWidgets('Invalid email shows a SnackBar and stays on the email step',
      (tester) async {
    await pumpLoginScreen(tester);
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, 'not-an-email');
    await tester.pump();
    await tester.ensureVisible(find.text('Continue with Email'));
    await tester.tap(find.text('Continue with Email'));
    await tester.pump();

    expect(find.text('Please enter a valid email address.'), findsOneWidget);
    expect(find.text('Welcome to Proxim'), findsOneWidget);
  });

  testWidgets('Valid email advances to the 6-digit code step', (tester) async {
    await pumpLoginScreen(tester);
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, 'user@example.com');
    await tester.pump();
    await tester.ensureVisible(find.text('Continue with Email'));
    await tester.tap(find.text('Continue with Email'));
    await tester.pumpAndSettle();

    expect(find.text('STEP 2 OF 2'), findsOneWidget);
    expect(
      find.textContaining(
        'We sent a 6-digit verification code to',
        findRichText: true,
      ),
      findsOneWidget,
    );
    expect(find.text('PROTECTED BY PRIVY SESSION VAULT • ZERO-KNOWLEDGE RECOVERY'), findsOneWidget);
  });
}
