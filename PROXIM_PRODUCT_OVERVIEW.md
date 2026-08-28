# Proxim Financial OS: Product, Architecture & Go-to-Market Blueprint

> **"Global Money for Modern Humans & Businesses."**  
> Proxim is an invisible-infrastructure financial operating system that combines the speed, yield, and borderless reach of next-generation distributed networks with the calm confidence, familiar account numbers, and debit cards of global private banking.

---

## 1. Executive Summary & Product Positioning

Proxim bridges modern global commerce and everyday spending without forcing users to navigate technical complexity. Traditional banking is fragmented by borders, slow clearing cycles, and predatory FX spreads. Web3 and crypto solutions, while borderless and high-yielding, remain intimidating with seed phrases, gas tokens, bridge slips, and cryptic hexadecimal addresses.

**Proxim eliminates this tradeoff entirely.**

Through the **"Invisible Crypto Principle"**, Proxim abstracts all underlying decentralized settlement layers, custody protocols, and liquidity bridges into a seamless banking interface. Users send, receive, hold, convert, and earn money across currencies with one-click simplicity.

### Key Value Propositions
- **Instant Global Rails, Zero Jargon**: Send money locally or across continents in seconds without knowing what blockchain or settlement rail was used.
- **Dual Entity Architecture (Personal & Business)**: Seamlessly toggle between personal finances and corporate operations with segregated double-entry ledgers, distinct tax tags, dedicated cards, and custom invoices.
- **Zero-KYC On-Chain Access (Tier 1)**: Instant multi-chain access from day one. Deposit and transfer across 10+ blockchain ecosystems, earn high-yield savings, and create invoices with zero ID verification required.
- **2-Minute Global Banking Tier (Tier 2)**: Quick verification via EaseID unlocks dedicated Nigerian NUBAN accounts, US ACH/Wire routing, European SEPA IBANs, UK Sort Codes, and international VISA debit cards.
- **Multi-Modal Experience**: Access Proxim through a responsive mobile web application or directly inside Telegram via the AI-powered Conversational Bot (`@proximfibot`).

---

## 2. Platform Architecture & Infrastructure Stack

```
                               ┌──────────────────────────────────────────────────────────┐
                               │                    CLIENT INTERFACES                     │
                               │  • Mobile Web Application (Vite / React / TypeScript)    │
                               │  • Telegram Conversational Bot (@proximfibot / Groq AI)  │
                               └────────────────────────────┬─────────────────────────────┘
                                                            │
                               ┌────────────────────────────▼─────────────────────────────┐
                               │              PROXIM CORE BACKEND & LEDGER                │
                               │  • Fastify High-Performance Micro-Services               │
                               │  • Strict Double-Entry Multi-Currency PostgreSQL Ledger  │
                               │  • Automated 15-Min Audit & Reconciliation Engine        │
                               │  • Multi-Tier Security Sentinel & Prompt Firewall        │
                               └────────────────────────────┬─────────────────────────────┘
                                                            │
                 ┌──────────────────────────────────────────┼──────────────────────────────────────────┐
                 │                                          │                                          │
 ┌───────────────▼───────────────┐          ┌───────────────▼───────────────┐          ┌───────────────▼───────────────┐
 │       ON-CHAIN & MPC          │          │      BANKING & COMPLIANCE     │          │      YIELD & DEFI ENGINES     │
 │ • NEAR MPC (Chain Signatures) │          │ • EaseID Liveness & AML KYC   │          │ • Kamino Liquidity Vaults     │
 │ • NEAR Intent 1-Click Swap    │          │ • Brails Multi-Currency Rails │          │ • Ondo US Treasury Yield      │
 │ • Privy Non-Custodial Auth    │          │ • Nuvion Virtual VISA Cards   │          │ • Automated Liquid Buffers    │
 └───────────────────────────────┘          └───────────────────────────────┘          └───────────────────────────────┘
```

### Core Technology Components

| Component | Technology / Provider | Purpose & Capabilities |
| :--- | :--- | :--- |
| **Authentication** | **Privy Server SDK** | Passwordless social, SMS, and email onboarding creating non-custodial cryptographic roots with zero seed phrase friction. |
| **Multi-Chain MPC** | **NEAR Chain Signatures (`v1.signer`)** | Generates deterministic, multi-chain addresses across 30+ networks from a single NEAR master relayer account (`proximfi.near`). |
| **Cross-Chain Settlement** | **NEAR Intents (Defuse)** | 1-Click cross-chain routing. Automatically converts incoming assets on any chain into USDC on Base under the hood. |
| **Identity & AML** | **EaseID AI Verification** | Biometric liveness checking, OCR document verification (NIN, BVN, Passports), and automated sanctions/PEP screening. |
| **Fiat Banking Infrastructure** | **Brails API (v1 & v2)** | Virtual NUBAN issuing (Providus Bank), US ACH/Wire accounts, EUR SEPA IBANs, GBP Sort Codes, and Kenyan Mobile Money (M-Pesa). |
| **Card Issuing** | **Nuvion & Brails Card Engine** | Instant issuance of virtual and physical VISA debit cards with real-time spend limits, freeze controls, and direct ledger balance funding. |
| **Double-Entry Ledger** | **PostgreSQL (Neon DB) + Drizzle ORM** | Immutable debit-credit financial accounting ledger with mathematical balance invariants and multi-entity fund segregation. |
| **Institutional Yield** | **Kamino Finance & Ondo USDY** | Automated high-yield USD liquidity vaults (up to 7.8% APY) and tokenized short-term US Treasuries (5.15% APY). |
| **AI Natural Language** | **Groq Llama 3 AI Engine** | Conversational banking processing in Telegram for parsing transfer intents, generating invoices, and checking balances. |

---

## 3. Supported Currencies & Blockchain Networks

### 1. Supported Local Fiat Currencies & Banking Rails
Proxim connects directly to sovereign banking rails, providing dedicated virtual account coordinates in the user's or business's legal name:

- 🇳🇬 **Nigerian Naira (NGN)**: Dedicated Providus Bank NUBAN accounts with instant automated payment notifications via webhooks.
- 🇺🇸 **United States Dollar (USD)**: CFSB Virtual Accounts with dedicated ACH Routing Numbers and Fedwire settlement.
- 🇪🇺 **Euro (EUR)**: Dedicated SEPA IBANs supporting instant euro transfers across 36 European nations.
- 🇬🇧 **British Pound (GBP)**: Dedicated UK Faster Payments Sort Codes and Account Numbers.
- 🇰🇪 **Kenyan Shilling (KES)**: Automated Mobile Money integrations (Safaricom M-Pesa & Airtel Money) with instant USSD push triggers.

### 2. Supported Blockchain Networks (NEAR MPC 10-Chain Standard)
Proxim derives unified receiving coordinates for every personal and business profile across 10 major blockchain ecosystems:

1. 🔷 **EVM Networks**: Single derived `0x...` address supporting **Base**, **Ethereum**, **BNB Smart Chain (BSC)**, **Polygon**, **Arbitrum One**, **Optimism (OP Mainnet)**, and **Avalanche C-Chain**.
2. 🟣 **Solana**: Native SOL and all SPL token deposits.
3. 🟠 **Bitcoin (BTC)**: Native SegWit (`bc1q...`), Taproot (`bc1p...`), and Legacy Bitcoin network receiving.
4. 🟢 **NEAR Protocol**: Human-readable named accounts (`{username}.proximfi.near` for Personal and `{username}-biz.proximfi.near` for Business).
5. 🔴 **TRON**: TRX and native USDT-TRC20 deposits.
6. 💎 **TON (The Open Network)**: Telegram native TON and Jetton tokens.
7. 🌊 **Sui Network**: Native SUI and ecosystem tokens.
8. 🚀 **Aptos**: Move-based ecosystem assets.
9. ⚛️ **Cosmos Hub**: IBC ecosystem and ATOM tokens.
10. ✕ **XRP Ledger**: Ripple XRP settlement.

---

## 4. Product Features & Capabilities

### A. Dual Account Hierarchy (Personal & Business)
Users toggle between their **Personal** and **Business** accounts with one tap:
- **Segregated Balances**: Separate double-entry ledgers ensure personal savings never mix with company cash flow.
- **Custom Identifiers**: Personal profiles use handles (`username.proximfi.near`); businesses receive corporate tags (`username-biz.proximfi.near` and `COMPANY_BIZ` tags).
- **Independent Card Portfolios**: Issue personal daily spending cards or company operational expense cards.

### B. Instant Multi-Chain Invoicing Engine
- Generate professional, vectorized SVG invoices directly inside the webapp or Telegram bot.
- Real-time conversion quotes with itemized deliverables, payment terms, and direct Base USDC settlement links.
- Payment links support instant one-tap settlement across cards, bank transfers, or digital assets.

### C. Institutional Yield & Automated Savings (Auto-Save Buffer)
- **Kamino Liquidity Vaults**: Earn up to 7.8% APY on idle dollar balances with institutional risk management.
- **Ondo Short-Term US Treasuries (USDY)**: Earn 5.15% APY backed by bankruptcy-remote US government paper.
- **Automated Liquid Buffers**: Configure custom liquidity thresholds (e.g. keep $100 liquid in checking, automatically route any excess into daily-compounding yield vaults).

### D. Virtual & Physical VISA Debit Cards
- Instant digital card issuance linked to your Proxim balance.
- Spend globally online or in-store with Apple Pay and Google Pay support.
- Granular controls: Instant freeze/unfreeze, configurable daily/monthly spending caps, and biometric PIN reveals.

### E. Telegram Conversational Financial OS (`@proximfibot`)
- Complete financial management inside Telegram via natural language conversations:
  - *"Send $150 to David"*
  - *"Invoice Acme Corp for $2,500: Product Design & Strategy"*
  - *"Deposit money via Solana or Bank Transfer"*
  - *"What is my available balance across all currencies?"*
- Protected by interactive PIN authorization modals and prompt injection firewalls.

---

## 5. User Journey & Onboarding Tiers

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       PROXIM USER ONBOARDING                                     │
└─────────────────────────────────┬──────────────────────────────────────┬─────────────────────────┘
                                  │                                      │
                 ┌────────────────▼───────────────┐    ┌─────────────────▼──────────────┐
                 │     MOBILE WEB APPLICATION     │    │      TELEGRAM FINANCIAL BOT    │
                 │   • Social / Email / Privy     │    │   • Instant @username Onboard  │
                 └────────────────┬───────────────┘    └─────────────────┬──────────────┘
                                  │                                      │
                                  └──────────────────┬───────────────────┘
                                                     │
                                  ┌──────────────────▼──────────────────┐
                                  │      TIER 1: ON-CHAIN INSTANT       │
                                  │  • Zero ID / Instant Activation     │
                                  │  • 10-Chain NEAR MPC Addresses      │
                                  │  • NEAR Intent Auto-USDC Conversion │
                                  │  • Kamino & Ondo Yield Access       │
                                  │  • Instant Invoicing Engine         │
                                  └──────────────────┬──────────────────┘
                                                     │
                                  ┌──────────────────▼──────────────────┐
                                  │   TIER 2: FULL GLOBAL BANKING TIER  │
                                  │  • 2-Minute EaseID Verification     │
                                  │  • Dedicated NGN NUBAN (Providus)   │
                                  │  • Dedicated USD ACH / Wire (CFSB)  │
                                  │  • Dedicated EUR SEPA & GBP Sort    │
                                  │  • Virtual & Physical VISA Cards    │
                                  │  • Kenyan Mobile Money (M-Pesa)     │
                                  └─────────────────────────────────────┘
```

---

## 6. Security, Compliance & Mathematical Invariants

1. **Deterministic Double-Entry Integrity**:
   - Every transfer requires an equal debit and credit entry across system accounts.
   - Background reconciliation audits execute every 15 minutes to guarantee exact mathematical balance consistency.
2. **KMS Non-Custodial Key Isolation**:
   - Master relayer keys and user key derivations use hardware-level cryptographic isolation.
3. **Interactive Step-Up PIN Authorization**:
   - High-value transfers, card reveals, and entity changes require 6-digit PIN authorization with automated 3-attempt lockouts.
4. **Automated Sanctions & AML Screening**:
   - Incoming fiat deposits and wallet addresses are screened against international OFAC and PEP databases via EaseID.

---

## 7. Product Roadmap & Future Horizons

- **Q3 2026**: Multi-Signature Corporate Treasury Approvals for high-volume enterprise teams.
- **Q4 2026**: Direct Payroll Automated Clearing (Batch CSV uploads with automated FX conversion).
- **Q1 2027**: Native Mobile Applications on iOS & Android with Hardware Secure Enclave biometric signing.
- **Q2 2027**: Automated Corporate Tax & Accounting export integrations (Xero, QuickBooks, and CSV).

---

*Proxim Financial OS — Engineered for effortless global money.*
