import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:proxim_app/src/app/app.dart';
import 'package:proxim_app/src/app/router.dart';
import 'package:proxim_app/src/core/auth/auth_guard.dart';
import 'package:proxim_app/src/features/auth/domain/auth_models.dart';
import 'package:proxim_app/src/features/auth/presentation/auth_provider.dart';
import 'package:proxim_app/src/features/cards/domain/card_models.dart';
import 'package:proxim_app/src/features/cards/presentation/cards_provider.dart';

/// Auth notifier that stays inert (no session restore, no Privy calls) but
/// provides a realistic two-entity user so screens render their real,
/// data-driven UI instead of demo fallbacks — which no longer exist outside
/// DEMO_MODE. The router guard is authenticated in setUp. Entity switching is
/// handled locally because the real implementation needs the repository,
/// which this fake never initializes.
class _FakeAuthNotifier extends AuthNotifier {
  static const _businessEntityId = 'ent-business-1';
  static const _personalEntityId = 'ent-personal-1';

  static const _user = ProximUser(
    id: 'user-test-1',
    email: 'finance@acmeglobal.io',
    fullName: 'Alex Rivera',
    activeEntityId: _businessEntityId,
    entities: [
      ProximEntity(
        id: _businessEntityId,
        userId: 'user-test-1',
        kind: 'BUSINESS',
        legalName: 'Acme Global Technologies Ltd',
        businessTag: 'ACM-884920-CORP',
        dueStatus: 'approved',
      ),
      ProximEntity(
        id: _personalEntityId,
        userId: 'user-test-1',
        kind: 'PERSONAL',
        legalName: 'Alex Rivera',
      ),
    ],
  );

  @override
  AuthState build() => const AuthState(user: _user, activeEntityId: _businessEntityId);

  @override
  Future<void> setMode(bool isBusiness) async {
    state = state.copyWith(
      activeEntityId: isBusiness ? _businessEntityId : _personalEntityId,
    );
  }

  @override
  Future<void> toggleEntityMode() async {
    final isBusiness = state.activeEntityId == _businessEntityId;
    return setMode(!isBusiness);
  }

  @override
  Future<void> selectEntity(String entityId) async {
    state = state.copyWith(activeEntityId: entityId);
  }
}

Future<void> pumpProximApp(WidgetTester tester) {
  return tester.pumpWidget(
    ProviderScope(
      overrides: [authProvider.overrideWith(() => _FakeAuthNotifier())],
      child: const ProximApp(),
    ),
  );
}

/// pumpAndSettle hangs on screens with a live countdown ticker (the FX quote
/// timer on receive/send). Bounded pumps let those screens settle their async
/// work without waiting for a ticker that never stops.
Future<void> pumpWithLiveTimers(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 400));
  }
}

void main() {
  setUp(() {
    authGuard.setAuthenticated(true);
    router.go('/');
  });

  tearDown(() {
    authGuard.setAuthenticated(false);
  });

  testWidgets('ProximApp shows Treasury Dashboard by default in Business mode', (tester) async {
    await pumpProximApp(tester);
    await tester.pumpAndSettle();

    // Verify Treasury Dashboard elements
    expect(find.text('Proxim'), findsOneWidget);
    expect(find.text('Acme Global Technologies Ltd'), findsOneWidget);
    expect(find.text('Balance'), findsOneWidget);
    expect(find.text('Batch Payroll'), findsOneWidget);
    expect(find.text('New Invoice'), findsOneWidget);
    expect(find.text('Receive'), findsOneWidget);
    expect(find.text('Treasury Wire'), findsOneWidget);
  });

  testWidgets('Top bar switcher toggles between Business Treasury and Personal banking', (tester) async {
    await pumpProximApp(tester);
    await tester.pumpAndSettle();

    // Defaults to Business
    expect(find.text('Acme Global Technologies Ltd'), findsOneWidget);

    // Tap Personal
    await tester.tap(find.text('Personal'));
    await tester.pumpAndSettle();

    // Verify Personal screen elements
    expect(find.text('Alex Rivera'), findsOneWidget);
    expect(find.text('Send'), findsOneWidget);
    expect(find.text('Receive'), findsOneWidget);

    // Tap Business again
    await tester.tap(find.text('Business'));
    await tester.pumpAndSettle();

    // Back to Treasury
    expect(find.text('Acme Global Technologies Ltd'), findsOneWidget);
  });

  testWidgets('Bottom navigation switches across all 6 primary tabs', (tester) async {
    // Cards has no backend in tests, so force its provider to fail and assert
    // the real error state renders (live socket hangs never resolve inside the
    // fake-async test zone). ProviderScope must be pumped once — Riverpod
    // rejects changing the override count on rebuild.
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authProvider.overrideWith(() => _FakeAuthNotifier()),
          cardsListProvider.overrideWith(
            (ref) => Future<List<ProximCard>>.error(StateError('no backend')),
          ),
        ],
        child: const ProximApp(),
      ),
    );
    await tester.pumpAndSettle();

    // 1. Activity tab
    await tester.tap(find.text('Activity'));
    await tester.pumpAndSettle();
    expect(find.text('Search transfers or contacts'), findsOneWidget);

    // 2. Invest tab
    await tester.tap(find.text('Invest'));
    await tester.pumpAndSettle();
    expect(find.text('PORTFOLIO VALUE'), findsOneWidget);

    // 3. Savings tab
    await tester.tap(find.text('Savings'));
    await tester.pumpAndSettle();
    expect(find.text('TOTAL SAVINGS'), findsOneWidget);

    // 4. Cards tab renders its error state when the fetch fails
    await tester.tap(find.text('Cards'));
    await tester.pumpAndSettle();
    expect(find.text('Unable to load cards.'), findsOneWidget);

    // 5. Profile tab
    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();
    expect(find.text('Security PIN'), findsOneWidget);
    expect(find.text('Developer & API Hub'), findsOneWidget);
  });

  testWidgets('Corporate Quick Bar opens execution screens', (tester) async {
    tester.view.physicalSize = const Size(800, 1800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    await pumpProximApp(tester);
    await tester.pumpAndSettle();

    // 1. Batch Payroll
    await tester.tap(find.text('Batch Payroll'));
    await tester.pumpAndSettle();
    expect(find.text('Batch Payroll Execution'), findsOneWidget);
    expect(find.text('Upload CSV'), findsOneWidget);
    expect(find.text('David Miller'), findsOneWidget);

    // Go back
    await tester.tap(find.byIcon(Icons.arrow_back).first);
    await tester.pumpAndSettle();

    // 2. New Invoice
    await tester.tap(find.text('New Invoice'));
    await tester.pumpAndSettle();
    expect(find.text('Invoices & Billing'), findsOneWidget);
    expect(find.text('Instant Flow Builder'), findsOneWidget);

    // Go back
    await tester.tap(find.byIcon(Icons.arrow_back).first);
    await tester.pumpAndSettle();

    // 3. Receive — has a live FX-countdown ticker, so bounded pumps
    await tester.tap(find.text('Receive'));
    await pumpWithLiveTimers(tester);
    expect(find.text('Receive & Deposit'), findsOneWidget);

    // Go back
    await tester.tap(find.byIcon(Icons.arrow_back).first);
    await tester.pumpAndSettle();

    // 4. Treasury Wire
    await tester.tap(find.text('Treasury Wire'));
    await pumpWithLiveTimers(tester);
    expect(find.text('Transfer Execution'), findsOneWidget);
    expect(find.text('TREASURY TRANSFER'), findsOneWidget);
    expect(find.text('Send & Payout'), findsOneWidget);
  });
}
