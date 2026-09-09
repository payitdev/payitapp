import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:proxim_app/src/app/app.dart';

void main() {
  testWidgets('ProximApp smoke test shows app brand and home screen', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: ProximApp()));
    await tester.pumpAndSettle();

    // Verify brand title and welcome greeting
    expect(find.text('Proxim'), findsOneWidget);
    expect(find.text('Alex Rivera'), findsOneWidget);
    expect(find.text('TOTAL BALANCE'), findsOneWidget);
    expect(find.text('Send'), findsOneWidget);
    expect(find.text('Receive'), findsOneWidget);
  });

  testWidgets('Bottom navigation switches between all 6 primary screens', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: ProximApp()));
    await tester.pumpAndSettle();

    // 1. Home tab active
    expect(find.text('Recent Activity'), findsOneWidget);

    // 2. Tap Activity tab
    await tester.tap(find.text('Activity'));
    await tester.pumpAndSettle();
    expect(find.text('Search transfers or contacts'), findsOneWidget);
    expect(find.text('Received'), findsWidgets);

    // 3. Tap Invest tab
    await tester.tap(find.text('Invest'));
    await tester.pumpAndSettle();
    expect(find.text('PORTFOLIO VALUE'), findsOneWidget);
    expect(find.text('Review Order'), findsOneWidget);

    // 4. Tap Vault tab
    await tester.tap(find.text('Vault'));
    await tester.pumpAndSettle();
    expect(find.text('TOTAL IN VAULTS'), findsOneWidget);
    expect(find.text('Lock & Earn'), findsOneWidget);

    // 5. Tap Cards tab
    await tester.tap(find.text('Cards'));
    await tester.pumpAndSettle();
    expect(find.text('Proxim Virtual'), findsOneWidget);
    expect(find.text('Card Activity'), findsOneWidget);

    // 6. Tap Profile tab
    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();
    expect(find.text('Security PIN'), findsOneWidget);
    expect(find.text('Sign Out'), findsOneWidget);
  });
}
