# Proxim — App Specification
**Tagline:** "Money without limits."  
**Internal Codename:** `payit-mobile-web`  
**Audience:** Cross-platform engineering, backend/vendor decision makers, product & design team.

---

### Key System Highlights
1. **Design System Tokens (§12)**:
   - Single mobile container: `max-width: 440px`, 96px bottom padding for floating navigation.
   - Dark mode only: `--bg-app: #061B18`, `--bg-deep: #050811`, `--surface: #0D1424`, `--surface-alt: #0B2924`.
   - Brand Accent: Aurora gradient (`#35D9D0` → `#7567F8`).
   - Typography: *Bricolage Grotesque* (Display) & *Satoshi* (Body). Fixed scale: 11 / 13 / 15 / 20 / 24 / 34 / 42px.
   - Hairline borders: `rgba(255, 255, 255, 0.06)`.

2. **Primary Screens (BottomNav)**:
   - **Home:** Personal/Business toggle, KYC status banner, aurora balance card (fiat + USDC on-chain), quick action pills (Send, Receive, Request, Contacts, Vault / Invoices).
   - **Activity:** 3-way filter (All / Received / Sent), grouped dates, payment status tracker sheet.
   - **Invest (Stocks):** Ondo tokenized equities, watchlist & active positions, buy/sell modal with Biconomy relay.
   - **Vault (Savings):** Kamino + Pods yield strategies (~11.2% APY), smart auto-sweep idle cash toggle, lock duration deposit sheet.
   - **Cards:** Virtual Visa/Mastercard, aurora visual card, freeze/fund/withdraw actions, card transaction feed.
   - **Profile:** Legal display name resolution, security PIN, KYC status trigger, currency preferences, Telegram bot manager, logout.

3. **Secondary Screens & Modals**:
   - Invoices & Invoice Builder (3-step wizard with FX quote), Payroll batch disbursement, Public Invoice Checkout (`?invoice=<id>`), Payment Request Hub (Inbox/Outbound with Trusted vs Strangers split), Currency Convert swap UI, Nuvion Payout (Send) & Funding (Receive: Brails NGN bank transfer, Mobile Money, 5-chain crypto deposit), Business Balance Sheet, Developer API Hub.
