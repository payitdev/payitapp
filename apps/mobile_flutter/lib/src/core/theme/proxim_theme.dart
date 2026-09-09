import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Proxim Aurora Treasury design tokens (dark-only).
/// Source: stitch_document_content_extractor/proxim_aurora_treasury_1/DESIGN.md
class ProximColors {
  const ProximColors._();

  // Core background & surfaces
  static const Color scaffoldBg = Color(0xFF0C1323);
  static const Color surface = Color(0xFF0C1323);
  static const Color surfaceDim = Color(0xFF0C1323);
  static const Color surfaceBright = Color(0xFF32394B);
  static const Color surfaceContainerLowest = Color(0xFF070E1E);
  static const Color surfaceContainerLow = Color(0xFF141B2C);
  static const Color surfaceContainer = Color(0xFF181F30);
  static const Color surfaceContainerHigh = Color(0xFF232A3B);
  static const Color surfaceContainerHighest = Color(0xFF2E3446);
  static const Color surfaceElevated = Color(0xFF0D1424);
  static const Color surfaceTreasuryActive = Color(0xFF0B2924);
  static const Color deepBg = Color(0xFF050811);

  // Brand Accents
  static const Color primary = Color(0xFF5DF6EC);
  static const Color onPrimary = Color(0xFF003734);
  static const Color primaryContainer = Color(0xFF35D9D0);
  static const Color primaryFixed = Color(0xFF61F9EF);
  static const Color primaryFixedDim = Color(0xFF3ADCD3);

  static const Color secondary = Color(0xFFC6C0FF);
  static const Color onSecondary = Color(0xFF2600A1);
  static const Color secondaryContainer = Color(0xFF3D27C0);
  static const Color onSecondaryContainer = Color(0xFFB3ACFF);

  static const Color tertiary = Color(0xFF6BF8BB);
  static const Color onTertiary = Color(0xFF003824);
  static const Color tertiaryContainer = Color(0xFF4ADBA0);
  static const Color tertiaryFixed = Color(0xFF6FFBBE);
  static const Color tertiaryFixedDim = Color(0xFF4EDEA3);

  // Status & Semantics
  static const Color statusSuccess = Color(0xFF10B981);
  static const Color statusWarning = Color(0xFFF59E0B);
  static const Color statusDanger = Color(0xFFEF4444);
  static const Color error = Color(0xFFFFB4AB);

  // Typography & On-Surface
  static const Color onSurface = Color(0xFFDCE2F9);
  static const Color onSurfaceVariant = Color(0xFFBACAC7);
  static const Color outline = Color(0xFF859492);
  static const Color outlineVariant = Color(0xFF3C4948);
  static const Color textWhite = Color(0xFFFFFFFF);

  // Hairline borders
  static const Color hairlineBorder = Color(0x0FFFFFFF); // 6% white
  static const Color subtleBorder = Color(0x0AFFFFFF); // 4% white
  static const Color elevatedBorder = Color(0x1FFFFFFF); // 12% white

  // Aurora Linear Gradients
  static const LinearGradient auroraGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF35D9D0), Color(0xFF7567F8)],
  );

  static const LinearGradient auroraBarTrack = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFF5DF6EC), Color(0xFF35D9D0), Color(0xFF3D27C0)],
  );

  static const LinearGradient primaryCtaGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF5DF6EC), Color(0xFF497BF7)],
  );
}

/// Proxim Typography pairing:
/// - Bricolage Grotesque for headlines, hero balances, and display numbers
/// - Inter for body, metadata, form labels, and status badges
class ProximTextStyles {
  const ProximTextStyles._();

  // Bricolage Grotesque display & headlines
  static TextStyle displayXl({Color color = Colors.white}) =>
      GoogleFonts.bricolageGrotesque(
        fontSize: 42,
        fontWeight: FontWeight.w700,
        height: 48 / 42,
        letterSpacing: -1.2,
        color: color,
      );

  static TextStyle displayLg({Color color = Colors.white}) =>
      GoogleFonts.bricolageGrotesque(
        fontSize: 34,
        fontWeight: FontWeight.w700,
        height: 40 / 34,
        letterSpacing: -0.8,
        color: color,
      );

  static TextStyle headlineLg({Color color = Colors.white}) =>
      GoogleFonts.bricolageGrotesque(
        fontSize: 24,
        fontWeight: FontWeight.w600,
        height: 30 / 24,
        letterSpacing: -0.5,
        color: color,
      );

  static TextStyle headlineMd({Color color = Colors.white}) =>
      GoogleFonts.bricolageGrotesque(
        fontSize: 20,
        fontWeight: FontWeight.w600,
        height: 26 / 20,
        letterSpacing: -0.3,
        color: color,
      );

  static TextStyle headlineSm({Color color = Colors.white}) =>
      GoogleFonts.bricolageGrotesque(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        height: 22 / 16,
        letterSpacing: -0.2,
        color: color,
      );

  // Inter body and labels
  static TextStyle bodyLg({Color color = ProximColors.onSurface}) =>
      GoogleFonts.inter(
        fontSize: 15,
        fontWeight: FontWeight.w500,
        height: 22 / 15,
        letterSpacing: -0.1,
        color: color,
      );

  static TextStyle bodyMd({Color color = ProximColors.onSurfaceVariant}) =>
      GoogleFonts.inter(
        fontSize: 13,
        fontWeight: FontWeight.w400,
        height: 18 / 13,
        color: color,
      );

  static TextStyle bodySm({Color color = ProximColors.onSurfaceVariant}) =>
      GoogleFonts.inter(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        height: 16 / 12,
        color: color,
      );

  static TextStyle labelSm({Color color = ProximColors.onSurfaceVariant}) =>
      GoogleFonts.inter(
        fontSize: 11,
        fontWeight: FontWeight.w600,
        height: 14 / 11,
        letterSpacing: 0.2,
        color: color,
      );

  static TextStyle labelXs({Color color = ProximColors.onSurfaceVariant}) =>
      GoogleFonts.inter(
        fontSize: 10,
        fontWeight: FontWeight.w500,
        height: 12 / 10,
        color: color,
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
      fontFamily: GoogleFonts.inter().fontFamily,
      textTheme: TextTheme(
        displayLarge: ProximTextStyles.displayXl(),
        displayMedium: ProximTextStyles.displayLg(),
        headlineMedium: ProximTextStyles.headlineLg(),
        headlineSmall: ProximTextStyles.headlineMd(),
        titleLarge: ProximTextStyles.headlineSm(),
        bodyLarge: ProximTextStyles.bodyLg(),
        bodyMedium: ProximTextStyles.bodyMd(),
        labelSmall: ProximTextStyles.labelSm(),
      ),
    );
  }
}
