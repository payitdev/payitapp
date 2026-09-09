import 'package:flutter/material.dart';

/// Proxim design tokens (dark-only).
/// Source: proxim_app_specification.md §12 + Stitch exports.
class ProximColors {
  const ProximColors._();

  // Core background & surfaces
  static const Color scaffoldBg = Color(0xFF0C1323);
  static const Color surface = Color(0xFF0C1323);
  static const Color surfaceContainerLowest = Color(0xFF070E1E);
  static const Color surfaceContainerLow = Color(0xFF141B2C);
  static const Color surfaceContainer = Color(0xFF181F30);
  static const Color surfaceContainerHigh = Color(0xFF232A3B);
  static const Color surfaceContainerHighest = Color(0xFF2E3446);
  static const Color deepBg = Color(0xFF050811);
  static const Color surfaceAlt = Color(0xFF0B2924);

  // Brand Accents
  static const Color primary = Color(0xFF5DF6EC);
  static const Color primaryFixed = Color(0xFF61F9EF);
  static const Color primaryContainer = Color(0xFF35D9D0);
  static const Color auroraTeal = Color(0xFF35D9D0);
  static const Color auroraViolet = Color(0xFF7567F8);
  static const Color tertiary = Color(0xFF6BF8BB);
  static const Color tertiaryFixedDim = Color(0xFF4EDEA3);
  static const Color secondary = Color(0xFFC6C0FF);
  static const Color secondaryContainer = Color(0xFF3D27C0);
  static const Color error = Color(0xFFFFB4AB);

  // Content & Typography Colors
  static const Color onSurface = Color(0xFFDCE2F9);
  static const Color onSurfaceVariant = Color(0xFF8F9DB3);
  static const Color textWhite = Color(0xFFFFFFFF);

  // Hairline borders
  static const Color hairlineBorder = Color(0x0FFFFFFF); // 6% white
  static const Color subtleBorder = Color(0x0AFFFFFF); // 4% white
  static const Color elevatedBorder = Color(0x14FFFFFF); // 8% white

  // Gradients
  static const LinearGradient auroraGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [auroraTeal, auroraViolet],
  );

  static const LinearGradient primaryCtaGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF5DF6EC), Color(0xFF497BF7)],
  );

  static const LinearGradient cardMeshGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0x2835D9D0), Color(0x187567F8)],
  );
}

/// Typography scale: 10 / 11 / 12 / 13 / 14 / 15 / 17 / 18 / 22 / 24 / 38 / 42.
class ProximTextStyles {
  const ProximTextStyles._();

  static const TextStyle s10 = TextStyle(
    fontSize: 10,
    color: ProximColors.onSurfaceVariant,
    fontWeight: FontWeight.w500,
  );

  static const TextStyle s11 = TextStyle(
    fontSize: 11,
    color: ProximColors.onSurfaceVariant,
    fontWeight: FontWeight.w500,
  );

  static const TextStyle s12 = TextStyle(
    fontSize: 12,
    color: ProximColors.onSurfaceVariant,
    fontWeight: FontWeight.w500,
  );

  static const TextStyle s13 = TextStyle(
    fontSize: 13,
    color: Colors.white,
    fontWeight: FontWeight.w500,
  );

  static const TextStyle s14 = TextStyle(
    fontSize: 14,
    color: Colors.white,
    fontWeight: FontWeight.w500,
  );

  static const TextStyle s15 = TextStyle(
    fontSize: 15,
    color: Colors.white,
    fontWeight: FontWeight.w600,
  );

  static const TextStyle s17 = TextStyle(
    fontSize: 17,
    color: Colors.white,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.2,
  );

  static const TextStyle s18 = TextStyle(
    fontSize: 18,
    color: Colors.white,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.3,
  );

  static const TextStyle s22 = TextStyle(
    fontSize: 22,
    color: Colors.white,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.4,
  );

  static const TextStyle s24 = TextStyle(
    fontSize: 24,
    color: Colors.white,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.5,
  );

  static const TextStyle s34 = TextStyle(
    fontSize: 34,
    color: Colors.white,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.8,
  );

  static const TextStyle s38 = TextStyle(
    fontSize: 38,
    color: Colors.white,
    fontWeight: FontWeight.w800,
    letterSpacing: -1.0,
  );

  static const TextStyle s42 = TextStyle(
    fontSize: 42,
    color: Colors.white,
    fontWeight: FontWeight.w800,
    letterSpacing: -1.2,
  );
}

class ProximTheme {
  const ProximTheme._();

  static ThemeData get darkTheme {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: ProximColors.primary,
      brightness: Brightness.dark,
    ).copyWith(
      surface: ProximColors.surface,
      onSurface: ProximColors.onSurface,
      primary: ProximColors.primary,
      secondary: ProximColors.secondary,
      tertiary: ProximColors.tertiary,
      error: ProximColors.error,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: ProximColors.scaffoldBg,
      colorScheme: colorScheme,
      dividerColor: ProximColors.hairlineBorder,
      fontFamily: 'sans-serif',
      textTheme: const TextTheme(
        displayLarge: ProximTextStyles.s42,
        displayMedium: ProximTextStyles.s38,
        displaySmall: ProximTextStyles.s34,
        headlineMedium: ProximTextStyles.s24,
        headlineSmall: ProximTextStyles.s22,
        titleLarge: ProximTextStyles.s18,
        titleMedium: ProximTextStyles.s17,
        titleSmall: ProximTextStyles.s15,
        bodyLarge: ProximTextStyles.s15,
        bodyMedium: ProximTextStyles.s14,
        bodySmall: ProximTextStyles.s13,
        labelLarge: ProximTextStyles.s12,
        labelMedium: ProximTextStyles.s11,
        labelSmall: ProximTextStyles.s10,
      ),
    );
  }
}
