import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:proxim_app/src/app/app.dart';

void main() {
  testWidgets('ProximApp smoke test shows app name', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: ProximApp()));
    expect(find.text('Proxim'), findsOneWidget);
  });
}
