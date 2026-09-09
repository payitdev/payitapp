import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/proxim_theme.dart';
import 'router.dart';

class ProximApp extends ConsumerWidget {
  const ProximApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Proxim',
      debugShowCheckedModeBanner: false,
      theme: ProximTheme.darkTheme,
      routerConfig: router,
    );
  }
}
