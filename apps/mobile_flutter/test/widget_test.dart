import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:proxim_app/src/app/app.dart';
import 'package:proxim_app/src/app/router.dart';

void main() {
  setUp(() {
    router.go('/');
  });

  testWidgets('ProximApp shows Treasury Dashboard by default in Business mode', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: ProximApp()));
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

    // 3. Savings tab
    await tester.tap(find.text('Savings'));
    await tester.pumpAndSettle();
    expect(find.text('TOTAL SAVINGS'), findsOneWidget);

    // 4. Cards tab
    await tester.tap(find.text('Cards'));
    await tester.pumpAndSettle();
    expect(find.text('Proxim Virtual'), findsOneWidget);

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

    await tester.pumpWidget(const ProviderScope(child: ProximApp()));
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

    // 3. Receive
    await tester.tap(find.text('Receive'));
    await tester.pumpAndSettle();
    expect(find.text('Receive & Deposit'), findsOneWidget);

    // Go back
    await tester.tap(find.byIcon(Icons.arrow_back).first);
    await tester.pumpAndSettle();

    // 4. Treasury Wire
    await tester.tap(find.text('Treasury Wire'));
    await tester.pumpAndSettle();
    expect(find.text('Transfer Execution'), findsOneWidget);
    expect(find.text('TREASURY TRANSFER'), findsOneWidget);
    expect(find.text('Send & Payout'), findsOneWidget);
  });
}
