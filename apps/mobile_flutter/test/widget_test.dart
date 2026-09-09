import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:proxim_app/src/app/app.dart';

void main() {
  testWidgets('ProximApp shows Treasury Dashboard by default in Business mode', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: ProximApp()));
    await tester.pumpAndSettle();

    // Verify Treasury Dashboard elements
    expect(find.text('Proxim'), findsOneWidget);
    expect(find.text('Acme Global Technologies Ltd'), findsOneWidget);
    expect(find.text('TOTAL OPERATIONAL LIQUIDITY'), findsOneWidget);
    expect(find.text('Batch Payroll'), findsOneWidget);
    expect(find.text('New Invoice'), findsOneWidget);
    expect(find.text('FX Convert'), findsOneWidget);
    expect(find.text('Treasury Wire'), findsOneWidget);
  });

  testWidgets('Top bar switcher toggles between Business Treasury and Personal banking', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: ProximApp()));
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
    await tester.pumpWidget(const ProviderScope(child: ProximApp()));
    await tester.pumpAndSettle();

    // 1. Activity tab
    await tester.tap(find.text('Activity'));
    await tester.pumpAndSettle();
    expect(find.text('Search transfers or contacts'), findsOneWidget);

    // 2. Invest tab
    await tester.tap(find.text('Invest'));
    await tester.pumpAndSettle();
    expect(find.text('PORTFOLIO VALUE'), findsOneWidget);

    // 3. Vault tab
    await tester.tap(find.text('Vault'));
    await tester.pumpAndSettle();
    expect(find.text('TOTAL IN VAULTS'), findsOneWidget);

    // 4. Cards tab
    await tester.tap(find.text('Cards'));
    await tester.pumpAndSettle();
    expect(find.text('Proxim Virtual'), findsOneWidget);

    // 5. Profile tab
    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();
    expect(find.text('Security PIN'), findsOneWidget);
  });
}
