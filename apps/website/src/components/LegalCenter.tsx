import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  FileText,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Globe,
  Building2,
  Wallet,
  Scale,
  Users,
  Key,
  Clock,
  ExternalLink,
  Search,
  ArrowLeft,
  Printer,
  ChevronRight,
  ShieldCheck,
  Eye,
  Zap,
  Smartphone,
  Send,
  HelpCircle,
  FileCheck,
  AlertCircle,
  Server,
  Layers,
} from 'lucide-react';

export type LegalCategory = 'terms' | 'privacy' | 'compliance';

export interface LegalCenterProps {
  onBackToHome: () => void;
  initialTab?: LegalCategory;
  initialSubpage?: string;
}

interface SubPageItem {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ReactNode;
}

export const LegalCenter: React.FC<LegalCenterProps> = ({
  onBackToHome,
  initialTab = 'terms',
  initialSubpage,
}) => {
  const [activeTab, setActiveTab] = useState<LegalCategory>(initialTab);
  const [activeSubpage, setActiveSubpage] = useState<string>(initialSubpage || 'terms-general');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Handle hash changes or deep links
  useEffect(() => {
    if (initialSubpage) {
      setActiveSubpage(initialSubpage);
    } else {
      if (activeTab === 'terms') setActiveSubpage('terms-general');
      else if (activeTab === 'privacy') setActiveSubpage('privacy-collection');
      else if (activeTab === 'compliance') setActiveSubpage('compliance-aml');
    }
  }, [activeTab, initialSubpage]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeSubpage, activeTab]);

  const handlePrint = () => {
    window.print();
  };

  const termsSubpages: SubPageItem[] = [
    {
      id: 'terms-general',
      title: 'Platform Terms & Account Agreement',
      subtitle: 'Core eligibility, registration & service nature',
      badge: 'Core Terms',
      icon: <Scale className="w-4 h-4 text-[#35D9D0]" />,
    },
    {
      id: 'terms-vaults',
      title: 'Multi-Currency Balances & Safeguarding',
      subtitle: 'Custody, partner banks & fund segregation',
      badge: 'Vaults & Rails',
      icon: <Wallet className="w-4 h-4 text-[#16C7B7]" />,
    },
    {
      id: 'terms-transfers',
      title: 'Payments, Instant Payouts & FX',
      subtitle: 'Local bank settlement, rates & fee transparency',
      badge: 'Settlement',
      icon: <Send className="w-4 h-4 text-[#7567F8]" />,
    },
    {
      id: 'terms-cards',
      title: 'Virtual Cards Agreement',
      subtitle: 'Multi-currency debit issuance & spend rules',
      badge: 'Cardholder Policy',
      icon: <CreditCard className="w-4 h-4 text-[#FF5DA8]" />,
    },
    {
      id: 'terms-business',
      title: 'Business, Payroll & Developer APIs',
      subtitle: 'Commercial accounts, mass payouts & REST APIs',
      badge: 'Commercial',
      icon: <Building2 className="w-4 h-4 text-[#35D9D0]" />,
    },
    {
      id: 'terms-acceptable-use',
      title: 'Acceptable Use & Restricted Activities',
      subtitle: 'Prohibited transactions & compliance enforcement',
      badge: 'Enforcement',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    },
  ];

  const privacySubpages: SubPageItem[] = [
    {
      id: 'privacy-collection',
      title: 'Information We Collect',
      subtitle: 'Identity data, KYC records & transaction logs',
      badge: 'Data Inventory',
      icon: <Eye className="w-4 h-4 text-[#35D9D0]" />,
    },
    {
      id: 'privacy-usage',
      title: 'How We Process Data & Legal Basis',
      subtitle: 'Contractual necessity, AML compliance & consent',
      badge: 'Processing Basis',
      icon: <FileText className="w-4 h-4 text-[#16C7B7]" />,
    },
    {
      id: 'privacy-sharing',
      title: 'Third-Party Sharing & Banking Rails',
      subtitle: 'Licensed partner banks, card processors & KYC engines',
      badge: 'Partner Disclosures',
      icon: <Layers className="w-4 h-4 text-[#7567F8]" />,
    },
    {
      id: 'privacy-security',
      title: 'Data Retention & Encryption Standards',
      subtitle: 'AES-256 at rest, TLS 1.3 & statutory retention',
      badge: 'Security Posture',
      icon: <Lock className="w-4 h-4 text-[#FF5DA8]" />,
    },
    {
      id: 'privacy-rights',
      title: 'Your Privacy Rights (NDPR & GDPR)',
      subtitle: 'Access, rectification, erasure & consent revocation',
      badge: 'Statutory Rights',
      icon: <ShieldCheck className="w-4 h-4 text-[#35D9D0]" />,
    },
    {
      id: 'privacy-cookies',
      title: 'Cookies & Local Storage Policy',
      subtitle: 'Session authentication, security & telemetry tokens',
      badge: 'Session Tokens',
      icon: <Key className="w-4 h-4 text-[#16C7B7]" />,
    },
  ];

  const complianceSubpages: SubPageItem[] = [
    {
      id: 'compliance-aml',
      title: 'AML, CFT & Sanctions Compliance',
      subtitle: 'OFAC/UN screening, PEP checks & transaction monitoring',
      badge: 'AML/CFT Framework',
      icon: <Shield className="w-4 h-4 text-[#35D9D0]" />,
    },
    {
      id: 'compliance-kyc',
      title: 'Identity Verification & Tier Limits',
      subtitle: 'Tier 1 to Tier 3 requirements (BVN, NIN, Passport)',
      badge: 'Verification Matrix',
      icon: <Users className="w-4 h-4 text-[#16C7B7]" />,
    },
    {
      id: 'compliance-disputes',
      title: 'Disputes, Chargebacks & Refunds',
      subtitle: 'Resolution timelines, card scheme rules & error claims',
      badge: 'Dispute Rules',
      icon: <FileCheck className="w-4 h-4 text-[#7567F8]" />,
    },
    {
      id: 'compliance-security',
      title: 'User Security & Account Safeguards',
      subtitle: 'Biometric passkeys, 2FA, session rules & device safety',
      badge: 'Account Defense',
      icon: <Lock className="w-4 h-4 text-[#FF5DA8]" />,
    },
    {
      id: 'compliance-esign',
      title: 'Electronic Communications (E-Sign)',
      subtitle: 'Consent for electronic disclosures, receipts & Telegram alerts',
      badge: 'Digital Consent',
      icon: <Smartphone className="w-4 h-4 text-[#35D9D0]" />,
    },
  ];

  const currentSubpages =
    activeTab === 'terms'
      ? termsSubpages
      : activeTab === 'privacy'
      ? privacySubpages
      : complianceSubpages;

  const filteredSubpages = searchQuery.trim()
    ? currentSubpages.filter(
        (sp) =>
          sp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sp.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sp.badge.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentSubpages;

  return (
    <div className="min-h-screen bg-[#060B14] text-[#F7F8F4] font-sans antialiased overflow-x-hidden">
      {/* ── TOP NAVIGATION BAR ── */}
      <header className="sticky top-0 z-50 bg-[#060B14]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToHome}
              className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-white/70 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl border border-white/10 min-h-[44px]"
              aria-label="Back to Proxim home"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </button>
            <div className="h-4 w-px bg-white/20 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <img src="/proxim-icon.png" alt="Proxim" className="w-6 h-6 rounded-lg object-cover" />
              <span className="font-extrabold text-white text-base tracking-tight font-display">Proxim</span>
              <span className="text-xs bg-[#35D9D0]/10 text-[#35D9D0] border border-[#35D9D0]/20 px-2.5 py-0.5 rounded-full font-mono font-semibold hidden md:inline-block">
                Legal &amp; Compliance Hub
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl border border-white/10 transition-colors min-h-[44px]"
              title="Print document or save as PDF"
            >
              <Printer className="w-4 h-4 text-[#35D9D0]" />
              <span className="hidden sm:inline">Print / Save PDF</span>
            </button>
            <a
              href="mailto:compliance@proximfi.xyz"
              className="btn-primary !text-xs !py-2 !px-4 !rounded-xl flex items-center gap-1.5 shrink-0 min-h-[44px]"
            >
              <span>Legal Inquiries</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO BANNER ── */}
      <section className="relative pt-10 pb-8 px-4 sm:px-8 border-b border-white/10 bg-gradient-to-b from-[#0B1220] to-[#060B14]">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#35D9D0]">
            <span className="bg-[#35D9D0]/10 px-2 py-0.5 rounded-md border border-[#35D9D0]/20 font-bold">
              OFFICIAL DISCLOSURES
            </span>
            <span>•</span>
            <span className="text-white/60">Version 2.4.0 (November 2026 Edition)</span>
            <span>•</span>
            <span className="text-[#16C7B7] font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Licensed Partner Banking Model
            </span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight font-display">
                Terms of Service, Privacy &amp; Regulatory Verifications
              </h1>
              <p className="text-sm sm:text-base text-white/70 leading-relaxed">
                Clear, transparent, and binding legal terms governing multi-currency balances, partner banking rails,
                virtual card programs, cross-border remittances, and automated AML/CFT compliance standards across
                Proxim's web, Telegram, and developer infrastructure.
              </p>
            </div>

            {/* Quick Metadata Box */}
            <div className="p-4 rounded-2xl bg-[#0B111E] border border-white/10 text-xs text-white/70 space-y-1.5 shrink-0 min-w-[280px]">
              <div className="flex justify-between items-center text-white font-bold">
                <span>Operating Entity:</span>
                <span className="text-[#35D9D0]">Proxim Inc. &amp; Tech Ltd</span>
              </div>
              <div className="flex justify-between items-center">
                <span>NUBAN Banking Partner:</span>
                <span className="font-semibold text-white">Providus Bank PLC</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Card Issuance Partner:</span>
                <span className="font-semibold text-white">Licensed Card Scheme Rails</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Data Protection:</span>
                <span className="font-semibold text-[#16C7B7]">NDPR / NDPA &amp; GDPR Compliant</span>
              </div>
            </div>
          </div>

          {/* ── PILLAR TAB SWITCHER ── */}
          <div className="flex flex-wrap gap-2 pt-4">
            <button
              onClick={() => setActiveTab('terms')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] ${
                activeTab === 'terms'
                  ? 'bg-gradient-to-r from-[#16C7B7] to-[#35D9D0] text-[#060B14] shadow-lg shadow-[#35D9D0]/20'
                  : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Terms of Service</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-black/20 font-mono">6 Sub-pages</span>
            </button>

            <button
              onClick={() => setActiveTab('privacy')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] ${
                activeTab === 'privacy'
                  ? 'bg-gradient-to-r from-[#16C7B7] to-[#35D9D0] text-[#060B14] shadow-lg shadow-[#35D9D0]/20'
                  : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Privacy Policy</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-black/20 font-mono">6 Sub-pages</span>
            </button>

            <button
              onClick={() => setActiveTab('compliance')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] ${
                activeTab === 'compliance'
                  ? 'bg-gradient-to-r from-[#16C7B7] to-[#35D9D0] text-[#060B14] shadow-lg shadow-[#35D9D0]/20'
                  : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Compliance &amp; Verifications</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-black/20 font-mono">5 Sub-pages</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col lg:flex-row gap-8">
        {/* ── LEFT NAVIGATION SIDEBAR ── */}
        <aside className="lg:w-80 shrink-0 space-y-6">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clauses or topics..."
              className="w-full bg-[#0B111E] text-white text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-xl border border-white/10 outline-none focus:border-[#35D9D0] transition-colors placeholder:text-white/30 min-h-[44px]"
            />
          </div>

          {/* Subpages Navigation List */}
          <div className="space-y-2">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#35D9D0] px-3 flex items-center justify-between">
              <span>
                {activeTab === 'terms'
                  ? 'Terms of Service Sections'
                  : activeTab === 'privacy'
                  ? 'Privacy & Data Protection'
                  : 'Compliance & Verification Matrix'}
              </span>
              <span className="text-white/40 font-mono text-[10px]">{filteredSubpages.length} items</span>
            </div>

            <div className="space-y-1.5">
              {filteredSubpages.map((item) => {
                const isActive = activeSubpage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSubpage(item.id)}
                    className={`w-full text-left p-3 rounded-2xl transition-all border flex items-start gap-3 min-h-[44px] ${
                      isActive
                        ? 'bg-[#0B1626] border-[#35D9D0]/50 shadow-md shadow-[#35D9D0]/10 text-white'
                        : 'bg-[#0B111E]/50 hover:bg-[#0B111E] border-white/5 hover:border-white/15 text-white/70 hover:text-white'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                        isActive ? 'bg-[#35D9D0]/20 text-[#35D9D0]' : 'bg-white/5 text-white/60'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs sm:text-[13px] font-bold truncate leading-tight">
                          {item.title}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-white/60 shrink-0">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/50 truncate leading-tight">{item.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Verification Audit Checklist Card */}
          <div className="p-4 rounded-2xl bg-[#09171C] border border-[#35D9D0]/20 space-y-3 text-xs">
            <div className="font-bold text-[#35D9D0] flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4" /> Banking &amp; Regulatory Verification
            </div>
            <p className="text-[11px] text-white/70 leading-relaxed">
              Proxim's systems, APIs, and partner banking workflows undergo periodic security and AML compliance
              audits.
            </p>
            <div className="space-y-1.5 pt-1 text-[11px]">
              <div className="flex items-center gap-2 text-white/90">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16C7B7] shrink-0" />
                <span>100% Segregated Customer Balances</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16C7B7] shrink-0" />
                <span>Automated OFAC &amp; UN Sanctions Checks</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16C7B7] shrink-0" />
                <span>PCI-DSS Level 1 Compliant Card Rails</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16C7B7] shrink-0" />
                <span>Zero Technical Crypto Expositions</span>
              </div>
            </div>
          </div>

          {/* Contact Support Link */}
          <div className="p-4 rounded-2xl bg-[#0B111E] border border-white/10 space-y-2 text-xs">
            <div className="font-bold text-white flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-[#35D9D0]" /> Need Verification Assistance?
            </div>
            <p className="text-[11px] text-white/60">
              For compliance audits, banking questionnaires, or law enforcement inquiries:
            </p>
            <a
              href="mailto:compliance@proximfi.xyz"
              className="text-[#35D9D0] hover:underline font-mono text-[11px] block"
            >
              compliance@proximfi.xyz
            </a>
          </div>
        </aside>

        {/* ── MAIN LEGAL TEXT BODY ── */}
        <main className="flex-1 min-w-0 space-y-8">
          {/* Breadcrumb Header */}
          <div className="flex items-center gap-2 text-xs font-mono text-white/50 border-b border-white/10 pb-4">
            <span>PROXIM LEGAL</span>
            <ChevronRight className="w-3 h-3" />
            <span className="uppercase text-[#35D9D0] font-semibold">{activeTab}</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white font-semibold">{activeSubpage}</span>
          </div>

          {/* ══════════════════════════════════════════════════════
              TERMS OF SERVICE SUBPAGES
             ══════════════════════════════════════════════════════ */}
          {activeTab === 'terms' && (
            <div className="space-y-8">
              {activeSubpage === 'terms-general' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-[#35D9D0] uppercase tracking-wider font-bold">
                      Section 1.0 • Master Agreement
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      Platform Terms &amp; Account Agreement
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-TOS-GEN-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0B1626] border border-[#35D9D0]/30 text-xs sm:text-sm text-white/90 space-y-2">
                    <div className="font-bold text-[#35D9D0] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Important Regulatory Notice: Proxim Financial Technology
                      Model
                    </div>
                    <p className="leading-relaxed text-white/80">
                      Proxim Inc. and its affiliated entity Proxim Technologies Limited ("Proxim", "we", "us", or "our")
                      operate as a modern financial technology platform, not a licensed commercial bank. All deposit-taking,
                      dedicated virtual account number (NUBAN) generation, and payment settlement services are provided in
                      strict partnership with licensed financial institutions, including Providus Bank PLC and authorized
                      international payment rails.
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <h3 className="text-base sm:text-lg font-bold text-white font-display">1. Acceptance of Terms</h3>
                    <p>
                      By accessing, creating an account with, or utilizing any services provided by Proxim via our website
                      (proximfi.xyz), mobile web interface, Telegram application bot (@payeetbot), or developer API, you
                      ("User", "Customer", or "Merchant") agree to be irrevocably bound by these Terms of Service. If you
                      do not agree to these terms, you must refrain from using the platform immediately.
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">2. Eligibility &amp; Identity Verification</h3>
                    <p>
                      To use Proxim, you must be an individual at least 18 years old or a duly incorporated legal entity with
                      full legal capacity to enter into binding agreements. You represent and warrant that:
                    </p>
                    <ul className="list-disc list-inside space-y-1.5 pl-2 text-white/70">
                      <li>All information provided during onboarding is truthful, accurate, and up to date;</li>
                      <li>You are not subject to any international sanctions lists (including OFAC, EU, UN, or UK sanctions);</li>
                      <li>You will provide verifiable statutory documentation (such as BVN, NIN, National Identity Card, or International Passport) when prompted by our verification matrix;</li>
                      <li>You will not use Proxim on behalf of an undisclosed third party or for unauthorized commercial reselling.</li>
                    </ul>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">3. Multi-Interface Access &amp; Telegram Channel Rules</h3>
                    <p>
                      Proxim provides access to money management tools across mobile browsers and Telegram (@payeetbot).
                      Transactions initiated via our Telegram bot carry the exact same legal validity and financial
                      authorization as transactions authorized via our primary application. You are solely responsible for
                      maintaining the security of your Telegram account, phone device, and personal authentication PIN.
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">4. Account Security &amp; Unauthorized Access</h3>
                    <p>
                      You agree to immediately notify Proxim at{' '}
                      <span className="text-[#35D9D0] font-mono">support@proximfi.xyz</span> if you suspect any
                      compromise of your login credentials, passcodes, or device. Proxim is not liable for losses resulting
                      from user negligence, credential sharing, phishing, or social engineering attacks targeting your
                      underlying messaging or device accounts.
                    </p>
                  </div>
                </div>
              )}

              {activeSubpage === 'terms-vaults' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-[#16C7B7] uppercase tracking-wider font-bold">
                      Section 2.0 • Balances &amp; Custody
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      Multi-Currency Balances &amp; Safeguarding
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-TOS-VAULT-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#09171C] border border-[#16C7B7]/30 text-xs sm:text-sm text-white/90 space-y-2">
                    <div className="font-bold text-[#16C7B7] flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> 100% Segregated Customer Asset Safeguarding
                    </div>
                    <p className="leading-relaxed text-white/80">
                      Customer balances held in Proxim accounts are 100% segregated from Proxim's corporate operating funds.
                      Funds are safeguarded with authorized institutional custodians and licensed commercial banks. Customer
                      funds are never re-hypothecated, loaned, or used for proprietary trading activities.
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <h3 className="text-base sm:text-lg font-bold text-white font-display">1. Multi-Currency Accounts</h3>
                    <p>
                      Proxim permits eligible verified users to hold, convert, and manage balances across multiple
                      currencies, including Nigerian Naira (NGN), US Dollars (USD), Euros (EUR), British Pounds (GBP),
                      Kenyan Shillings (KES), and Ghanaian Cedis (GHS).
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">2. Dedicated NUBAN Bank Accounts</h3>
                    <p>
                      For Nigerian Naira deposits, Proxim provides customers with a dedicated Nigerian Uniform Bank Account
                      Number (NUBAN) issued via our partner commercial bank, Providus Bank PLC. Deposits into this account
                      reflect instantly in your Proxim balance upon clearing through the Nigeria Inter-Bank Settlement System
                      (NIBSS).
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">3. Global Settlement Reserves &amp; Digital Currencies</h3>
                    <p>
                      For international balances, Proxim utilizes 1:1 asset-backed reserves held with regulated custodial
                      partners. Balances are fully redeemable at par value upon user withdrawal into supported local bank
                      accounts or payment rails.
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">4. No Interest Accrual</h3>
                    <p>
                      Proxim balances do not accrue interest, yields, or dividends. Proxim is a payment and transaction
                      management tool, and account balances must not be treated as high-yield investment or interest-bearing
                      securities accounts.
                    </p>
                  </div>
                </div>
              )}

              {activeSubpage === 'terms-transfers' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-[#7567F8] uppercase tracking-wider font-bold">
                      Section 3.0 • Settlement &amp; Exchange
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      Payments, Instant Payouts &amp; FX Conversions
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-TOS-PAY-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <h3 className="text-base sm:text-lg font-bold text-white font-display">1. Payment Authorization &amp; Finality</h3>
                    <p>
                      Once you authorize a transfer or payout (whether through the web interface, biometric confirmation, or
                      Telegram bot confirmation), the instruction is sent to partner settlement rails immediately. Because
                      settlements clear in real-time (often within 30 seconds into destination bank accounts), completed
                      transfers are final, irreversible, and non-recallable.
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">2. Foreign Exchange Rates &amp; Transparency</h3>
                    <p>
                      When you convert between currencies, Proxim provides a locked, guaranteed conversion quote before
                      execution. We disclose the exact rate and any applicable processing fees upfront. There are no hidden
                      spreads or retroactive foreign exchange adjustments once an exchange is confirmed.
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">3. Payout Speed Guarantees &amp; Rail Delays</h3>
                    <p>
                      While typical bank settlements occur in under 30 seconds via instant payment rails (NIBSS Instant
                      Payment, SEPA Instant, Faster Payments, M-Pesa), occasional delays may occur due to external bank
                      downtime, central switch maintenance, or mandatory compliance reviews. Proxim will keep you updated
                      via transaction status webhooks and notifications.
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">4. Execution Limits</h3>
                    <p>
                      Daily and per-transaction limits apply based on your completed KYC verification tier (detailed in the
                      Compliance Matrix). Any transaction exceeding your tier limit will be held pending additional identity
                      verification.
                    </p>
                  </div>
                </div>
              )}

              {activeSubpage === 'terms-cards' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-[#FF5DA8] uppercase tracking-wider font-bold">
                      Section 4.0 • Cardholder Policy
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      Virtual Cards Agreement &amp; Cardholder Rules
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-TOS-CARD-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#1A0D1A] border border-[#FF5DA8]/30 text-xs sm:text-sm text-white/90 space-y-2">
                    <div className="font-bold text-[#FF5DA8] flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Licensed Virtual Card Issuance Program
                    </div>
                    <p className="leading-relaxed text-white/80">
                      Virtual debit cards issued via Proxim are powered by licensed payment network partners (such as
                      Nuvion and authorized Visa/Mastercard principal member institutions). All card issuance complies with
                      PCI-DSS Level 1 specifications and international cardholder safety guidelines.
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <h3 className="text-base sm:text-lg font-bold text-white font-display">1. Card Creation &amp; Funding</h3>
                    <p>
                      Eligible Tier 2 and Tier 3 verified users can create multi-currency virtual debit cards directly in the
                      app. Cards are funded directly from your Proxim balances and can be utilized for online purchases,
                      global software subscriptions (e.g., Netflix, Apple, AWS, Google Cloud), and authorized e-commerce
                      merchants.
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">2. Spend Limits &amp; Card Freezing</h3>
                    <p>
                      You maintain continuous control over your virtual cards. You can freeze, unfreeze, terminate, or set
                      monthly and per-transaction spending limits instantly through the application interface.
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">3. Recurring Subscriptions &amp; Pre-authorizations</h3>
                    <p>
                      Merchants may place authorization holds to verify card validity. You are responsible for ensuring
                      sufficient funds exist in your card or linked balance to honor recurring subscription agreements you
                      have authorized. Repeated declined transactions due to insufficient funds may result in automated card
                      suspension.
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">4. Prohibited Card Usage</h3>
                    <p>
                      Virtual cards may not be used for cash advances, peer-to-peer card funding, online gambling,
                      unregistered financial services, or merchants operating in restricted jurisdictions.
                    </p>
                  </div>
                </div>
              )}

              {activeSubpage === 'terms-business' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-[#35D9D0] uppercase tracking-wider font-bold">
                      Section 5.0 • Commercial Terms
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      Business, Payroll &amp; Developer API Terms
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-TOS-BIZ-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <h3 className="text-base sm:text-lg font-bold text-white font-display">1. Business Accounts &amp; Treasury</h3>
                    <p>
                      Registered companies, startups, and institutions utilizing Proxim for corporate treasury, multi-currency
                      contractor payroll, and automated invoicing must undergo Tier 3 Corporate Due Diligence, including
                      submission of Certificate of Incorporation, Memorandum and Articles of Association, and Ultimate
                      Beneficial Owner (UBO) disclosures.
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">2. Developer API Keys &amp; Webhooks</h3>
                    <p>
                      Developers accessing Proxim's REST APIs and automated webhooks are granted a revocable, non-exclusive
                      license to build programmatic payment integrations. API keys are confidential credentials and must be
                      stored securely in environment secrets. You are strictly liable for all financial actions executed
                      using your API keys.
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">3. Rate Limiting &amp; Infrastructure Protection</h3>
                    <p>
                      Proxim imposes rate limits on API endpoints to safeguard system reliability. Attempting to circumvent
                      rate limits, execute denial-of-service tests without written authorization, or conduct reverse
                      engineering of our core banking integrations is strictly prohibited and grounds for immediate API
                      termination.
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">4. Mass Payouts &amp; Beneficiary Validation</h3>
                    <p>
                      Merchants utilizing batch payroll payouts must verify recipient account numbers prior to executing
                      disbursement batches. Proxim provides real-time name lookup APIs to minimize human errors.
                    </p>
                  </div>
                </div>
              )}

              {activeSubpage === 'terms-acceptable-use' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-amber-400 uppercase tracking-wider font-bold">
                      Section 6.0 • Platform Safety
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      Acceptable Use &amp; Prohibited Activities
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-TOS-AUP-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs sm:text-sm text-white/90 space-y-2">
                    <div className="font-bold text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Zero Tolerance for Financial Crimes &amp; Fraud
                    </div>
                    <p className="leading-relaxed text-white/80">
                      Proxim maintains automated 24/7 transaction monitoring algorithms. Accounts engaging in unlawful,
                      fraudulent, deceptive, or sanctioned activities will be immediately frozen, and suspicious activity
                      reports (SARs) will be submitted to the Nigerian Financial Intelligence Unit (NFIU) and global
                      statutory authorities.
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <h3 className="text-base sm:text-lg font-bold text-white font-display">Strictly Prohibited Transactions:</h3>
                    <ul className="list-disc list-inside space-y-2 pl-2 text-white/70">
                      <li><strong className="text-white">Fraud &amp; Impersonation:</strong> Phishing, romance scams, advance-fee fraud (419), business email compromise (BEC), and identity theft.</li>
                      <li><strong className="text-white">Money Laundering &amp; Terrorism:</strong> Layering illicit proceeds, terrorist financing, or evading statutory reporting limits.</li>
                      <li><strong className="text-white">Sanctioned Entities &amp; Jurisdictions:</strong> Any transfer involving individuals, entities, or territories sanctioned by the UN, OFAC, or the EU.</li>
                      <li><strong className="text-white">Unlicensed Financial Operations:</strong> Operating Ponzi schemes, multi-level marketing (MLM), unlicensed foreign exchange brokering, or unregistered lottery operations.</li>
                      <li><strong className="text-white">Illegal Goods &amp; Weapons:</strong> Purchase or sale of firearms, controlled substances, unlicensed pharmaceuticals, or human trafficking activities.</li>
                      <li><strong className="text-white">System Exploitation:</strong> Exploiting software bugs, attempting re-entrancy attacks on ledger balances, or abusing referral incentives.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PRIVACY POLICY SUBPAGES
             ══════════════════════════════════════════════════════ */}
          {activeTab === 'privacy' && (
            <div className="space-y-8">
              {activeSubpage === 'privacy-collection' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-[#35D9D0] uppercase tracking-wider font-bold">
                      Privacy • Section 1.0
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      Information We Collect
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-PRV-COL-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <p>
                      To deliver high-speed financial services, comply with Know Your Customer (KYC) requirements, and
                      protect your account from cyber fraud, Proxim collects specific categories of personal and financial
                      information.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="p-4 rounded-2xl bg-[#0B111E] border border-white/10 space-y-2">
                        <h4 className="font-bold text-white text-sm flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#35D9D0]" /> Identity &amp; Profile Data
                        </h4>
                        <p className="text-xs text-white/60">
                          Full legal name, email address, mobile phone number, date of birth, residential address, and
                          profile avatar.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#0B111E] border border-white/10 space-y-2">
                        <h4 className="font-bold text-white text-sm flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-[#16C7B7]" /> Statutory Verification Data
                        </h4>
                        <p className="text-xs text-white/60">
                          Bank Verification Number (BVN), National Identification Number (NIN), passport biometric scans,
                          and facial liveness verification video clips.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#0B111E] border border-white/10 space-y-2">
                        <h4 className="font-bold text-white text-sm flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-[#7567F8]" /> Financial &amp; Transaction Data
                        </h4>
                        <p className="text-xs text-white/60">
                          Bank account numbers, payout beneficiary details, transaction history, timestamps, foreign
                          exchange conversion rates, and invoice data.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#0B111E] border border-white/10 space-y-2">
                        <h4 className="font-bold text-white text-sm flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-[#FF5DA8]" /> Device &amp; Telemetry Data
                        </h4>
                        <p className="text-xs text-white/60">
                          IP address, device model, operating system version, browser user agent, location data for fraud
                          prevention, and session identifiers.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSubpage === 'privacy-usage' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-[#16C7B7] uppercase tracking-wider font-bold">
                      Privacy • Section 2.0
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      How We Process Data &amp; Legal Bases
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-PRV-USE-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <h3 className="text-base sm:text-lg font-bold text-white font-display">Lawful Grounds for Processing</h3>
                    <p>
                      Under the Nigeria Data Protection Act (NDPA / NDPR) and the EU General Data Protection Regulation
                      (GDPR), Proxim processes personal data only where a valid legal ground exists:
                    </p>

                    <div className="space-y-3 pt-2">
                      <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                        <span className="font-bold text-[#35D9D0] text-xs uppercase font-mono">1. Contractual Necessity</span>
                        <p className="text-xs text-white/70 mt-1">
                          Processing is necessary to execute money transfers, credit your NUBAN account, issue virtual
                          cards, and deliver customer support services.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                        <span className="font-bold text-[#16C7B7] text-xs uppercase font-mono">2. Legal &amp; Regulatory Obligation</span>
                        <p className="text-xs text-white/70 mt-1">
                          Fulfilling mandatory statutory anti-money laundering (AML), counter-terrorist financing (CFT),
                          tax reporting, and sanctions screening obligations enforced by financial regulators.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                        <span className="font-bold text-[#7567F8] text-xs uppercase font-mono">3. Legitimate Interests</span>
                        <p className="text-xs text-white/70 mt-1">
                          Detecting and preventing cyber-attacks, bot manipulation, fraudulent chargebacks, and continuous
                          enhancement of transaction routing infrastructure.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSubpage === 'privacy-sharing' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-[#7567F8] uppercase tracking-wider font-bold">
                      Privacy • Section 3.0
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      Third-Party Sharing &amp; Banking Rails
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-PRV-SHR-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0B1626] border border-[#7567F8]/30 text-xs sm:text-sm text-white/90 space-y-2">
                    <div className="font-bold text-[#7567F8] flex items-center gap-2">
                      <Lock className="w-4 h-4" /> Proxim Absolute Guarantee: We Never Sell Your Data
                    </div>
                    <p className="leading-relaxed text-white/80">
                      Proxim never sells, rents, monetizes, or trades personal customer information to third-party data
                      brokers or advertisers. Sharing occurs solely for the strict execution of financial transactions and
                      regulatory compliance.
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <h3 className="text-base sm:text-lg font-bold text-white font-display">Authorized Processing Partners</h3>
                    <ul className="list-disc list-inside space-y-2 pl-2 text-white/70">
                      <li><strong className="text-white">Partner Commercial Banks:</strong> Providus Bank PLC (for dedicated Nigerian NUBAN issuance and NIBSS clearing) and licensed international settlement banks.</li>
                      <li><strong className="text-white">Licensed Card Scheme Processors:</strong> Nuvion and authorized Visa/Mastercard processing centers for virtual card creation, spend authorizations, and chargeback clearing.</li>
                      <li><strong className="text-white">Statutory Identity Verification Providers:</strong> Government-licensed verification partners (e.g. Dojah, Smile Identity) to validate BVN, NIN, and biometric facial liveness checks.</li>
                      <li><strong className="text-white">Secure Cloud Hosting Infrastructure:</strong> ISO-27001 and SOC-2 Type II certified cloud data centers (AWS / Google Cloud Platform) with physical isolation and encrypted databases.</li>
                      <li><strong className="text-white">Regulatory &amp; Law Enforcement Bodies:</strong> Disclosures made solely pursuant to valid subpoenas, court orders, or statutory reporting obligations.</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeSubpage === 'privacy-security' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-[#FF5DA8] uppercase tracking-wider font-bold">
                      Privacy • Section 4.0
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      Data Retention &amp; Encryption Standards
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-PRV-SEC-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <h3 className="text-base sm:text-lg font-bold text-white font-display">1. Encryption at Rest &amp; in Transit</h3>
                    <p>
                      All customer data transmitted across Proxim servers, the mobile app, and Telegram bot connections is
                      encrypted in transit using Transport Layer Security (TLS 1.3). Sensitive data stored at rest—including
                      KYC identifiers, personal records, and database secrets—is encrypted with AES-256 GCM cryptographic
                      ciphers.
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">2. Statutory Retention Periods</h3>
                    <p>
                      In compliance with anti-money laundering regulations and Central Bank guidelines, financial transaction
                      records and KYC identity verification records must be retained for a mandatory minimum period of five
                      (5) to seven (7) years following account closure. Following the expiration of statutory retention
                      periods, data is permanently scrubbed using secure cryptographic erasure.
                    </p>
                  </div>
                </div>
              )}

              {activeSubpage === 'privacy-rights' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-[#35D9D0] uppercase tracking-wider font-bold">
                      Privacy • Section 5.0
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      Your Global Privacy Rights (NDPR, GDPR &amp; CCPA)
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-PRV-RGT-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <p>
                      Depending on your geographical location and applicable laws, you hold the following rights regarding
                      your personal data:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        <span className="font-bold text-[#35D9D0] text-xs">Right to Access</span>
                        <p className="text-xs text-white/60">
                          Request a complete export of the personal and financial transaction data held on your profile.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        <span className="font-bold text-[#16C7B7] text-xs">Right to Rectification</span>
                        <p className="text-xs text-white/60">
                          Update inaccurate or incomplete profile details via verified customer identity proof.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        <span className="font-bold text-[#7567F8] text-xs">Right to Erasure (Deletion)</span>
                        <p className="text-xs text-white/60">
                          Request erasure of your account, subject to statutory 5-year anti-money laundering recordkeeping rules.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        <span className="font-bold text-[#FF5DA8] text-xs">Right to Complain</span>
                        <p className="text-xs text-white/60">
                          Lodge inquiries or complaints with data protection regulators (such as the Nigeria Data Protection
                          Commission - NDPC).
                        </p>
                      </div>
                    </div>

                    <p className="pt-2">
                      To exercise any privacy rights, email our Data Protection Officer at{' '}
                      <span className="text-[#35D9D0] font-mono">privacy@proximfi.xyz</span>.
                    </p>
                  </div>
                </div>
              )}

              {activeSubpage === 'privacy-cookies' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-[#16C7B7] uppercase tracking-wider font-bold">
                      Privacy • Section 6.0
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      Cookies &amp; Local Storage Policy
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-PRV-COK-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <p>
                      Proxim uses strictly necessary browser cookies and secure local storage mechanisms. We do not employ
                      invasive third-party ad retargeting trackers.
                    </p>
                    <ul className="list-disc list-inside space-y-2 pl-2 text-white/70">
                      <li><strong className="text-white">Essential Security Tokens:</strong> Cryptographically signed session tokens required to authenticate your login sessions and prevent cross-site request forgery (CSRF).</li>
                      <li><strong className="text-white">Fraud Prevention Cookies:</strong> Device signature hashes used to identify unrecognized devices attempting unauthorized account takeovers.</li>
                      <li><strong className="text-white">User Preferences:</strong> Storing currency preferences and interface theme parameters.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              COMPLIANCE & VERIFICATION SUBPAGES
             ══════════════════════════════════════════════════════ */}
          {activeTab === 'compliance' && (
            <div className="space-y-8">
              {activeSubpage === 'compliance-aml' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-[#35D9D0] uppercase tracking-wider font-bold">
                      Compliance • Framework 1.0
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      Anti-Money Laundering (AML) &amp; Sanctions Framework
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-CMP-AML-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#09171C] border border-[#35D9D0]/30 text-xs sm:text-sm text-white/90 space-y-2">
                    <div className="font-bold text-[#35D9D0] flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Global AML / CFT Compliance Standards
                    </div>
                    <p className="leading-relaxed text-white/80">
                      Proxim adheres to international recommendations established by the Financial Action Task Force (FATF),
                      regulations of the Central Bank of Nigeria (CBN), and financial crime enforcement protocols. Our
                      automated screening engine checks all users against global sanctions and politically exposed persons
                      (PEP) lists in real-time.
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <h3 className="text-base sm:text-lg font-bold text-white font-display">Core AML Program Pillars:</h3>
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        <span className="font-bold text-[#35D9D0] text-xs">1. Automated Sanctions &amp; PEP Screening</span>
                        <p className="text-xs text-white/70">
                          Continuous automated screening against the US Office of Foreign Assets Control (OFAC), United
                          Nations Security Council, European Union, and UK HM Treasury consolidated lists.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        <span className="font-bold text-[#16C7B7] text-xs">2. Continuous Transaction Monitoring</span>
                        <p className="text-xs text-white/70">
                          Automated heuristic algorithms evaluate transactional velocity, unusual spikes, geographic
                          anomalies, and split-structuring patterns designed to avoid statutory thresholds.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        <span className="font-bold text-[#7567F8] text-xs">3. Suspicious Activity Reporting (SAR)</span>
                        <p className="text-xs text-white/70">
                          Mandatory filing of Suspicious Activity Reports (SAR) and Currency Transaction Reports (CTR) to
                          the Nigerian Financial Intelligence Unit (NFIU) and designated anti-graft agencies without tipping
                          off the customer.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSubpage === 'compliance-kyc' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-[#16C7B7] uppercase tracking-wider font-bold">
                      Compliance • Framework 2.0
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      Identity Verification (KYC) Tiers &amp; Limits Matrix
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-CMP-KYC-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <p>
                      To balance rapid customer onboarding with strict financial security, Proxim implements a progressive
                      three-tier Know Your Customer (KYC) matrix:
                    </p>

                    {/* Verification Tier Table */}
                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0B111E]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white/5 text-[#35D9D0] uppercase font-mono font-bold text-[11px] border-b border-white/10">
                          <tr>
                            <th className="p-3.5">Tier Level</th>
                            <th className="p-3.5">Required Documentation</th>
                            <th className="p-3.5">Daily Payout Limit</th>
                            <th className="p-3.5">Virtual Cards</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-white/80">
                          <tr>
                            <td className="p-3.5 font-bold text-white">Tier 1 (Starter)</td>
                            <td className="p-3.5">Verified Phone Number &amp; Legal Name</td>
                            <td className="p-3.5 font-mono text-[#35D9D0]">₦50,000 / $100</td>
                            <td className="p-3.5 text-white/40">Not Eligible</td>
                          </tr>
                          <tr>
                            <td className="p-3.5 font-bold text-white">Tier 2 (Standard)</td>
                            <td className="p-3.5">BVN or NIN + Live Facial Liveness Match</td>
                            <td className="p-3.5 font-mono text-[#16C7B7]">₦5,000,000 / $5,000</td>
                            <td className="p-3.5 text-[#16C7B7] font-semibold">Eligible (Up to 3 Cards)</td>
                          </tr>
                          <tr>
                            <td className="p-3.5 font-bold text-white">Tier 3 (Institutional)</td>
                            <td className="p-3.5">Utility Bill (Proof of Address) + CAC Incorporation</td>
                            <td className="p-3.5 font-mono text-[#7567F8]">Unlimited / Custom Rails</td>
                            <td className="p-3.5 text-[#7567F8] font-semibold">Unlimited Corporate Cards</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeSubpage === 'compliance-disputes' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-[#7567F8] uppercase tracking-wider font-bold">
                      Compliance • Framework 3.0
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      Disputes, Chargebacks &amp; Refunds Policy
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-CMP-DIS-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <h3 className="text-base sm:text-lg font-bold text-white font-display">1. Bank Payout Dispute Resolution</h3>
                    <p>
                      If a beneficiary bank in Nigeria, Kenya, Ghana, or Europe reports a delayed or missing deposit despite
                      a "Success" notification from Proxim, our support team initiates a Session ID (NIBSS or SEPA trace)
                      lookup. Bank clearing investigations are resolved within 24 to 48 business hours.
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">2. Virtual Card Merchant Chargebacks</h3>
                    <p>
                      In the event of unauthorized merchant billing, defective goods, or fraudulent online card charges,
                      users may file a formal card dispute. Disputes are processed in accordance with international Visa and
                      Mastercard operating regulations. Cardholders must file dispute claims within thirty (30) calendar days
                      of transaction posting.
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-white font-display">3. Refund Processing</h3>
                    <p>
                      Refunds granted by online merchants credit back directly to the specific virtual card or underlying
                      currency balance from which the initial funds were deducted.
                    </p>
                  </div>
                </div>
              )}

              {activeSubpage === 'compliance-security' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-[#FF5DA8] uppercase tracking-wider font-bold">
                      Compliance • Framework 4.0
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      User Security &amp; Account Safeguards
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-CMP-SEC-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <h3 className="text-base sm:text-lg font-bold text-white font-display">Multi-Layer Account Protection:</h3>
                    <ul className="list-disc list-inside space-y-2 pl-2 text-white/70">
                      <li><strong className="text-white">Biometric Passkeys &amp; Face ID:</strong> Modern WebAuthn standards allow secure biometric logins without storing plaintext passwords on our servers.</li>
                      <li><strong className="text-white">Transfer PIN Verification:</strong> Every outbound money transfer requires secondary PIN verification.</li>
                      <li><strong className="text-white">Telegram Account Binding:</strong> Sessions initiated via @payeetbot verify unique Telegram IDs tied to pre-authenticated mobile device tokens.</li>
                      <li><strong className="text-white">Automated Bot Defense:</strong> Rate-limiting, brute-force mitigation, and automated IP anomaly blocks protect user vaults from credential stuffing.</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeSubpage === 'compliance-esign' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-mono text-[#35D9D0] uppercase tracking-wider font-bold">
                      Compliance • Framework 5.0
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 font-display">
                      Electronic Communications (E-Sign Consent)
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1">
                      Document Ref: PX-CMP-ESN-2026 • Last Updated: November 24, 2026
                    </p>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed">
                    <p>
                      By opening a Proxim account, you provide affirmative consent to receive all notices, periodic
                      transaction statements, regulatory updates, tax receipts, and fee revisions electronically.
                    </p>
                    <p>
                      Electronic notices will be delivered via your registered email address, in-app push alerts, or direct
                      Telegram notifications via @payeetbot. Electronic delivery carries the exact same legal force and
                      effect as physical paper mailings.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── FOOTER LEGAL NOTICE & CONTACT ── */}
          <div className="pt-8 border-t border-white/10 space-y-4 text-xs text-white/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-bold text-white text-xs">Proxim Technologies Inc. &amp; Proxim Technologies Limited</p>
                <p>Licensed Financial Technology &amp; Payment Software Infrastructure</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <a href="mailto:legal@proximfi.xyz" className="text-[#35D9D0] hover:underline">
                  legal@proximfi.xyz
                </a>
                <span>•</span>
                <a href="mailto:compliance@proximfi.xyz" className="text-[#16C7B7] hover:underline">
                  compliance@proximfi.xyz
                </a>
              </div>
            </div>
            <p className="text-[11px] text-white/40">
              © 2026 Proxim Inc. All rights reserved. Proxim is a technology company, not a bank. NUBAN accounts and
              settlement banking rails are provided by Providus Bank PLC and authorized deposit-taking institutions. Virtual
              cards are issued through licensed card scheme partner rails.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};
