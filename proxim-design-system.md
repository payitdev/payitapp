# Proxim design system and screen specification

Written as a spec sheet, not a mood board. Every value is exact. The AI
editor implementing this should not be choosing colors, spacing, or
component shapes on its own anywhere. If a value isn't listed here, it
doesn't belong in the app.

## 0. What was wrong, specifically

- No hierarchy: the aurora gradient decorated every badge, border, and
  button instead of marking one moment per screen.
- Three different hand-built banner styles doing the same job (KYC
  action, pending, verified).
- Quick actions were five identical icon boxes: the generic
  "app-icon-grid" pattern, no priority, no primary action.
- Bottom nav was six vertical icon+label stacks with inconsistent active
  states, competing equally for attention.
- Ad hoc pixel values and hex codes chosen per element, so nothing lines
  up with anything else.
- An all-caps "VERIFIED" badge and other tracked-out label conventions
  that read as generic template chrome.
- A fake "9:41" clock.

Everything below fixes these directly. The palette and fonts are not
changing. Proxim already has a real identity (dark teal, aurora gradient,
Bricolage Grotesque numerals); it was just never applied with discipline.

## 1. Foundations

### Color

Two surfaces only. Do not add a third.

| Token | Value | Use |
|---|---|---|
| `--bg-app` | `#061B18` | Screen background, always |
| `--surface` | `#0D1424` | Every card, row, sheet, modal |
| `--text-primary` | `#F7F8F4` | Default reading text |
| `--text-on-surface` | `#FFFFFF` | Text on solid accent fills |
| `--text-muted` | `#94A3B8` | Meta text, timestamps, secondary lines |
| `--text-inverse` | `#061B18` | Text on light chip fills |
| `--accent-teal` | `#35D9D0` | The one interactive color: links, active nav, positive deltas, focus rings |
| `--accent-teal-deep` | `#16C7B7` | Success semantic |
| `--gradient-aurora` | `#35D9D0 → #7567F8` | The one signature motif. Max two uses per screen: hero accent bar, primary CTA fill. Never a border, never a badge. |
| `--warning` | `#D6B65A` | Pending semantic |
| `--danger` | `#FF4D4D` | Error semantic |
| `--hairline` | `rgba(255,255,255,0.06)` | The only border color in the app |

No drop shadows anywhere. Dark UIs read shadows as muddy smudges, not
depth. Elevation comes from the `--hairline` border plus the surface
color itself sitting one step lighter than the background. That's the
entire elevation system: two flat colors and one hairline.

### Typography

Two families, fixed roles, no exceptions.

- **Bricolage Grotesque** (700/800/900): screen titles, section titles,
  and **monetary amounts only**.
- **Satoshi** (400/500/700): everything else — body, labels, buttons,
  meta text.

Fixed scale, seven sizes, nothing in between:

| Size | Weight | Role |
|---|---|---|
| 11 | 700 | Meta, timestamps, chip text |
| 13 | 400/700 | Body small, secondary lines, input labels |
| 15 | 500 | Default body, button text, list row titles |
| 20 | 700 | Section headers within a screen |
| 24 | 800 | Screen titles (Bricolage) |
| 34 | 900 | Balance, business mode (Bricolage) |
| 42 | 900 | Balance, personal mode (Bricolage) |

Rule: **34 and 42 are reserved exclusively for money.** If a number on
screen is a currency amount, it's one of these two sizes in Bricolage. If
it's anything else (a percentage, a count, a date), it is never this
large. This is how a user's eye learns instantly what's an amount and
what isn't, without needing a currency symbol to tell them.

No all-caps labels anywhere (the old "VERIFIED" chip becomes "Verified").
No tracked-out eyebrow text. Section labels are sentence case, 11px, 700
weight, `--text-muted`, nothing more.

### Spacing

4px base unit. `4 · 8 · 12 · 16 · 20 · 24 · 32`. Screen edge padding is
always 20px. Vertical rhythm between list rows is always 12px. Section
gaps on a scrolling screen are always 24px. Never a hand-typed pixel
value outside this list.

### Radius

`8` for inputs and small chips. `16` for cards. `24` for the top corners
of full-screen sheets. `999` (pill) for buttons, nav, and tags.

### Motion

One ambient animation in the entire app: the aurora sweep bar on the
Home hero. It already exists; do not add a second one anywhere else.

Interaction motion only, nothing decorative:

- Screen-to-screen (drilling into a detail): slide in from the right,
  200ms, standard ease.
- Bottom nav tab switch: cross-fade, 150ms. No slide (it's a peer
  switch, not a drill-down, and shouldn't feel like one).
- Sheets and modals: slide up from the bottom, 250ms, with a translucent
  backdrop fade.
- Button press: scale to 0.97 plus the existing light haptic. No
  hover states; this is a touch-only surface.
- Lists never stagger-animate their rows in on load. They just appear.

### Iconography

`lucide-react` exclusively, 20px, stroke width 1.7, outline style only.
No filled icons except a single small dot/checkmark used as a state
indicator (verified, active). Consistency here matters more than variety
– if a concept has an icon already in use elsewhere in the app, reuse it
rather than picking a new one.

## 2. Core components

Build each of these once, in `src/components/`, and use nothing else in
their place anywhere in the app.

**StatusCard** — replaces all three old banner styles.
- Props: `tone: 'action' | 'pending' | 'success'`, `title`, `subtitle`,
  optional `cta`.
- Layout: 18px leading icon, two-line text stack (15px/700 title, 13px
  muted subtitle), optional trailing pill button or badge, right-aligned.
- Fill: tone color at 10% opacity. Border: tone color at 20% opacity,
  1px. Radius 16. Padding 14.
- This is the only banner component in the codebase. If a new state
  needs a banner, it gets a new `tone`, not a new component.

**BottomNav** — replaces the six duplicated nav bars.
- A floating pill bar, not edge-to-edge: 16px side margin, 12px bottom
  margin, height 64, radius 999, `--surface` fill, 1px hairline border.
- Icons sit in a row. The active icon sits inside a sliding capsule
  (`--accent-teal` at 15% opacity, radius 999, animates position on tab
  change, 200ms).
- Label text (11px) shows only under the active icon. Idle icons are
  icon-only, `--text-muted`. This is deliberate: six competing labels is
  noise, one label is a confirmation.

**Hero balance card** (Home only — this is the one screen that earns a
large, distinct treatment).
- Order top to bottom: eyebrow label + currency switcher chip (row,
  space-between), aurora sweep bar (the screen's one signature motif),
  balance amount (42/34 Bricolage per the rule above), one muted
  secondary line for the true on-chain balance, one teal 13px/700 delta
  line, then Quick Actions.

**Quick Actions** — replaces the five-equal-icon grid.
- One primary pill button, full width minus side padding, aurora
  gradient fill, white 15px/700 label with a leading icon ("Send" on
  Personal, "Receive" on Business — whichever is the account's primary
  action).
- Below it, a single row of icon-only circular buttons (44px,
  `--surface` fill, hairline border) for the remaining actions (Receive,
  Request, Contacts, Vault on Personal; Invoices on Business). No text
  labels on these — they're secondary by design, and a long-press or
  first-use tooltip covers discoverability once, not a permanent label
  competing with the primary action.

**List row** (transactions, invoices, payroll, requests — one component,
parameterized, used everywhere a list of financial line items appears).
- Leading 32px circular icon or avatar. Two-line text block (15px title,
  13px muted meta). Trailing block, right-aligned: amount in 15px/700
  (teal if incoming, `--text-primary` if outgoing), optional 11px status
  chip beneath it.
- 12px vertical padding, `--hairline` bottom border, no per-row inline
  styling of any kind — every row in the app, regardless of screen, is
  visually identical in structure.

**Buttons**
- Primary: aurora gradient fill, white text, pill radius. Exactly one
  visible per screen at a time. If a screen seems to need two, one of
  them isn't actually primary — demote it.
- Secondary: `--surface` fill, 1px hairline border, `--text-primary` text.
- Ghost: no fill, `--accent-teal` text, used for tertiary actions like
  "Skip for now."
- Icon-only: 44px circle, `--surface` fill, hairline border.

**Inputs**
- `--surface` fill, 1px hairline border, radius 8, 15px Satoshi value
  text, 13px muted label above the field (not a floating label — a
  static one above, always visible).
- Focus state: border becomes `--accent-teal`, 1.5px. No glow, no shadow.

**Sheets and modals**
- Slide up from bottom, radius 24 on top corners only, `--surface` fill,
  a small centered drag-handle bar at the top (32×4px,
  `rgba(255,255,255,0.15)`).
- Backdrop: `--bg-deep` at 60% opacity.
- Max height 90% of viewport; content scrolls internally if it overflows.

**Chips and badges**
- Pill radius, 11px/700 text, sentence case always. Status chips use the
  matching semantic color at 15% fill / full-strength text. No uppercase
  tracked-out labels anywhere in the app.

**Account switcher** (Personal/Business)
- Keep the existing flip-card metaphor; restyle to `--surface` fill with
  a hairline border and the active side in `--text-primary`, inactive
  side in `--text-muted`. No extra ornamentation.

## 3. Onboarding flow

Proxim is reached two ways: inside Telegram (auto-authenticated via
`Telegram.WebApp.initData`, no onboarding needed beyond KYC) or via a
direct link (Privy login). Design for the second path; the first path
skips straight to step 4.

**1. Launch**
Full-bleed `--bg-app`. Center-aligned wordmark in Bricolage Grotesque,
24px. The aurora sweep bar plays once beneath it, then settles. No
spinner, no progress bar — if the app takes longer than a beat to be
ready, the sweep bar's own looping motion is the loading state. Total
screen, no chrome.

**2. Welcome (one screen, not a carousel)**
A single, confident statement of what Proxim does (not a feature list),
set in Bricolage Grotesque 24px, left-aligned, max 8 words. One
supporting line beneath in Satoshi 15px/muted. One primary button:
"Continue." Multi-slide onboarding carousels are a delay, not an
introduction — cut it to one screen.

**3. Auth**
The existing Privy login, restyled: `--bg-app` background, the wordmark
small at the top (not centered hero-size — it already did its job on
Launch), one primary button per auth method offered (phone, email,
wallet), each a Secondary-style button stacked with 12px gaps, no
gradient on any of them. The gradient primary treatment is reserved for
the single most important action on a screen, and here every method is
equally valid, so none of them should visually claim to be more
important than the others.

**4. KYC intro**
Shown the first time an unverified user reaches Home, as a full-screen
step, not a modal, so it gets full attention: icon, "Verify your
identity" in 24px Bricolage, one supporting line explaining it unlocks
Naira accounts, one primary button "Verify now," one ghost button "Skip
for now" beneath it. Skipping drops the user onto Home with the existing
`StatusCard tone="action"` banner as the ongoing reminder.

**5. KYC form**
A stepped flow (numbered steps are correct here — this genuinely is a
sequence): identity details, then document upload, then review. Progress
shown as a slim dot indicator at the top (not a numbered "Step 1 of 3"
label — the dots communicate progress without adding another text
element to read). One field group visible per step, generous field
spacing (20px between fields, not 12 — this is a form, not a list).
Primary button pinned to the bottom, always says the concrete next
action ("Continue," then "Upload," then "Submit"), never "Next."

**6. KYC pending**
Full-screen version of the `StatusCard tone="pending"` content, centered,
with a single line explaining what happens next and roughly how long it
takes. One ghost button, "Back to Proxim," returns to Home, where the
same pending state now shows as the on-page banner.

## 4. Screen-by-screen

**Home** — see Hero balance card and Quick Actions above. Below the
hero: a "Recent activity" section header (20px/700), then up to 5 List
rows, then a ghost "See all" button that navigates to Activity. Empty
state (no transactions yet): a single centered muted line, "Nothing yet
— your activity will show up here," no illustration, no CTA (the CTA is
already the hero above it).

**Activity** — screen title "Activity" (24px Bricolage) via a plain top
bar, no StatusCard here (KYC status is a Home-only concern once
acknowledged). A single-row filter control (All / In / Out) as three
Ghost-style segments, not full buttons, directly beneath the title. Then
List rows, grouped under muted 11px date headers ("Today," "Yesterday,"
then actual dates). Infinite scroll, no pagination controls.

**Cards** — top: the physical/virtual card rendered as a single visual
card element (the one place besides the Home hero that can carry the
aurora gradient, since it's a literal card and the metaphor is earned),
showing masked number, status chip (Active/Frozen), and freeze/fund
Ghost buttons beneath it. Below: List rows for card transaction history,
identical component to Activity. Issuing a new card opens a Sheet, not a
new screen.

**Vault (Savings)** — top: current locked total in Bricolage (34px,
since this is Business-context-sized data, not the primary personal
balance), muted APY line beneath it. Below: yield options as a vertical
list of Secondary-style cards (not the generic identical-card grid — each
shows provider name, APY, and a single "Deposit" Ghost button), sorted
by APY descending. Auto-sweep is a single toggle row, not a separate
screen: label left, switch right, one muted line beneath explaining what
it does.

**Invest (Stocks)** — top: a segmented Ghost control (Watchlist /
Positions). Watchlist is List rows (ticker, name, price, day change in
teal or danger). Tapping a row opens a detail Sheet with buy/sell as two
Secondary buttons side by side (never a single ambiguous "Trade"
button). Positions tab reuses the identical List row component, trailing
amount showing current value instead of price.

**Profile** — top: avatar circle + name (20px/700) + account type chip.
Below, grouped Settings rows (a text-only variant of List row: label
left, chevron right, no amount slot) grouped under muted section headers:
"Account" (Security/PIN, KYC status), "Preferences" (currency, add
Business account), "Support," then a Ghost "Log out" row on its own at
the bottom, colored `--danger` text, separated by extra 24px of space so
it can't be mis-tapped as part of the list above it.

**Business mode differences** — Home's hero shows "Corporate Treasury
Balance" as the eyebrow, balance at 34px instead of 42 (per the type
rule: personal balance is the single largest number in the app), and
Quick Actions swaps its primary to Receive with Invoices as the icon row.
Bottom nav is otherwise identical — do not add a business-only nav item;
Invoices and Payroll are reached via Quick Actions and Profile, keeping
the nav itself stable across both modes so switching modes doesn't
reshuffle the user's spatial memory of where things are.

**Invoices** — list screen uses `ScreenHeader` ("Invoices," back to
Home), a single primary "New invoice" button pinned above the list, then
List rows (client name, amount, status chip: paid/unpaid). Create flow is
a stepped Sheet (client details, then line items, then review), same
stepped-dot pattern as KYC. Public checkout (the link a client opens) is
its own minimal screen: invoice summary card, one primary "Pay" button,
Proxim wordmark small at the bottom — this is the one screen a
non-Proxim-user sees, so it should feel like a clean payment page, not
the full app chrome.

**Payroll** — identical structural pattern to Invoices: `ScreenHeader`,
primary "New payroll run" button, List rows (employee name, amount,
status), stepped Sheet for creation.

**Requests** — `ScreenHeader`, List rows (who, amount, status: pending
you owe / pending they owe you, distinguished by teal vs. muted amount
color, not by a separate icon set), a single primary "Request money"
button pinned above the list, opening the existing request Sheet.

**Contacts** — `ScreenHeader`, a search input at top (per Input spec
above), then a plain alphabetical list (avatar circle + name + handle,
no amount slot — this list isn't financial, so it should not borrow the
financial List row and imply one).

**Send / Receive / Request modals** — these stay as Sheets, not full
screens, per the Sheet spec above. Each has exactly one primary button
at the bottom pinned above the keyboard, and the amount entry uses the
same 34/42 Bricolage treatment as the Home balance, because typing an
amount is the moment a number matters most on that screen too.

## 5. Empty, loading, and error states

One standard per case, used everywhere, no exceptions:

- **Empty**: centered muted 13px sentence stating what will appear
  there. No illustration, no "get started" CTA duplicating one that
  already exists elsewhere on the screen.
- **Loading**: the row/card skeleton is the same shape as the real
  content, `--surface` fill, no shimmer animation (motion budget is
  already spent on the aurora sweep — a second moving element on screen
  reads as busy, not premium).
- **Error**: inline, where the failure happened, not a full-screen
  takeover. 13px `--danger` text stating what failed in plain language,
  plus a Ghost "Retry" button. Never a modal for a failed fetch.

## 6. Quality floor (non-negotiable, applies to every screen above)

- Fully usable one-handed at 375px width (the smallest common phone
  viewport) — this is a mobile-web app, not a responsive site.
- Visible focus states on every interactive element (accessibility, and
  Telegram's in-app browser doesn't always suppress keyboard nav).
- Every tap target is at least 44×44px, including icon-only buttons.
- Every color pairing in this document meets WCAG AA contrast at its
  stated size (muted text is for secondary information only, never for a
  user's own money amounts or action labels).
- No screen ships without its empty, loading, and error state defined
  per section 5, even if the original App.tsx didn't have one.
