---
name: Proxim Aurora Treasury
colors:
  surface: '#0c1323'
  surface-dim: '#0c1323'
  surface-bright: '#32394b'
  surface-container-lowest: '#070e1e'
  surface-container-low: '#141b2c'
  surface-container: '#181f30'
  surface-container-high: '#232a3b'
  surface-container-highest: '#2e3446'
  on-surface: '#dce2f9'
  on-surface-variant: '#bacac7'
  inverse-surface: '#dce2f9'
  inverse-on-surface: '#293041'
  outline: '#859492'
  outline-variant: '#3c4948'
  surface-tint: '#3adcd3'
  primary: '#5df6ec'
  on-primary: '#003734'
  primary-container: '#35d9d0'
  on-primary-container: '#005b57'
  inverse-primary: '#006a65'
  secondary: '#c6c0ff'
  on-secondary: '#2600a1'
  secondary-container: '#3d27c0'
  on-secondary-container: '#b3acff'
  tertiary: '#6bf8bb'
  on-tertiary: '#003824'
  tertiary-container: '#4adba0'
  on-tertiary-container: '#005c3e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#61f9ef'
  primary-fixed-dim: '#3adcd3'
  on-primary-fixed: '#00201e'
  on-primary-fixed-variant: '#00504c'
  secondary-fixed: '#e4dfff'
  secondary-fixed-dim: '#c6c0ff'
  on-secondary-fixed: '#150066'
  on-secondary-fixed-variant: '#3d27c0'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0c1323'
  on-background: '#dce2f9'
  surface-variant: '#2e3446'
typography:
  display-xl:
    fontFamily: Bricolage Grotesque
    fontSize: 42px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.04em
  display-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 34px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Bricolage Grotesque
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter-xs: 4px
  gutter-sm: 8px
  gutter-md: 12px
  gutter-lg: 16px
  gutter-xl: 20px
  gutter-2xl: 24px
  bottom-nav-clearance: 96px
---

## Brand & Style

This design system drives a cutting-edge global payments and crypto treasury mobile web application built under the ethos "Money without limits." Designed exclusively for a mobile viewport (`max-width: 440px`), the visual narrative marries deep-space institutional fintech with bioluminescent, living digital assets.

### Aesthetic Foundation
- **Bioluminescent Aurora**: Surfaces emerge from liquid deep-space backgrounds (`#050811` to `#061B18`) lit by directional atmospheric glows in high-frequency cyan and electric indigo.
- **Glassmorphic Precision**: Depth relies on optical stratification—translucent slate surfaces, backdrop blur, and razor-sharp 1px hairline inner borders (`rgba(255, 255, 255, 0.06)`).
- **High-Velocity Utility**: Dense, tactile controls, fluid micro-interactions, and instant visual state feedback engineered for rapid asset deployment, swapping, and global settlement.

## Colors

The palette operates in forced dark mode to deliver high contrast, battery efficiency on OLED panels, and vivid illumination for real-time asset flows.

### Palette Definitions
- **Background Core**: `#050811` (pitch black void) blending into `#061B18` (deep night teal).
- **Surface Elevation 1 (Card Default)**: `#0D1424` (slate dark base).
- **Surface Elevation 2 (Treasury / Active Card)**: `#0B2924` (teal-tinted elevated slate).
- **Aurora Primary Gradient**: Linear `135deg` from `#35D9D0` (cyan neon) to `#7567F8` (electric royal indigo).
- **Hairline Borders**: `rgba(255, 255, 255, 0.06)` for passive containers; `rgba(255, 255, 255, 0.12)` for interactive boundaries.
- **Semantics**:
  - Positive / Yield: `#10B981` (Emerald), `#059669` (Deep Emerald).
  - Attention / Pending: `#F59E0B` (Amber Gold).
  - Hazard / Liquidation: `#EF4444` (Electric Rose).
- **Text Tiers**:
  - Primary: `#FFFFFF` (100% pure contrast).
  - Secondary: `#94A3B8` (slate muted).
  - Tertiary / Captions: `#64748B` (faint slate).

## Typography

The pairing creates visual tension between expressive structural numbers and clean financial data:

- **Bricolage Grotesque** handles all major financial balances, hero figures, modal headings, and stat metrics. Its tight geometric apertures deliver immediate visual punch and prestige.
- **Inter** provides neutral, rock-solid legibility for fiat/crypto symbols, transaction metadata, addresses, micro-copy, and form inputs.
- Numerical displays use `font-variant-numeric: tabular-nums` to prevent layout shift during live tickers and high-frequency rate refreshes.

## Layout & Spacing

### Mobile Constraint Philosophy
- The shell is locked to a maximum centered container width of `440px`. On larger screens, the canvas sits centered with a dark ambient blur background.
- Global horizontal screen gutters are fixed to `16px` (`gutter-lg`), expanding to `20px` (`gutter-xl`) on displays wider than `390px`.
- Vertical rhythm strictly follows an `8px` baseline grid, with `4px` micro-spacers used exclusively for chip badges, internal button gaps, and tabular value tags.
- All scrollable viewports reserve a mandatory `96px` bottom inset (`bottom-nav-clearance`) to ensure clear floating separation above the bottom navigation bar.

## Elevation & Depth

This system avoids heavy drop shadows in favor of luminous backdrops and hair-thin reflective borders.

1. **Base Layer (Elevation 0)**: `#050811` overlaid with subtle, dynamic radial glows: `radial-gradient(circle at top right, rgba(53, 217, 208, 0.12), transparent 45%)`.
2. **Elevated Card (Elevation 1)**: `#0D1424` backed by a 1px inner stroke of `rgba(255, 255, 255, 0.06)`. Shadows are soft and tinted: `0 8px 32px rgba(0, 0, 0, 0.35)`.
3. **Interactive & Highlighted Layer (Elevation 2)**: `#0B2924` surface with `box-shadow: 0 0 24px rgba(53, 217, 208, 0.08)` and border `rgba(53, 217, 208, 0.25)`.
4. **Floating HUD / Overlays (Elevation 3)**: Frosted glass using `background: rgba(13, 20, 36, 0.75)`, `backdrop-filter: blur(20px)`, and `border: 1px solid rgba(255, 255, 255, 0.12)`.

## Shapes

The design system implements a rounded and pill-centric form language:

- **Buttons and Chips**: Full pill curvature (`border-radius: 9999px`) for action ergonomics and tap-target affordance.
- **Surface Cards**: `20px` to `24px` smooth corners (`rounded-2xl`) to evoke an organic, modern hardware feel.
- **Inputs & Bottom Sheet Panels**: `16px` for standard inputs, with modal top corners set to `28px`.

## Components

### AuroraBar
- A thin, 2px to 4px animated multi-stop gradient track (`#35D9D0` to `#7567F8`) used at the top of active treasury cards or across screen progress indicators.
- Emits an ambient blur: `box-shadow: 0 0 12px rgba(53, 217, 208, 0.5)`.

### Buttons
- **Aurora Pill Button**: Full-width primary button with linear gradient background (`#35D9D0` to `#7567F8`), pure white typography, 48px height, and `box-shadow: 0 4px 20px rgba(53, 217, 208, 0.3)`.
- **Ghost Button**: Transparent core, 48px height, `1px` hairline border in `rgba(255, 255, 255, 0.12)`, active state highlights border to cyan.
- **Icon Action Buttons**: `44x44px` circular capsules with `#0D1424` background and `rgba(255, 255, 255, 0.06)` border.

### Status Chips
- Pill badges (`height: 24px`, padding `0 10px`, typography `label-sm`).
- **Success**: Background `rgba(16, 185, 129, 0.12)`, text `#10B981`, border `1px solid rgba(16, 185, 129, 0.25)`.
- **Warning**: Background `rgba(245, 158, 11, 0.12)`, text `#F59E0B`, border `1px solid rgba(245, 158, 11, 0.25)`.
- **Danger**: Background `rgba(239, 68, 68, 0.12)`, text `#EF4444`, border `1px solid rgba(239, 68, 68, 0.25)`.
- **Teal Live**: Background `rgba(53, 217, 208, 0.12)`, text `#35D9D0`, border `1px solid rgba(53, 217, 208, 0.25)`.

### Cards & Treasury Modules
- Base card: `#0D1424` with `20px` border radius and `16px` padding.
- Treasury card: Features a directional glow overlay, primary balance rendered in `Bricolage Grotesque` at `34px` or `42px`, alongside quick-action icon clusters.

### Floating Bottom Tab Bar
- Anchored to the viewport bottom with `padding: 0 16px 16px 16px`.
- Floats as a pill-style island: `height: 64px`, `background: rgba(13, 20, 36, 0.85)`, `backdrop-filter: blur(24px)`, with hairline top and side border `rgba(255, 255, 255, 0.08)`.
- Six destinations (Home, Activity, Invest, Vault, Cards, Profile) using 20px icons and 11px active state indicators illuminated by the Aurora cyan accent.