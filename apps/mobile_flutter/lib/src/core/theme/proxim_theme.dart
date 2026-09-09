import 'package:flutter/material.dart';

/// Proxim design tokens (dark-only). Source: proxim_app_specification.md
/// section 12 / Stitch exports.
class ProximColors {
  const ProximColors._();

  /// --bg-app
  static const Color scaffoldBg = Color(0xFF061B18);

  /// --surface
  static const Color surface = Color(0xFF0D1424);

  /// --surface-alt
  static const Color surfaceAlt = Color(0xFF0B2924);

  /// --bg-deep
  static const Color deepBg = Color(0xFF050811);

  /// Aurora gradient endpoints.
  static const Color auroraTeal = Color(0xFF35D9D0);
  static const Color auroraViolet = Color(0xFF7567F8);

  /// Hairline borders: rgba(255, 255, 255, 0.06)
  static const Color hairlineBorder = Color(0x0FFFFFFF);

  /// Signature aurora gradient (#35D9D0 -> #7567F8).
  static const LinearGradient auroraGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [auroraTeal, auroraViolet],
  );
}

/// Typography scale: 11 / 13 / 15 / 20 / 24 / 34 / 42.
/// Fonts (Bricolage Grotesque / Satoshi) are bundled in a later phase;
/// until then these fall back to the platform default.
class ProximTextStyles {
  const ProximTextStyles._();

  static const TextStyle s11 = TextStyle(fontSize: 11, color: Colors.white);
  static const TextStyle s13 = TextStyle(fontSize: 13, color: Colors.white);
  static const TextStyle s15 = TextStyle(fontSize: 15, color: Colors.white);
  static const TextStyle s20 = TextStyle(fontSize: 20, color: Colors.white);
  static const TextStyle s24 = TextStyle(
    fontSize: 24,
    color: Colors.white,
    fontWeight: FontWeight.w600,
  );
  static const TextStyle s34 = TextStyle(
    fontSize: 34,
    color: Colors.white,
    fontWeight: FontWeight.w600,
  );
  static const TextStyle s42 = TextStyle(
    fontSize: 42,
    color: Colors.white,
    fontWeight: FontWeight.w600,
  );
}

class ProximTheme {
  const ProximTheme._();

  static ThemeData get darkTheme {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: ProximColors.auroraTeal,
      brightness: Brightness.dark,
    ).copyWith(
      surface: ProximColors.surface,
      onSurface: Colors.white,
      primary: ProximColors.auroraTeal,
      secondary: ProximColors.auroraViolet,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: ProximColors.scaffoldBg,
      colorScheme: colorScheme,
      dividerColor: ProximColors.hairlineBorder,
      textTheme: const TextTheme(
        displayLarge: ProximTextStyles.s42,
        displayMedium: ProximTextStyles.s34,
        headlineMedium: ProximTextStyles.s24,
        titleLarge: ProximTextStyles.s20,
        bodyLarge: ProximTextStyles.s15,
        bodyMedium: ProximTextStyles.s13,
        labelSmall: ProximTextStyles.s11,
      ),
    );
  }
}
