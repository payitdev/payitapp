import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import {
  ArrowDownLeft, RefreshCw, Building2, ShieldCheck,
  ChevronRight, ChevronDown, Check, Search, Bell,
  Home, CreditCard, Send, PieChart, Grid, Wifi,
  TrendingUp, Globe, Smartphone, X, Sparkles, Zap,
  Menu, HelpCircle, Briefcase, Rocket, Store,
  UserCheck, Loader2, Mail, ArrowUpRight, Lock,
  Wallet, Layers, DollarSign, CheckCircle2, ArrowRight,
  Shield, Repeat, Activity, Server, Cpu, Copy, ExternalLink,
  Users, PiggyBank, LineChart, Award, CheckCircle, Clock, Code2,
  Terminal, FileText, CheckCheck, MessageSquare
} from 'lucide-react';
import { DeveloperDocs } from './components/DeveloperDocs';
import { DeveloperDashboard } from './components/DeveloperDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { SchoolConsole } from './components/SchoolConsole';

const APP_URL = 'https://app.proximfi.xyz/';
const TELEGRAM_URL = 'https://t.me/proximfibot';

const XIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const TelegramIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
  </svg>
);

/* ══════════════════════════════════════════════════════
   EXACT PROXIM BRAND GUIDE AURORA AUSTRALIS SKY
   Vertical ribbon rays (Cyan -> Blue -> Violet -> Magenta) + Mountain silhouettes
   ══════════════════════════════════════════════════════ */
const ProximBrandGuideSky = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 bg-[#060B14]">
    {/* Subtle Starry Night Particle Vignette */}
    <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#FFFFFF_1px,transparent_1px)] [background-size:24px_24px]" />

    {/* Dynamic Vertical Aurora Ribbon Wave 1 (Cyan & Teal) */}
    <div
      className="aurora-curtain-anim absolute top-0 right-1/4 w-[280px] sm:w-[420px] h-[900px] blur-[70px] opacity-85"
      style={{
        background: 'linear-gradient(175deg, rgba(53, 217, 208, 0.75) 0%, rgba(16, 199, 183, 0.60) 40%, rgba(74, 140, 255, 0.35) 75%, transparent 100%)',
        transform: 'rotate(-24deg) translateY(-80px)',
      }}
    />

    {/* Dynamic Vertical Aurora Ribbon Wave 2 (Electric Blue & Violet) */}
    <div
      className="aurora-curtain-anim absolute -top-12 right-1/6 w-[260px] sm:w-[380px] h-[950px] blur-[80px] opacity-90"
      style={{
        background: 'linear-gradient(175deg, rgba(74, 140, 255, 0.80) 0%, rgba(117, 103, 248, 0.65) 45%, rgba(255, 93, 168, 0.30) 80%, transparent 100%)',
        transform: 'rotate(-22deg) translateY(-60px)',
      }}
    />

    {/* Dynamic Vertical Aurora Ribbon Wave 3 (Vivid Magenta Sky Ribbon) */}
    <div
      className="aurora-magenta-anim absolute top-4 right-0 w-[240px] sm:w-[350px] h-[900px] blur-[75px] opacity-95"
      style={{
        background: 'linear-gradient(170deg, rgba(255, 93, 168, 0.90) 0%, rgba(117, 103, 248, 0.70) 50%, rgba(53, 217, 208, 0.25) 85%, transparent 100%)',
        transform: 'rotate(-20deg)',
      }}
    />

    {/* Mountain Ridge Silhouette Along Horizon */}
    <div className="absolute bottom-0 inset-x-0 h-32 sm:h-44 z-10 pointer-events-none opacity-90">
      <svg className="w-full h-full fill-[#060B14] preserve-3d" viewBox="0 0 1440 240" preserveAspectRatio="none">
        <path d="M0,240 L0,160 L120,130 L260,175 L420,110 L580,165 L760,90 L920,150 L1100,105 L1280,160 L1440,120 L1440,240 Z" />
      </svg>
    </div>

    {/* Deep Sky Darkness Base Overlay */}
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#060B14]/40 to-[#060B14]" />
  </div>
);

/* Motion Variants */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: (i as number) * 0.08 },
  }),
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

/* ══════════════════════════════════════════════════════
   COMING SOON VIEW
   ══════════════════════════════════════════════════════ */
const ComingSoonView = ({ onBackToHome }: { onBackToHome: () => void }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#060B14] text-[#F7F8F4] font-sans antialiased overflow-x-hidden relative flex flex-col justify-between">
      <ProximBrandGuideSky />

      {/* Top Header */}
      <header className="relative z-20 max-w-6xl mx-auto w-full px-6 sm:px-8 h-20 flex items-center justify-between">
        <button onClick={onBackToHome} className="flex items-center gap-3 group text-left" aria-label="Proxim Home">
          <img
            src="/proxim-icon.png"
            alt="Proxim Icon"
            className="w-8 h-8 rounded-xl object-cover transition-transform duration-200 group-hover:scale-105"
          />
          <span className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Proxim
          </span>
        </button>

        <button
          onClick={onBackToHome}
          className="text-sm font-semibold text-[#35D9D0] hover:text-white transition-colors flex items-center gap-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10"
        >
          ← Back to Overview
        </button>
      </header>

      {/* Main Content */}
      <main className="relative z-20 max-w-3xl mx-auto px-6 py-16 text-center space-y-8 my-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#35D9D0]/10 text-[#35D9D0] border border-[#35D9D0]/30 shadow-lg">
          <Sparkles className="w-3.5 h-3.5" /> Launching Soon
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-none uppercase">
            Coming Soon
          </h1>
          <p className="text-base sm:text-xl text-[#F7F8F4]/80 max-w-xl mx-auto leading-relaxed">
            We are putting the finishing touches on the Proxim mobile app, Telegram social banking layer, and developer APIs.
          </p>
        </div>

        {/* Waitlist Form */}
        <div className="max-w-md mx-auto card-glass p-6 sm:p-8 rounded-3xl border-white/15 bg-[#0F1524]/90 space-y-4 shadow-2xl">
          {submitted ? (
            <div className="space-y-2 py-4">
              <div className="w-12 h-12 rounded-full bg-[#16C7B7]/20 border border-[#16C7B7] flex items-center justify-center mx-auto text-[#35D9D0]">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">You're on the list!</h3>
              <p className="text-xs text-[#F7F8F4]/70">We'll notify you as soon as the platform goes live.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-xs font-bold text-white/70 uppercase tracking-wider">
                Get early access &amp; launch updates
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full bg-[#060B14] text-white text-sm px-4 py-3 rounded-xl border border-white/15 outline-none focus:border-[#35D9D0] transition-colors"
                />
                <button type="submit" className="btn-primary !text-sm !py-3 !px-6 shrink-0">
                  Notify Me
                </button>
              </div>
              <p className="text-[0.68rem] text-white/40">No spam. Only essential product updates.</p>
            </form>
          )}
        </div>

        {/* Feature Preview Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto pt-4 text-left">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <Smartphone className="w-4 h-4 text-[#16C7B7]" />
            <p className="text-xs font-bold text-white">Mobile Web App</p>
            <p className="text-[0.65rem] text-white/50">Multi-currency wallets</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <MessageSquare className="w-4 h-4 text-[#35D9D0]" />
            <p className="text-xs font-bold text-white">Telegram Layer</p>
            <p className="text-[0.65rem] text-white/50">@proximfibot in chat</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <Zap className="w-4 h-4 text-[#7567F8]" />
            <p className="text-xs font-bold text-white">Instant Payouts</p>
            <p className="text-[0.65rem] text-white/50">&lt; 30s bank clearing</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <Code2 className="w-4 h-4 text-[#FF5DA8]" />
            <p className="text-xs font-bold text-white">Developer APIs</p>
            <p className="text-[0.65rem] text-white/50">REST &amp; webhooks</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 py-8 text-center text-xs text-[#F7F8F4]/40 border-t border-white/10">
        <p>© 2026 Proxim Inc. All rights reserved.</p>
      </footer>
    </div>
  );
};

/* ══════════════════════════════════════════════════════
   MAIN APPLICATION
   ══════════════════════════════════════════════════════ */
export default function App() {
  const [activePage, setActivePage] = useState<'home' | 'coming-soon'>('home');
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [activeEntityTab, setActiveEntityTab] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL');
  const [phoneArtifactTab, setPhoneArtifactTab] = useState<'VAULTS' | 'SEND' | 'TELEGRAM'>('VAULTS');
  const [businessArtifactTab, setBusinessArtifactTab] = useState<'PAYROLL' | 'INVOICING' | 'TREASURY'>('PAYROLL');

  // FX Demo Transfer State
  const [sendAmount, setSendAmount] = useState('1000');
  const [sourceCurrency, setSourceCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  const [targetCurrency, setTargetCurrency] = useState<'NGN' | 'KES' | 'GHS'>('NGN');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const path = window.location.pathname;
      if (
        hash === '#coming-soon' ||
        hash === '#developers' ||
        hash === '#dashboard' ||
        hash === '#admin' ||
        hash === '#schools' ||
        path.startsWith('/developers') ||
        path.startsWith('/docs') ||
        path.startsWith('/dashboard') ||
        path.startsWith('/admin') ||
        path.startsWith('/schools')
      ) {
        setActivePage('coming-soon');
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (activePage === 'coming-soon') {
    return (
      <ComingSoonView
        onBackToHome={() => {
          setActivePage('home');
          if (window.history.pushState) window.history.pushState(null, '', '/');
        }}
      />
    );
  }


  const rates: Record<string, number> = {
    'USD-NGN': 1550,
    'USD-KES': 129,
    'USD-GHS': 15.5,
    'EUR-NGN': 1680,
    'EUR-KES': 140,
    'EUR-GHS': 16.8,
    'GBP-NGN': 1980,
    'GBP-KES': 165,
    'GBP-GHS': 19.8,
  };

  const calculatedOutput = (parseFloat(sendAmount || '0') * (rates[`${sourceCurrency}-${targetCurrency}`] || 1550)).toLocaleString('en-US', { maximumFractionDigits: 2 });

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const currenciesList = [
    { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', flag: '/flags/ng.png', route: 'Dedicated NUBAN Bank Payouts' },
    { code: 'USD', name: 'US Dollar', symbol: '$', flag: '/flags/us.png', route: 'ACH & FedWire Rails' },
    { code: 'EUR', name: 'Euro', symbol: '€', flag: '/flags/eu.png', route: 'SEPA Instant Transfer' },
    { code: 'GBP', name: 'British Pound', symbol: '£', flag: '/flags/gb.png', route: 'Faster Payments Network' },
    { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', flag: '/flags/ke.png', route: 'M-Pesa & Bank Deposit' },
    { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', flag: '/flags/gh.png', route: 'Mobile Money & Bank Settlement' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '/flags/za.png', route: 'EFT Instant Settlement' },
    { code: 'USDC', name: 'Digital Dollar', symbol: '$', flag: '/flags/usdc.png', route: '1:1 Dollar Liquidity Reserve' },
    { code: 'USDT', name: 'Tether USD', symbol: '$', flag: '/flags/usdt.png', route: 'Global Settlement Liquidity' },
    { code: 'BTC', name: 'Bitcoin', symbol: '₿', flag: '/flags/btc.png', route: 'Digital Asset Receiving' },
    { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', flag: '/flags/eth.png', route: 'Smart Settlement Rail' },
    { code: 'SOL', name: 'Solana', symbol: 'SOL', flag: '/flags/sol.png', route: 'High-Speed Settlement' },
  ];

  const faqs = [
    {
      q: 'What is Proxim?',
      a: 'Proxim is a modern financial platform that helps individuals and businesses hold, move, manage, and spend money across currencies. It unifies local bank accounts, cross-border transfers, business invoicing, staff payroll, and developer APIs into a single account accessible via web or Telegram.',
    },
    {
      q: 'How does Proxim work?',
      a: 'Proxim provides dedicated multi-currency account coordinates in supported currencies (such as NGN, USD, EUR, and Digital Dollars). When you receive money, you can hold it, convert it at transparent mid-market rates, spend it via cards where supported, or send it directly to bank accounts and mobile wallets in seconds.',
    },
    {
      q: 'What currencies are supported on Proxim?',
      a: 'Proxim supports key fiat currencies including Nigerian Naira (NGN), US Dollar (USD), Euro (EUR), British Pound (GBP), Kenyan Shilling (KES), Ghanaian Cedi (GHS), and South African Rand (ZAR), alongside Digital Dollars (USDC, USDT) and major digital assets (BTC, ETH, SOL, NEAR).',
    },
    {
      q: 'How do I add money to my Proxim account?',
      a: 'You can add money via direct local bank transfer to your dedicated virtual account (e.g. NGN Providus NUBAN, USD ACH/Wire, EUR SEPA), via mobile money (M-Pesa), or by depositing supported digital assets across 10+ networks that automatically convert into your balance.',
    },
    {
      q: 'How do I send money to local or international bank accounts?',
      a: 'Simply select the destination currency and enter the recipient\'s bank details or mobile wallet. Outbound payouts to local bank accounts across Africa, Europe, and the US settle in under 30 seconds with real-time tracking and zero hidden markup.',
    },
    {
      q: 'Can I use Proxim for my business?',
      a: 'Yes. Proxim includes a dedicated Business workspace with segregated balances, itemized invoicing, supplier payments, vendor settlements, and multi-currency treasury management—designed for both local and global companies.',
    },
    {
      q: 'Can local Nigerian businesses use Proxim?',
      a: 'Yes. A business does not have to operate internationally to benefit from Proxim. Local Nigerian businesses, retailers, and service providers use Proxim for everyday financial operations, dedicated NUBAN account collection, instant supplier payouts, and staff salary management.',
    },
    {
      q: 'Can I use Proxim for international trade and supplier payments?',
      a: 'Yes. Importers, exporters, and digital businesses use Proxim to pay overseas suppliers and remote contractors, lock in real-time mid-market FX rates, and avoid slow, expensive traditional bank wire delays.',
    },
    {
      q: 'How can I pay employees and contractors with Proxim?',
      a: 'Proxim supports batch payroll and recurring staff payouts. You can upload employee payout lists or trigger recurring salary runs in local currencies with automatic conversion and instant settlement.',
    },
    {
      q: 'Can developers and fintechs integrate Proxim into their products?',
      a: 'Yes. Proxim provides developer APIs, webhooks, and financial infrastructure that fintechs, neobanks, and software platforms can integrate to issue accounts, collect deposits, and execute automated payouts.',
    },
    {
      q: 'How can I access Proxim through Telegram?',
      a: 'You can open @proximfibot directly in Telegram to check balances, send money, generate invoices, and manage your account using natural conversations with bank-grade PIN authorization.',
    },
    {
      q: 'How is my account and money secured?',
      a: 'Proxim uses Privy passwordless authentication, multi-party cryptographic infrastructure, end-to-end encryption, and a strict double-entry ledger with automated 24/7 reconciliation to protect all customer balances.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#060B14] text-[#F7F8F4] font-sans antialiased overflow-x-hidden">

      {/* ──────────────────────────────────────────
          NAVIGATION BAR
          ────────────────────────────────────────── */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#060B14]/92 backdrop-blur-2xl border-b border-white/10 shadow-2xl'
          : 'bg-[#060B14]/50 backdrop-blur-md'
      }`}>
        <nav className="max-w-6xl mx-auto px-6 sm:px-8 h-16 sm:h-20 flex items-center justify-between">

          {/* Logo */}
          <a href="#" className="flex items-center gap-3 group shrink-0" aria-label="Proxim">
            <img
              src="/proxim-icon.png"
              alt="Proxim Icon"
              className="w-8 h-8 rounded-xl object-cover transition-transform duration-200 group-hover:scale-105"
            />
            <span className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Proxim
            </span>
          </a>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-7 text-sm font-500 text-[#F7F8F4]/80">
            <a href="#features" className="hover:text-white transition-colors duration-150">Features</a>
            <a href="#currencies" className="hover:text-white transition-colors duration-150">Currencies</a>
            <a href="#business" className="hover:text-white transition-colors duration-150">Business</a>
            <a href="#developers-section" className="hover:text-white transition-colors duration-150">Developers</a>
            <a href="#faq" className="hover:text-white transition-colors duration-150">FAQ</a>
          </div>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => setActivePage('coming-soon')}
              className="text-sm font-600 text-[#F7F8F4]/85 hover:text-white transition-colors px-3 py-2"
            >
              Sign in
            </button>
            <button
              onClick={() => setActivePage('coming-soon')}
              className="btn-primary !text-sm !py-2.5 !px-5"
            >
              Get started <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            className="md:hidden p-2.5 rounded-xl bg-white/10 border border-white/15 text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>

        {/* Mobile Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[#060B14] border-b border-white/10 px-6 py-6 space-y-4 shadow-2xl"
            >
              {[
                ['#features', 'Features'],
                ['#currencies', 'Currencies'],
                ['#business', 'Business'],
                ['#developers-section', 'Developers'],
                ['#faq', 'FAQ'],
              ].map(([h, l]) => (
                <a
                  key={h} href={h} onClick={() => setMobileMenuOpen(false)}
                  className="block py-4 text-base font-600 text-[#F7F8F4] border-b border-white/10 last:border-0"
                >
                  {l}
                </a>
              ))}
              <div className="pt-6 space-y-3">
                <button
                  onClick={() => { setActivePage('coming-soon'); setMobileMenuOpen(false); }}
                  className="w-full text-center block py-3 rounded-2xl font-700 text-sm bg-white/10 border border-white/15 text-white"
                >
                  Sign in
                </button>
                <button
                  onClick={() => { setActivePage('coming-soon'); setMobileMenuOpen(false); }}
                  className="btn-primary w-full text-center block !text-sm !py-3"
                >
                  Get started <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </header>

      {/* ──────────────────────────────────────────
          01: HERO SECTION
          ────────────────────────────────────────── */}
      <section id="hero" className="relative overflow-hidden pt-12 pb-24 sm:pt-24 sm:pb-40 bg-[#060B14]">
        <ProximBrandGuideSky />

        <div className="relative z-20 max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">

            {/* Left Column Copy */}
            <motion.div className="lg:col-span-6 space-y-8 text-center lg:text-left" initial="hidden" animate="visible" variants={stagger}>
              
              <motion.div variants={fadeUp} custom={0}>
                <span className="badge-aurora !text-xs !py-2 !px-4">
                  <Smartphone className="w-4 h-4 text-[#35D9D0]" /> Mobile App & Telegram Banking
                </span>
              </motion.div>

              {/* H1 Headline */}
              <motion.h1
                variants={fadeUp} custom={1}
                className="text-4xl sm:text-5xl lg:text-[3.75rem] font-extrabold text-white leading-[1.12] tracking-[-0.03em]"
              >
                Send, hold and spend{' '}
                <span className="relative inline-block">
                  global money
                  <span className="absolute -bottom-2 left-0 w-24 sm:w-32 h-1.5 rounded-full bg-[#35D9D0]" />
                </span>{' '}
                <span className="text-gradient-without-limits">without limits.</span>
              </motion.h1>

              {/* Sub-headline */}
              <motion.p
                variants={fadeUp} custom={2}
                className="text-lg sm:text-xl text-[#F7F8F4]/90 leading-relaxed max-w-lg mx-auto lg:mx-0 font-normal"
              >
                Proxim is a modern financial platform built for your phone and your everyday social chat. Hold multiple currencies, send instant local bank payouts, and invoice clients easily.
              </motion.p>

              {/* Action Buttons */}
              <motion.div
                variants={fadeUp} custom={3}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start max-w-md mx-auto lg:mx-0 pt-2"
              >
                <button onClick={() => setActivePage('coming-soon')} className="btn-primary !text-base !py-3.5 !px-8">
                  Launch Mobile App <ArrowRight className="w-5 h-5" />
                </button>
                <button onClick={() => setActivePage('coming-soon')} className="btn-secondary !text-base !py-3.5 !px-8 flex items-center justify-center gap-2">
                  <TelegramIcon className="w-5 h-5 text-[#35D9D0]" />
                  <span>Use on Telegram</span>
                </button>
              </motion.div>


              {/* Immediate Trust & Value Strip */}
              <motion.div
                variants={fadeUp} custom={4}
                className="pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left max-w-lg mx-auto lg:mx-0"
              >
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-5 h-5 text-[#16C7B7] shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-white/90 leading-tight">Mobile Web App</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <TelegramIcon className="w-5 h-5 text-[#35D9D0] shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-white/90 leading-tight">Telegram Banking</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Zap className="w-5 h-5 text-[#7567F8] shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-white/90 leading-tight">Fast Bank Payouts</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Globe className="w-5 h-5 text-[#FF5DA8] shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-white/90 leading-tight">Multi-Currency</span>
                </div>
              </motion.div>

            </motion.div>

            {/* Right Column: INTERACTIVE 3-TAB SMARTPHONE MOCKUP */}
            <motion.div
              className="lg:col-span-6 relative flex flex-col justify-center items-center phone-3d-wrapper space-y-4"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            >

              {/* Phone Interactive Feature Selector Tabs */}
              <div className="z-30 flex bg-[#0A0E17]/90 p-1.5 rounded-2xl border border-white/15 shadow-xl gap-1">
                {[
                  { id: 'VAULTS', label: '📱 Mobile App', icon: Smartphone },
                  { id: 'TELEGRAM', label: '💬 Telegram Layer', icon: MessageSquare },
                  { id: 'SEND', label: '⚡ Instant Payouts', icon: Send },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setPhoneArtifactTab(id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      phoneArtifactTab === id
                        ? 'bg-[#16C7B7] text-[#060B14] shadow-md'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* iPhone 16 Pro Frame Mockup */}
              <div className="relative w-[320px] sm:w-[360px] h-[640px] sm:h-[700px] rounded-[52px] p-3.5 bg-gradient-to-b from-[#2A344A] via-[#121929] to-[#080D18] border-2 border-white/20 shadow-[0_25px_80px_rgba(0,0,0,0.8),0_0_50px_rgba(53,217,208,0.2)]">
                
                {/* Dynamic Island Pill */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-40 flex items-center justify-between px-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#16C7B7]/80 animate-pulse" />
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500/40" />
                </div>

                {/* Inner Screen Surface */}
                <div className="w-full h-full rounded-[44px] bg-[#060B14] overflow-hidden flex flex-col justify-between p-5 pt-10 text-white relative">
                  
                  {/* TAB 1: VAULTS / BALANCES VIEW */}
                  {phoneArtifactTab === 'VAULTS' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="flex justify-between items-center pt-2">
                        <div>
                          <p className="text-xs text-white/50 font-500">Available Total</p>
                          <h3 className="text-2xl font-extrabold text-white tracking-tight">₦4,250,800.00</h3>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
                          <Bell className="w-4 h-4" />
                        </div>
                      </div>

                      {/* Currency Cards */}
                      <div className="space-y-2.5">
                        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center">
                          <div className="flex items-center gap-2.5">
                            <img src="/flags/ng.png" alt="NGN" className="w-6 h-6 rounded-full" />
                            <div>
                              <p className="text-xs font-bold text-white">Nigerian Naira</p>
                              <p className="text-[0.65rem] text-white/50">Dedicated Providus NUBAN</p>
                            </div>
                          </div>
                          <span className="text-sm font-extrabold text-white">₦3,100,000</span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center">
                          <div className="flex items-center gap-2.5">
                            <img src="/flags/usdc.png" alt="USD" className="w-6 h-6 rounded-full" />
                            <div>
                              <p className="text-xs font-bold text-white">Digital Dollar</p>
                              <p className="text-[0.65rem] text-white/50">USD Global Account</p>
                            </div>
                          </div>
                          <span className="text-sm font-extrabold text-[#35D9D0]">$740.00</span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center">
                          <div className="flex items-center gap-2.5">
                            <img src="/flags/eu.png" alt="EUR" className="w-6 h-6 rounded-full" />
                            <div>
                              <p className="text-xs font-bold text-white">Euro Account</p>
                              <p className="text-[0.65rem] text-white/50">SEPA Instant</p>
                            </div>
                          </div>
                          <span className="text-sm font-extrabold text-white">€320.00</span>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="grid grid-cols-3 gap-2 pt-2">
                        <button className="p-2.5 rounded-xl bg-[#16C7B7]/20 border border-[#16C7B7]/40 text-center">
                          <Send className="w-4 h-4 text-[#16C7B7] mx-auto mb-1" />
                          <span className="text-[0.65rem] font-bold text-white block">Send</span>
                        </button>
                        <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
                          <ArrowDownLeft className="w-4 h-4 text-[#35D9D0] mx-auto mb-1" />
                          <span className="text-[0.65rem] font-bold text-white block">Add Money</span>
                        </button>
                        <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
                          <CreditCard className="w-4 h-4 text-[#FF5DA8] mx-auto mb-1" />
                          <span className="text-[0.65rem] font-bold text-white block">Cards</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: TELEGRAM BOT INTEGRATION VIEW */}
                  {phoneArtifactTab === 'TELEGRAM' && (
                    <div className="space-y-3 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2 pt-1">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#35D9D0]/20 flex items-center justify-center">
                            <TelegramIcon className="w-4 h-4 text-[#35D9D0]" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white leading-none">@proximfibot</p>
                            <p className="text-[0.6rem] text-[#16C7B7]">Verified Bot</p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[0.6rem] bg-white/10 text-white/70">Chat</span>
                      </div>

                      {/* Chat Bubbles */}
                      <div className="space-y-2 text-xs">
                        <div className="p-2.5 rounded-2xl rounded-bl-sm bg-white/10 border border-white/10 text-white/90 max-w-[85%]">
                          <p className="text-[0.7rem]">Send ₦25,000 to Sarah (GTBank 0123456789)</p>
                        </div>
                        <div className="p-2.5 rounded-2xl rounded-br-sm bg-[#16C7B7]/20 border border-[#16C7B7]/40 text-white ml-auto max-w-[88%] space-y-1">
                          <p className="text-[0.7rem] font-bold text-[#35D9D0]">Payment Confirmed</p>
                          <p className="text-[0.65rem] text-white/80">₦25,000 sent to Sarah O. Settled in 12 seconds.</p>
                          <div className="pt-1 text-[0.6rem] font-mono text-[#16C7B7]">Ref: PX-984128</div>
                        </div>
                        <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-[0.68rem] text-white/70 flex items-center justify-between">
                          <span>New NGN Balance:</span>
                          <span className="font-bold text-white">₦3,075,000.00</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: INSTANT PAYOUT PROGRESS VIEW */}
                  {phoneArtifactTab === 'SEND' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="text-center pt-2">
                        <div className="w-12 h-12 rounded-full bg-[#16C7B7]/20 border border-[#16C7B7] flex items-center justify-center mx-auto text-[#16C7B7] mb-2">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <h4 className="text-base font-bold text-white">Money Sent</h4>
                        <p className="text-xs text-white/60">Delivered directly to bank account</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-white/50">Amount Sent</span>
                          <span className="font-extrabold text-white">₦150,000.00</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Recipient</span>
                          <span className="font-bold text-white">David Adeleke</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Bank</span>
                          <span className="text-white">GTBank (0123456789)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Settlement Time</span>
                          <span className="text-[#16C7B7] font-bold">14.2 seconds</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#16C7B7]/10 border border-[#16C7B7]/30 text-center">
                        <span className="text-[0.68rem] font-bold text-[#35D9D0]">Receipt generated and shared</span>
                      </div>
                    </div>
                  )}

                  {/* Bottom Navigation */}
                  <div className="pt-3 border-t border-white/10 grid grid-cols-4 gap-1 text-center">
                    <div className="flex flex-col items-center gap-0.5 text-[#16C7B7]">
                      <Home className="w-3.5 h-3.5" />
                      <span className="text-[0.55rem] font-700">Home</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 text-white/60">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span className="text-[0.55rem] font-600">Cards</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 text-white/60">
                      <Repeat className="w-3.5 h-3.5" />
                      <span className="text-[0.55rem] font-600">Convert</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 text-white/60">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span className="text-[0.55rem] font-600">Profile</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Floating Settlement Pill */}
              <div className="absolute -bottom-6 -right-2 sm:-right-6 z-30 card-glass p-4 rounded-2xl border-[#35D9D0]/40 shadow-2xl flex items-center gap-3 bg-[#0A0E17]/95">
                <div className="w-9 h-9 rounded-full bg-[#16C7B7]/20 border border-[#16C7B7] flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-[#16C7B7]" />
                </div>
                <div>
                  <p className="text-xs font-700 text-white">Payment Settled</p>
                  <p className="text-[0.7rem] text-[#35D9D0]">Instant bank payout</p>
                </div>
              </div>

            </motion.div>

          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          02: THREE CONNECTED AUDIENCES
          ────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 space-y-14">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="badge-aurora !text-xs !py-1.5 !px-4">Your Money, Wherever You Are</span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              One platform. Three connected audiences.
            </h2>
            <p className="text-lg sm:text-xl text-[#F7F8F4]/85 leading-relaxed">
              Whether you are managing personal money, running a growing enterprise, or building financial software, Proxim provides the unified rails you need.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Audience 1: Individuals */}
            <div className="card-glass p-8 rounded-3xl space-y-6 border-white/10 hover:border-[#16C7B7]/40 transition-all bg-[#0A0E17]/85">
              <div className="w-14 h-14 rounded-2xl bg-[#16C7B7]/20 border border-[#16C7B7] flex items-center justify-center text-[#35D9D0]">
                <UserCheck className="w-7 h-7" />
              </div>
              <div className="space-y-2.5">
                <h3 className="text-2xl font-bold text-white">For Individuals</h3>
                <p className="text-base text-[#F7F8F4]/80 leading-relaxed">
                  A simple multi-currency account to hold, convert, and send money to family, friends, or local bank accounts in seconds. Available on your phone and Telegram.
                </p>
              </div>
              <ul className="space-y-2.5 text-sm text-white/85 pt-3 border-t border-white/10">
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#16C7B7]" /> Multi-currency holding & conversion</li>
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#16C7B7]" /> Conversational banking on Telegram</li>
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#16C7B7]" /> Virtual debit cards where supported</li>
              </ul>
            </div>

            {/* Audience 2: Businesses */}
            <div className="card-glass p-8 rounded-3xl space-y-6 border-white/10 hover:border-[#7567F8]/40 transition-all bg-[#0A0E17]/85">
              <div className="w-14 h-14 rounded-2xl bg-[#7567F8]/20 border border-[#7567F8] flex items-center justify-center text-[#7567F8]">
                <Building2 className="w-7 h-7" />
              </div>
              <div className="space-y-2.5">
                <h3 className="text-2xl font-bold text-white">For Businesses</h3>
                <p className="text-base text-[#F7F8F4]/80 leading-relaxed">
                  Everyday financial operations, cross-border supplier settlements, customer invoicing, and batch employee salary payments for local and global companies.
                </p>
              </div>
              <ul className="space-y-2.5 text-sm text-white/85 pt-3 border-t border-white/10">
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#7567F8]" /> Dedicated business accounts & invoicing</li>
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#7567F8]" /> Supplier & vendor settlements</li>
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#7567F8]" /> Automated batch salary & staff payouts</li>
              </ul>
            </div>

            {/* Audience 3: Developers */}
            <div className="card-glass p-8 rounded-3xl space-y-6 border-white/10 hover:border-[#FF5DA8]/40 transition-all bg-[#0A0E17]/85">
              <div className="w-14 h-14 rounded-2xl bg-[#FF5DA8]/20 border border-[#FF5DA8] flex items-center justify-center text-[#FF5DA8]">
                <Code2 className="w-7 h-7" />
              </div>
              <div className="space-y-2.5">
                <h3 className="text-2xl font-bold text-white">For Developers & Fintechs</h3>
                <p className="text-base text-[#F7F8F4]/80 leading-relaxed">
                  Build financial products on Proxim. Integrate REST APIs and webhooks into your applications to automate account issuing, collections, and payouts.
                </p>
              </div>
              <ul className="space-y-2.5 text-sm text-white/85 pt-3 border-t border-white/10">
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#FF5DA8]" /> Direct REST API & webhook events</li>
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#FF5DA8]" /> Multi-currency settlement rails</li>
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#FF5DA8]" /> Sandbox environment & live keys</li>
              </ul>
            </div>
          </div>

          {/* Dual Core Architecture Highlight (Mobile + Telegram Social Layer) */}
          <div className="pt-8 grid md:grid-cols-2 gap-6">
            <div className="card-glass p-8 rounded-3xl space-y-5 border-[#35D9D0]/30 bg-gradient-to-br from-[#10192A] to-[#0A0E17]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#16C7B7]/20 border border-[#16C7B7] flex items-center justify-center text-[#35D9D0]">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#35D9D0] uppercase tracking-wider">Interface 01</span>
                    <h4 className="text-xl font-bold text-white">The Proxim Mobile App</h4>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white">
                  Responsive Web App
                </span>
              </div>
              <p className="text-base text-[#F7F8F4]/85 leading-relaxed">
                Your full financial control center. View real-time multi-currency balances, switch between Personal and Business workspaces, manage virtual cards, and track live payout status.
              </p>
              <div className="pt-2">
                <button onClick={() => setActivePage('coming-soon')} className="btn-primary !text-sm !py-3 !px-6 inline-flex items-center gap-2">
                  Open Mobile App <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="card-glass p-8 rounded-3xl space-y-5 border-[#16C7B7]/30 bg-gradient-to-br from-[#10192A] to-[#0A0E17]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#35D9D0]/20 border border-[#35D9D0] flex items-center justify-center text-[#35D9D0]">
                    <TelegramIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#35D9D0] uppercase tracking-wider">Interface 02</span>
                    <h4 className="text-xl font-bold text-white">The Telegram Social Layer</h4>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#35D9D0]/20 text-[#35D9D0] border border-[#35D9D0]/30">
                  @proximfibot
                </span>
              </div>
              <p className="text-sm text-[#F7F8F4]/80 leading-relaxed">
                Conversational money management where you already spend your time. Send money to contacts, generate PDF/SVG invoices, check rates, and authorize bank transfers—protected by 6-digit PIN security.
              </p>
              <div className="pt-2">
                <button onClick={() => setActivePage('coming-soon')} className="btn-secondary !text-xs !py-2.5 !px-4 inline-flex items-center gap-1.5">
                  <TelegramIcon className="w-3.5 h-3.5 text-[#35D9D0]" />
                  <span>Launch on Telegram</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ──────────────────────────────────────────
          03: MULTI-CURRENCY ACCOUNTS (ANIMATED)
          ────────────────────────────────────────── */}
      <section id="currencies" className="relative overflow-hidden py-24 bg-[#F7F8F4] text-[#0F1414]">
        
        {/* Animated Live Exchange Rate Floating Ticker */}
        <div className="relative overflow-hidden py-3 bg-[#0F1414] text-white border-y border-white/10 mb-12">
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#0F1414] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0F1414] to-transparent z-10 pointer-events-none" />
          
          <motion.div
            className="flex gap-8 items-center w-max text-xs font-mono"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ repeat: Infinity, ease: 'linear', duration: 30 }}
          >
            {[
              { pair: 'USD/NGN', rate: '₦1,550.00', change: '+0.12%', up: true },
              { pair: 'EUR/NGN', rate: '₦1,680.00', change: '+0.08%', up: true },
              { pair: 'GBP/NGN', rate: '₦1,980.00', change: '-0.04%', up: false },
              { pair: 'USDT/NGN', rate: '₦1,555.00', change: '+0.15%', up: true },
              { pair: 'USDC/USD', rate: '$1.0000', change: '0.00%', up: true },
              { pair: 'USD/KES', rate: 'KSh129.50', change: '+0.05%', up: true },
              { pair: 'USD/GHS', rate: 'GH₵15.50', change: '-0.02%', up: false },
              { pair: 'SOL/USD', rate: '$148.20', change: '+2.40%', up: true },
              { pair: 'BTC/USD', rate: '$64,280.00', change: '+1.85%', up: true },
            ].concat([
              { pair: 'USD/NGN', rate: '₦1,550.00', change: '+0.12%', up: true },
              { pair: 'EUR/NGN', rate: '₦1,680.00', change: '+0.08%', up: true },
              { pair: 'GBP/NGN', rate: '₦1,980.00', change: '-0.04%', up: false },
              { pair: 'USDT/NGN', rate: '₦1,555.00', change: '+0.15%', up: true },
              { pair: 'USDC/USD', rate: '$1.0000', change: '0.00%', up: true },
              { pair: 'USD/KES', rate: 'KSh129.50', change: '+0.05%', up: true },
              { pair: 'USD/GHS', rate: 'GH₵15.50', change: '-0.02%', up: false },
              { pair: 'SOL/USD', rate: '$148.20', change: '+2.40%', up: true },
              { pair: 'BTC/USD', rate: '$64,280.00', change: '+1.85%', up: true },
            ]).map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10 shrink-0">
                <span className="font-bold text-[#35D9D0]">{item.pair}</span>
                <span className="font-extrabold text-white">{item.rate}</span>
                <span className={`text-[0.65rem] font-bold ${item.up ? 'text-[#16C7B7]' : 'text-rose-400'}`}>
                  {item.change}
                </span>
              </div>
            ))}
          </motion.div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#0F1414]/10 text-[#0F1414] border border-[#0F1414]/15">
              One account. Multiple currencies.
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-[#0F1414] tracking-tight">
              Hold, send, receive, convert &amp; spend.
            </h2>
            <p className="text-base sm:text-lg text-[#0F1414]/75 leading-relaxed">
              Manage your local and international balances in one unified account with direct settlement into bank accounts across Africa, Europe, the US, and digital reserves.
            </p>
            
            {/* Animated Interactive Lifecycle Flow Strip */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-3 text-xs font-extrabold text-[#0F1414] uppercase tracking-wider">
              {['Hold', 'Send', 'Receive', 'Convert', 'Spend'].map((step, idx) => (
                <div key={step} className="flex items-center gap-2">
                  <motion.span
                    whileHover={{ scale: 1.08, backgroundColor: '#16C7B7', color: '#060B14' }}
                    className="px-3.5 py-1.5 rounded-xl bg-black/5 border border-black/10 shadow-sm cursor-default transition-all"
                  >
                    {step}
                  </motion.span>
                  {idx < 4 && <span className="text-[#16C7B7] font-bold animate-pulse">→</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Animated Interactive Currency Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {currenciesList.map((c, idx) => (
              <motion.div
                key={c.code}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.04 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className="p-5 rounded-2xl bg-white border border-[#0F1414]/10 shadow-md flex items-center justify-between hover:border-[#16C7B7] hover:shadow-xl transition-all group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <img
                      src={c.flag}
                      alt={c.name}
                      className="w-11 h-11 rounded-full object-cover shrink-0 shadow-sm group-hover:scale-110 transition-transform duration-200"
                    />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#16C7B7] absolute -bottom-0.5 -right-0.5 border-2 border-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-extrabold text-[#0F1414] leading-tight group-hover:text-[#16C7B7] transition-colors">{c.code}</p>
                      <span className="text-xs text-[#0F1414]/50 font-mono">({c.symbol})</span>
                    </div>
                    <p className="text-xs text-[#0F1414]/70 font-semibold">{c.name}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-3 py-1 rounded-xl text-xs font-bold bg-[#16C7B7]/15 text-[#0F1414] border border-[#16C7B7]/30 group-hover:bg-[#16C7B7] group-hover:text-[#060B14] transition-all">
                    {c.route}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          02B: INSTANT CRYPTO TO LOCAL CURRENCY CONVERSION
          ────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-36 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 space-y-14">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="badge-aurora !text-xs !py-1.5 !px-4">
              <Zap className="w-4 h-4 text-[#35D9D0]" /> Instant Crypto to Local Bank Cash
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Convert any crypto to local bank currency instantly.
            </h2>
            <p className="text-lg sm:text-xl text-[#F7F8F4]/85 leading-relaxed">
              No peer-to-peer disputes, no searching for network gas tokens, and no bridge delays. Deposit digital assets across 10+ chains and receive instant bank cash in under 30 seconds.
            </p>
          </div>

          {/* Interactive Conversion Architecture Flow Card */}
          <div className="card-glass p-8 sm:p-12 rounded-[40px] border-[#35D9D0]/30 bg-gradient-to-br from-[#10192A] via-[#0A0E17] to-[#060B14] space-y-8 shadow-2xl">
            <div className="grid md:grid-cols-3 gap-6 items-center">
              
              {/* Step 1: Deposit Any Crypto */}
              <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#35D9D0] uppercase tracking-wider">Step 1: Deposit</span>
                  <span className="w-7 h-7 rounded-full bg-white/10 text-white flex items-center justify-center text-xs font-bold">1</span>
                </div>
                <h4 className="text-xl font-bold text-white">Any Token on 10+ Chains</h4>
                <p className="text-sm text-[#F7F8F4]/75 leading-relaxed">
                  Send USDT on TRON, SOL on Solana, BTC on Bitcoin, or tokens on Base, NEAR, Ethereum, Sui, Aptos, Cosmos and XRP.
                </p>
                <div className="flex flex-wrap gap-2 pt-1 text-xs font-mono text-white/90">
                  <span className="px-2.5 py-1 rounded-lg bg-white/10">TRON</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/10">Solana</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/10">Bitcoin</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/10">Base</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/10">NEAR</span>
                </div>
              </div>

              {/* Step 2: Zero-Action Auto-Conversion */}
              <div className="p-6 rounded-3xl bg-[#16C7B7]/10 border border-[#16C7B7]/40 space-y-3.5 relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#16C7B7] uppercase tracking-wider">Step 2: Conversion</span>
                  <span className="w-7 h-7 rounded-full bg-[#16C7B7] text-[#060B14] flex items-center justify-center text-xs font-bold">2</span>
                </div>
                <h4 className="text-xl font-bold text-white">Instant Automatic Conversion</h4>
                <p className="text-sm text-[#F7F8F4]/85 leading-relaxed">
                  Proxim automatically converts your deposit at real-time mid-market rates without any manual trading steps.
                </p>
                <div className="p-3 rounded-2xl bg-[#060B14]/80 border border-[#16C7B7]/30 flex items-center justify-between text-xs sm:text-sm font-semibold">
                  <span className="text-[#35D9D0]">Zero Gas Tokens Required</span>
                  <CheckCircle2 className="w-4 h-4 text-[#16C7B7]" />
                </div>
              </div>

              {/* Step 3: Local Bank Payout */}
              <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#FF5DA8] uppercase tracking-wider">Step 3: Cash Out</span>
                  <span className="w-7 h-7 rounded-full bg-white/10 text-white flex items-center justify-center text-xs font-bold">3</span>
                </div>
                <h4 className="text-xl font-bold text-white">Direct Local Bank Cash</h4>
                <p className="text-sm text-[#F7F8F4]/75 leading-relaxed">
                  Funds land directly in your Nigerian NUBAN bank account (GTBank, Access, Providus, Kuda) or Kenyan M-Pesa in under 30 seconds.
                </p>
                <div className="p-3 rounded-2xl bg-white/10 flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-extrabold text-white">₦ Naira / KES / USD</span>
                  <span className="text-[#16C7B7] font-bold font-mono">&lt; 30s Settled</span>
                </div>
              </div>

            </div>

            <div className="pt-2 text-center">
              <button onClick={() => setActivePage('coming-soon')} className="btn-primary !text-base !py-4 !px-9 inline-flex items-center gap-2">
                Convert Crypto to Cash Now <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          03: MOVE MONEY & LIVE RATE CALCULATOR
          ────────────────────────────────────────── */}
      <section id="how-it-works" className="relative overflow-hidden py-24 sm:py-36 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            <div className="lg:col-span-5 space-y-6">
              <span className="badge-aurora !text-xs !py-1.5 !px-4">01 • Move Money</span>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Move money locally or across borders in seconds.
              </h2>

              <p className="text-lg sm:text-xl text-[#F7F8F4]/85 leading-relaxed">
                Send money directly into local destination bank accounts and mobile wallets. Get transparent mid-market rates, zero hidden conversion markups, and instant delivery.
              </p>
              <div className="space-y-3.5 pt-2">
                <div className="flex items-center gap-3 text-base text-[#F7F8F4]">
                  <CheckCircle2 className="w-5 h-5 text-[#16C7B7] shrink-0" />
                  <span>Settles in under 30 seconds</span>
                </div>
                <div className="flex items-center gap-3 text-base text-[#F7F8F4]">
                  <CheckCircle2 className="w-5 h-5 text-[#16C7B7] shrink-0" />
                  <span>Live mid-market conversion rates</span>
                </div>
                <div className="flex items-center gap-3 text-base text-[#F7F8F4]">
                  <CheckCircle2 className="w-5 h-5 text-[#16C7B7] shrink-0" />
                  <span>Direct delivery to banks and mobile wallets</span>
                </div>
              </div>
            </div>

            {/* Transparent Rate & Fee Simulator */}
            <div className="lg:col-span-7 card-glass p-6 sm:p-10 rounded-[40px] border-[#16C7B7]/30 space-y-6 bg-[#0F1524]/90 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-sm font-bold text-white uppercase tracking-wider">Live Market Rate Calculator</span>
                  <p className="text-xs text-[#35D9D0]">Real-Time Market Rate Feed</p>
                </div>
                <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#16C7B7]/20 text-[#16C7B7] border border-[#16C7B7]/40 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 animate-pulse" /> Live Market Feed
                </span>
              </div>

              <div className="space-y-4">
                <div className="p-5 rounded-3xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs text-[#F7F8F4]/70 font-semibold">
                    <span>You Send</span>
                    <span>Source Balance</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <input
                      type="number"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="w-full bg-transparent text-3xl font-extrabold text-white outline-none"
                    />
                    <select
                      value={sourceCurrency}
                      onChange={(e: any) => setSourceCurrency(e.target.value)}
                      className="bg-[#060B14] text-white text-base font-bold px-4 py-2.5 rounded-2xl border border-white/15 outline-none cursor-pointer"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-[#16C7B7]/20 border border-[#16C7B7] flex items-center justify-center">
                    <Repeat className="w-5 h-5 text-[#16C7B7]" />
                  </div>
                </div>

                <div className="p-5 rounded-3xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs text-[#F7F8F4]/70 font-semibold">
                    <span>Recipient Receives (Direct Bank)</span>
                    <span>Guaranteed Rate</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-3xl font-extrabold text-[#35D9D0]">
                      {calculatedOutput}
                    </span>
                    <select
                      value={targetCurrency}
                      onChange={(e: any) => setTargetCurrency(e.target.value)}
                      className="bg-[#060B14] text-white text-base font-bold px-4 py-2.5 rounded-2xl border border-white/15 outline-none cursor-pointer"
                    >
                      <option value="NGN">NGN (₦)</option>
                      <option value="KES">KES (KSh)</option>
                      <option value="GHS">GHS (GH₵)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Transparent Fee & Delivery Guarantee Banner */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-center text-xs sm:text-sm">
                <div>
                  <p className="text-[0.68rem] text-white/50 uppercase font-semibold">Proxim Fee</p>
                  <p className="font-extrabold text-[#16C7B7] text-base mt-0.5">₦0.00</p>
                </div>
                <div>
                  <p className="text-[0.68rem] text-white/50 uppercase font-semibold">Delivery Time</p>
                  <p className="font-extrabold text-[#35D9D0] text-base mt-0.5">&lt; 30 Seconds</p>
                </div>
                <div>
                  <p className="text-[0.68rem] text-white/50 uppercase font-semibold">Rate Guarantee</p>
                  <p className="font-extrabold text-white text-base mt-0.5">Locked 15 Mins</p>
                </div>
              </div>

              <div className="pt-2">
                <button onClick={() => setActivePage('coming-soon')} className="btn-primary w-full text-center block !py-3.5 !text-base">
                  Send Money Now
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          04: SPEND GLOBALLY (VIRTUAL DEBIT CARDS)
          ────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-36 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Debit Card Artifact */}
            <div className="lg:col-span-6 relative flex justify-center items-center min-h-[340px]">
              <div className="w-[320px] sm:w-[380px] h-[200px] sm:h-[235px] rounded-3xl p-7 card-glass bg-gradient-to-br from-[#1A2333] via-[#060B14] to-[#0A0E17] border-[#16C7B7]/30 shadow-2xl relative z-10 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <img src="/proxim-icon.png" alt="Proxim" className="w-8 h-8 rounded-lg object-cover" />
                    <p className="text-xs font-bold text-white tracking-wider uppercase mt-1.5">Proxim</p>
                  </div>
                  <Wifi className="w-6 h-6 text-[#35D9D0]" />
                </div>
                <div>
                  <p className="text-sm font-mono text-white/80 tracking-widest mb-1.5">4892 •••• •••• 9102</p>
                  <div className="flex justify-between items-end text-xs sm:text-sm text-white">
                    <div>
                      <p className="text-[0.65rem] text-white/50 uppercase">Cardholder</p>
                      <p className="font-bold">PRIMARY ACCOUNT</p>
                    </div>
                    <span className="font-extrabold text-base text-[#16C7B7]">VISA</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-6">
              <span className="badge-aurora !text-xs !py-1.5 !px-4">02 • Spend Where Supported</span>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Spend globally with virtual cards.
              </h2>
              <p className="text-lg sm:text-xl text-[#F7F8F4]/85 leading-relaxed">
                Generate virtual debit cards instantly. Pay for international subscriptions, software tools, and online merchants directly from your multi-currency balances with automatic conversion at checkout.
              </p>
              <div className="space-y-3.5 pt-2">
                <div className="flex items-center gap-3 text-base text-[#F7F8F4]">
                  <CheckCircle2 className="w-5 h-5 text-[#16C7B7] shrink-0" />
                  <span>Instant card generation linked to your balance</span>
                </div>
                <div className="flex items-center gap-3 text-base text-[#F7F8F4]">
                  <CheckCircle2 className="w-5 h-5 text-[#16C7B7] shrink-0" />
                  <span>Granular spend limits and instant freeze controls</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          05: PROXIM FOR BUSINESS & PAYROLL
          ────────────────────────────────────────── */}
      <section id="business" className="relative overflow-hidden py-24 sm:py-36 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">

            <div className="lg:col-span-6 space-y-6">
              <span className="badge-aurora !text-xs !py-1.5 !px-4">03 • Business Operations</span>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Everyday operations, commerce, and staff payouts.
              </h2>
              <p className="text-lg sm:text-xl text-[#F7F8F4]/85 leading-relaxed">
                A business does not have to operate internationally to benefit from Proxim. Built for Nigerian businesses, importers, exporters, online vendors, freelancers, and growing companies managing multiple currencies and staff payroll.
              </p>

              {/* Target Customer Persona Badges */}
              <div className="flex flex-wrap gap-2.5 pt-1">
                <span className="px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-white/5 border border-white/10 text-white/90 flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-[#16C7B7]" /> Local Nigerian Businesses
                </span>
                <span className="px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-white/5 border border-white/10 text-white/90 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-[#35D9D0]" /> Importers &amp; Exporters
                </span>
                <span className="px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-white/5 border border-white/10 text-white/90 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-[#7567F8]" /> Freelancers &amp; Agencies
                </span>
                <span className="px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-white/5 border border-white/10 text-white/90 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#FF5DA8]" /> Growing Companies
                </span>
              </div>
              
              <div className="space-y-3.5 pt-2 text-base text-[#F7F8F4]">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#16C7B7] shrink-0 mt-0.5" />
                  <span><strong>Receive &amp; Invoice:</strong> Collect payments locally and internationally with instant settlement.</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#16C7B7] shrink-0 mt-0.5" />
                  <span><strong>Pay Suppliers &amp; Vendors:</strong> Settle invoices on time locally and across borders with locked rates.</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#16C7B7] shrink-0 mt-0.5" />
                  <span><strong>Staff &amp; Salary Payments:</strong> Run automated bulk employee payroll and recurring contractor payouts.</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#16C7B7] shrink-0 mt-0.5" />
                  <span><strong>Segregated Business Balances:</strong> Keep operational cash flow strictly separate from personal savings.</span>
                </div>
              </div>

              <div className="pt-2">
                <button onClick={() => setActivePage('coming-soon')} className="btn-primary !text-base !py-3.5 !px-8">
                  Explore Proxim for Business <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>


            {/* Rich Interactive Business & Payroll Operations Terminal */}
            <div className="lg:col-span-6 card-glass p-6 sm:p-8 rounded-[36px] space-y-5 border-[#16C7B7]/35 bg-[#0F1524]/95 shadow-2xl">
              
              {/* Terminal Header & Mode Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#35D9D0]" /> Proxim Business Operations
                  </h4>
                  <p className="text-xs text-white/50">Segregated Enterprise Treasury &amp; Payroll</p>
                </div>
                <div className="flex bg-[#060B14] p-1 rounded-xl border border-white/10 gap-1 self-start sm:self-auto">
                  {[
                    { id: 'PAYROLL', label: 'Payroll Run' },
                    { id: 'INVOICING', label: 'Invoices' },
                    { id: 'TREASURY', label: 'Treasury' },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => setBusinessArtifactTab(id as any)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        businessArtifactTab === id
                          ? 'bg-[#16C7B7] text-[#060B14] shadow'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* TAB 1: BATCH STAFF PAYROLL EXECUTION */}
              {businessArtifactTab === 'PAYROLL' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                      <p className="text-[0.65rem] text-white/60 font-600 uppercase">Monthly Payroll Disbursed</p>
                      <p className="text-xl font-extrabold text-white mt-0.5">₦14,850,000</p>
                      <p className="text-[0.65rem] text-[#16C7B7] mt-0.5 flex items-center gap-1">
                        <CheckCheck className="w-3 h-3" /> 24 Staff &amp; Contractors
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                      <p className="text-[0.65rem] text-white/60 font-600 uppercase">Batch Settlement Speed</p>
                      <p className="text-xl font-extrabold text-[#35D9D0] mt-0.5">14.8s</p>
                      <p className="text-[0.65rem] text-white/50 mt-0.5">Direct NUBAN Clearing</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <p className="font-700 text-white/60 uppercase tracking-wider text-[0.65rem]">
                      Live Batch Payout Registry (Batch #084)
                    </p>

                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#16C7B7]/20 border border-[#16C7B7] flex items-center justify-center font-bold text-[#35D9D0] text-[0.65rem]">
                          AO
                        </div>
                        <div>
                          <span className="font-700 text-white block">Adebayo O. — Lead Engineer</span>
                          <span className="text-[0.65rem] text-white/50">Providus Bank • ₦850,000</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[0.62rem] font-bold bg-[#16C7B7]/20 text-[#16C7B7]">
                        Settled (12s)
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#7567F8]/20 border border-[#7567F8] flex items-center justify-center font-bold text-[#7567F8] text-[0.65rem]">
                          CN
                        </div>
                        <div>
                          <span className="font-700 text-white block">Chioma N. — Product Design</span>
                          <span className="text-[0.65rem] text-white/50">GTBank • ₦650,000</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[0.62rem] font-bold bg-[#16C7B7]/20 text-[#16C7B7]">
                        Settled (14s)
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#FF5DA8]/20 border border-[#FF5DA8] flex items-center justify-center font-bold text-[#FF5DA8] text-[0.65rem]">
                          DK
                        </div>
                        <div>
                          <span className="font-700 text-white block">David K. — Remote DevOps</span>
                          <span className="text-[0.65rem] text-white/50">USD ACH Wire • $1,200.00</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[0.62rem] font-bold bg-[#35D9D0]/20 text-[#35D9D0]">
                        Delivered
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ITEMIZED BUSINESS INVOICING */}
              {businessArtifactTab === 'INVOICING' && (
                <div className="space-y-3 text-xs">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div className="flex justify-between items-start border-b border-white/10 pb-2.5">
                      <div>
                        <span className="text-[0.65rem] text-[#35D9D0] font-mono">#INV-2026-084</span>
                        <p className="font-bold text-white text-sm">Acme Global Technologies Inc.</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[0.65rem] font-bold bg-[#16C7B7]/20 text-[#16C7B7] border border-[#16C7B7]/30">
                        Paid &amp; Settled
                      </span>
                    </div>

                    <div className="space-y-1 text-white/80">
                      <div className="flex justify-between">
                        <span>Software Architecture &amp; Delivery</span>
                        <span className="font-bold text-white">$2,500.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Monthly Cloud Infrastructure Retainer</span>
                        <span className="font-bold text-white">$1,000.00</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                      <div>
                        <span className="text-[0.6rem] text-white/50 block">Total Settled</span>
                        <span className="text-base font-extrabold text-[#35D9D0]">$3,500.00 USD</span>
                      </div>
                      <span className="text-[0.65rem] text-white/60 font-mono">
                        ≈ ₦5,425,000.00 NGN
                      </span>
                    </div>
                  </div>
                  <p className="text-[0.65rem] text-white/60 text-center">
                    Payment settled instantly via customer's preferred bank transfer or digital rails.
                  </p>
                </div>
              )}

              {/* TAB 3: MULTI-CURRENCY TREASURY */}
              {businessArtifactTab === 'TREASURY' && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <img src="/flags/ng.png" alt="NGN" className="w-4 h-4 rounded-full" />
                        <span className="text-[0.65rem] text-white/60 font-700">NGN Corporate NUBAN</span>
                      </div>
                      <p className="text-lg font-extrabold text-white">₦32,450,000.00</p>
                      <p className="text-[0.62rem] text-white/50">Providus Bank Dedicated</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#16C7B7]/10 border border-[#16C7B7]/30 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <img src="/flags/usdc.png" alt="USD" className="w-4 h-4 rounded-full" />
                        <span className="text-[0.65rem] text-[#35D9D0] font-700">USD Trade Reserve</span>
                      </div>
                      <p className="text-lg font-extrabold text-[#35D9D0]">$45,800.00</p>
                      <p className="text-[0.62rem] text-[#16C7B7]">ACH / Wire Settled</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-[#16C7B7] shrink-0" />
                    <div>
                      <span className="font-bold text-white block">Strict Double-Entry Segregation</span>
                      <span className="text-[0.65rem] text-white/60">Personal savings and business revenues remain completely separated with automated reconciliation audits.</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* Real Nigerian Business Stories & Use Case Showcase */}
          <div className="pt-16 space-y-8 border-t border-white/10">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <span className="badge-aurora">
                <Store className="w-3.5 h-3.5 text-[#16C7B7]" /> Real Businesses. Real Money Movement.
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                How Nigerian businesses move money every day with Proxim.
              </h3>
              <p className="text-sm text-[#F7F8F4]/70">
                From Alaba electronics importers and remote tech agencies to fashion brands and auto parts distributors.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Business 1 */}
              <div className="card-glass p-6 rounded-3xl border-white/10 hover:border-[#16C7B7]/40 transition-all bg-[#0A0E17]/90 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#16C7B7]/20 border border-[#16C7B7] flex items-center justify-center text-[#35D9D0]">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[0.65rem] font-bold text-[#16C7B7] uppercase tracking-wider">Electronics Importers</span>
                    <h4 className="text-base font-bold text-white leading-tight mt-0.5">Alaba &amp; Computer Village Traders</h4>
                  </div>
                  <p className="text-xs text-[#F7F8F4]/75 leading-relaxed">
                    Collect Naira from local wholesale dealers via dedicated NUBAN accounts and pay Asian electronics suppliers in USD/USDT on the same day.
                  </p>
                </div>
                <div className="pt-3 border-t border-white/10 text-[0.68rem] text-[#35D9D0] font-mono font-bold flex items-center gap-1.5">
                  <CheckCheck className="w-3.5 h-3.5" /> ₦48M+ Monthly Supplier Trade
                </div>
              </div>

              {/* Business 2 */}
              <div className="card-glass p-6 rounded-3xl border-white/10 hover:border-[#7567F8]/40 transition-all bg-[#0A0E17]/90 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#7567F8]/20 border border-[#7567F8] flex items-center justify-center text-[#7567F8]">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[0.65rem] font-bold text-[#7567F8] uppercase tracking-wider">E-Commerce &amp; Fashion</span>
                    <h4 className="text-base font-bold text-white leading-tight mt-0.5">Online Boutiques &amp; Brands</h4>
                  </div>
                  <p className="text-xs text-[#F7F8F4]/75 leading-relaxed">
                    Send itemized invoice payment links on Instagram &amp; WhatsApp, collect customer funds, and pay overseas fabric mills using virtual USD cards.
                  </p>
                </div>
                <div className="pt-3 border-t border-white/10 text-[0.68rem] text-[#7567F8] font-mono font-bold flex items-center gap-1.5">
                  <CheckCheck className="w-3.5 h-3.5" /> Instant NUBAN Reconciliation
                </div>
              </div>

              {/* Business 3 */}
              <div className="card-glass p-6 rounded-3xl border-white/10 hover:border-[#FF5DA8]/40 transition-all bg-[#0A0E17]/90 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#FF5DA8]/20 border border-[#FF5DA8] flex items-center justify-center text-[#FF5DA8]">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[0.65rem] font-bold text-[#FF5DA8] uppercase tracking-wider">Tech &amp; Creative Agencies</span>
                    <h4 className="text-base font-bold text-white leading-tight mt-0.5">Remote Software &amp; Design Teams</h4>
                  </div>
                  <p className="text-xs text-[#F7F8F4]/75 leading-relaxed">
                    Invoice US &amp; UK clients in USD/EUR, hold Digital Dollars, and execute 1-click batch payroll runs to 20+ Nigerian staff accounts in under 30s.
                  </p>
                </div>
                <div className="pt-3 border-t border-white/10 text-[0.68rem] text-[#FF5DA8] font-mono font-bold flex items-center gap-1.5">
                  <CheckCheck className="w-3.5 h-3.5" /> 24 Staff Paid in 14.8s
                </div>
              </div>

              {/* Business 4 */}
              <div className="card-glass p-6 rounded-3xl border-white/10 hover:border-[#35D9D0]/40 transition-all bg-[#0A0E17]/90 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#35D9D0]/20 border border-[#35D9D0] flex items-center justify-center text-[#35D9D0]">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[0.65rem] font-bold text-[#35D9D0] uppercase tracking-wider">Auto Parts &amp; Logistics</span>
                    <h4 className="text-base font-bold text-white leading-tight mt-0.5">Automotive Spare Parts Importers</h4>
                  </div>
                  <p className="text-xs text-[#F7F8F4]/75 leading-relaxed">
                    Settle international supplier orders in Dubai, Japan, and the US instantly without waiting 3-5 days for bank Form M wires or currency spread losses.
                  </p>
                </div>
                <div className="pt-3 border-t border-white/10 text-[0.68rem] text-[#16C7B7] font-mono font-bold flex items-center gap-1.5">
                  <CheckCheck className="w-3.5 h-3.5" /> Zero Form M Delays
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>



      {/* ──────────────────────────────────────────
          06: DEVELOPER & API PRODUCT
          ────────────────────────────────────────── */}
      <section id="developers-section" className="relative overflow-hidden py-24 sm:py-36 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 space-y-14">
          
          <div className="max-w-3xl space-y-4">
            <span className="badge-aurora !text-xs !py-1.5 !px-4">04 • Developer Platform</span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Build financial products on Proxim.
            </h2>
            <p className="text-lg sm:text-xl text-[#F7F8F4]/85 leading-relaxed">
              Proxim provides modern APIs and financial infrastructure that developers, fintech companies, and neobanks can integrate to build seamless money movement into their own applications.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-center">
            
            {/* Developer Benefits Cards */}
            <div className="lg:col-span-6 space-y-4">
              <div className="card-glass p-7 rounded-3xl border-white/10 space-y-2 bg-[#0A0E17]/85">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#16C7B7]/20 border border-[#16C7B7] flex items-center justify-center text-[#35D9D0]">
                    <Code2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-xl font-bold text-white">Multi-Currency REST API</h4>
                </div>
                <p className="text-base text-[#F7F8F4]/80 leading-relaxed pt-1">
                  Issue accounts, generate payment links, and execute programmatic bank payouts across Africa, Europe, and the US with a single integration.
                </p>
              </div>

              <div className="card-glass p-7 rounded-3xl border-white/10 space-y-2 bg-[#0A0E17]/85">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#7567F8]/20 border border-[#7567F8] flex items-center justify-center text-[#7567F8]">
                    <Zap className="w-6 h-6" />
                  </div>
                  <h4 className="text-xl font-bold text-white">Real-Time Webhooks</h4>
                </div>
                <p className="text-base text-[#F7F8F4]/80 leading-relaxed pt-1">
                  Receive instant webhooks for incoming bank transfers, status transitions, and reconciliation events to keep your ledger synchronized.
                </p>
              </div>

              <div className="card-glass p-7 rounded-3xl border-white/10 space-y-2 bg-[#0A0E17]/85">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#FF5DA8]/20 border border-[#FF5DA8] flex items-center justify-center text-[#FF5DA8]">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h4 className="text-xl font-bold text-white">Sandbox &amp; Production Keys</h4>
                </div>
                <p className="text-base text-[#F7F8F4]/80 leading-relaxed pt-1">
                  Test every flow using comprehensive mock data and simulation tools in sandbox mode before moving to live production keys.
                </p>
              </div>

              <div className="flex flex-wrap gap-4 pt-3">
                <button
                  onClick={() => setActivePage('coming-soon')}
                  className="btn-primary !text-base !py-3.5 !px-8 flex items-center gap-2"
                >
                  <Code2 className="w-5 h-5" /> Explore the API
                </button>
                <button
                  onClick={() => setActivePage('coming-soon')}
                  className="btn-secondary !text-base !py-3.5 !px-8 flex items-center gap-2"
                >
                  <Zap className="w-5 h-5 text-[#35D9D0]" /> Read Documentation
                </button>
              </div>
            </div>

            {/* Code Snippet Artifact */}
            <div className="lg:col-span-6 card-glass p-7 rounded-[32px] border-[#35D9D0]/30 bg-[#0A0E17] font-mono text-xs sm:text-sm text-white/90 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3.5 mb-4 text-white/50 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="ml-2 text-white/80 font-bold">POST /api/v1/transfers</span>
                </div>
                <span>JSON</span>
              </div>
              <pre className="overflow-x-auto text-xs sm:text-sm leading-relaxed text-[#F7F8F4]">
{`// Initialize instant multi-currency transfer
const response = await fetch("https://api.proximfi.xyz/v1/transfers", {
  method: "POST",
  headers: {
    "Authorization": "Bearer px_live_9a8f27b...",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    sourceCurrency: "USD",
    targetCurrency: "NGN",
    amount: 1000.00,
    recipient: {
      accountNumber: "0123456789",
      bankCode: "058", // GTBank
      name: "David Adeleke"
    },
    reference: "inv_march_payroll_01"
  })
});

// Settlement confirmed in < 30 seconds
const { transferId, status, rate } = await response.json();
console.log(status); // "SETTLED"`}
              </pre>
            </div>

          </div>

        </div>
      </section>

      {/* ──────────────────────────────────────────
          07: SECURITY & VERIFIED ARCHITECTURE
          ────────────────────────────────────────── */}
      <section id="security" className="relative overflow-hidden py-24 sm:py-36 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 space-y-16">
          <div className="max-w-3xl space-y-4">
            <span className="badge-aurora !text-xs !py-1.5 !px-4">Security Architecture</span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Enterprise security. Zero compromise.
            </h2>
            <p className="text-lg sm:text-xl text-[#F7F8F4]/85 leading-relaxed">
              Built from the ground up to protect your balances, privacy, and transactional integrity.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card-glass p-8 rounded-3xl space-y-4 border-white/12 bg-[#0A0E17]/85">
              <div className="w-14 h-14 rounded-2xl bg-[#16C7B7]/20 border border-[#16C7B7] flex items-center justify-center text-[#35D9D0]">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-white">Privy Account Security</h3>
              <p className="text-base text-[#F7F8F4]/80 leading-relaxed">
                Sign in securely with Google, Apple, or email through Privy with non-custodial root protection and zero seed phrase complexity.
              </p>
            </div>

            <div className="card-glass p-8 rounded-3xl space-y-4 border-white/12 bg-[#0A0E17]/85">
              <div className="w-14 h-14 rounded-2xl bg-[#7567F8]/20 border border-[#7567F8] flex items-center justify-center text-[#7567F8]">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-white">Cryptographic Isolation</h3>
              <p className="text-base text-[#F7F8F4]/80 leading-relaxed">
                Deterministic multi-party key infrastructure and hardware security modules safeguard multi-currency reserves.
              </p>
            </div>

            <div className="card-glass p-8 rounded-3xl space-y-4 border-white/12 bg-[#0A0E17]/85">
              <div className="w-14 h-14 rounded-2xl bg-[#FF5DA8]/20 border border-[#FF5DA8] flex items-center justify-center text-[#FF5DA8]">
                <Server className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-white">24/7 Monitored Settlement</h3>
              <p className="text-base text-[#F7F8F4]/80 leading-relaxed">
                Immutable double-entry accounting ledger with automated reconciliation audits and monitored bank settlement rails.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          08: INFRASTRUCTURE & TECHNOLOGY PARTNERS (SLIDING MARQUEE)
          ────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-36 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 space-y-12 text-center">
          <div className="space-y-4 max-w-2xl mx-auto">
            <span className="badge-aurora !text-xs !py-1.5 !px-4">Infrastructure &amp; Partners</span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Engineered with trusted technology and infrastructure partners.
            </h2>
            <p className="text-lg text-white/80 leading-relaxed">
              Proxim integrates with leading security, liquidity, and blockchain infrastructure providers to power global money movement.
            </p>
          </div>
        </div>

        {/* Seamless Infinite Sliding Marquee (Right to Left) */}
        <div className="relative overflow-hidden py-8 mt-6">
          {/* Left & Right Gradient Fog Masks */}
          <div className="absolute left-0 top-0 bottom-0 w-24 sm:w-40 bg-gradient-to-r from-[#060B14] via-[#060B14]/80 to-transparent z-20 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 sm:w-40 bg-gradient-to-l from-[#060B14] via-[#060B14]/80 to-transparent z-20 pointer-events-none" />

          <motion.div
            className="flex gap-6 items-center w-max"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ repeat: Infinity, ease: 'linear', duration: 22 }}
          >
            {[
              { name: 'Arc', src: '/partners/arc.png', bg: 'bg-[#041126]', border: 'border-white/20', imgClass: 'h-10 sm:h-12' },
              { name: 'Brails', src: '/partners/brails.png', bg: 'bg-white', border: 'border-white/10', imgClass: 'h-7 sm:h-9' },
              { name: 'Nuvion', src: '/partners/nuvion.png', bg: 'bg-[#FDF0EE]', border: 'border-white/10', imgClass: 'h-7 sm:h-9' },
              { name: 'NEAR', src: '/partners/near.png', bg: 'bg-white', border: 'border-white/10', imgClass: 'h-7 sm:h-9' },
              { name: 'Privy', src: '/partners/privy.png', bg: 'bg-white', border: 'border-white/10', imgClass: 'h-8 sm:h-10' },
              { name: 'Senviok', src: '/partners/senviok.png', bg: 'bg-[#0F1524]', border: 'border-white/20', imgClass: 'h-8 sm:h-10' },
            ].concat([
              { name: 'Arc', src: '/partners/arc.png', bg: 'bg-[#041126]', border: 'border-white/20', imgClass: 'h-10 sm:h-12' },
              { name: 'Brails', src: '/partners/brails.png', bg: 'bg-white', border: 'border-white/10', imgClass: 'h-7 sm:h-9' },
              { name: 'Nuvion', src: '/partners/nuvion.png', bg: 'bg-[#FDF0EE]', border: 'border-white/10', imgClass: 'h-7 sm:h-9' },
              { name: 'NEAR', src: '/partners/near.png', bg: 'bg-white', border: 'border-white/10', imgClass: 'h-7 sm:h-9' },
              { name: 'Privy', src: '/partners/privy.png', bg: 'bg-white', border: 'border-white/10', imgClass: 'h-8 sm:h-10' },
              { name: 'Senviok', src: '/partners/senviok.png', bg: 'bg-[#0F1524]', border: 'border-white/20', imgClass: 'h-8 sm:h-10' },
            ]).concat([
              { name: 'Arc', src: '/partners/arc.png', bg: 'bg-[#041126]', border: 'border-white/20', imgClass: 'h-10 sm:h-12' },
              { name: 'Brails', src: '/partners/brails.png', bg: 'bg-white', border: 'border-white/10', imgClass: 'h-7 sm:h-9' },
              { name: 'Nuvion', src: '/partners/nuvion.png', bg: 'bg-[#FDF0EE]', border: 'border-white/10', imgClass: 'h-7 sm:h-9' },
              { name: 'NEAR', src: '/partners/near.png', bg: 'bg-white', border: 'border-white/10', imgClass: 'h-7 sm:h-9' },
              { name: 'Privy', src: '/partners/privy.png', bg: 'bg-white', border: 'border-white/10', imgClass: 'h-8 sm:h-10' },
              { name: 'Senviok', src: '/partners/senviok.png', bg: 'bg-[#0F1524]', border: 'border-white/20', imgClass: 'h-8 sm:h-10' },
            ]).map((partner, idx) => (
              <div
                key={idx}
                className={`p-6 rounded-3xl ${partner.bg} border ${partner.border} flex items-center justify-center h-28 w-52 sm:w-60 shrink-0 shadow-2xl transition-transform hover:scale-105`}
              >
                <img
                  src={partner.src}
                  alt={partner.name}
                  className={`${partner.imgClass} w-auto object-contain rounded-lg`}
                />
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          09: FAQ SECTION
          ────────────────────────────────────────── */}
      <section id="faq" className="relative overflow-hidden py-24 sm:py-36 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-4xl mx-auto px-6 sm:px-8 space-y-14">
          <div className="space-y-4 text-center max-w-2xl mx-auto">
            <span className="badge-aurora !text-xs !py-1.5 !px-4">FAQ</span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Frequently asked questions.
            </h2>
            <p className="text-lg text-white/80 leading-relaxed">
              Everything you need to know about using Proxim for personal finances, business operations, staff payroll, and developer integrations.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const open = activeFaq === idx;
              return (
                <div key={idx} className="card-glass rounded-3xl border-white/10 overflow-hidden">
                  <button
                    onClick={() => setActiveFaq(open ? null : idx)}
                    className="w-full px-7 py-6 flex items-center justify-between text-left gap-4 hover:bg-white/5 transition-colors"
                  >
                    <span className="text-lg sm:text-xl font-bold text-white">{faq.q}</span>
                    <ChevronDown className={`w-5 h-5 text-[#35D9D0] transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {open && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-7 pb-6 text-base sm:text-lg text-[#F7F8F4]/85 leading-relaxed border-t border-white/10 pt-5"
                      >
                        {faq.a}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          10: FINAL CTA & FOOTER
          ────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-40 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
          <span className="badge-aurora !text-xs !py-1.5 !px-4">Get Started</span>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight">
            Your money should work around you.
          </h2>
          <p className="text-lg sm:text-xl text-[#F7F8F4]/85 max-w-xl mx-auto leading-relaxed">
            Open your Proxim account in minutes on your phone or start managing your money conversationally in Telegram.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <button onClick={() => setActivePage('coming-soon')} className="btn-primary !text-lg !py-4 !px-10">
              Open Account Free <ArrowRight className="w-5 h-5" />
            </button>
            <button onClick={() => setActivePage('coming-soon')} className="btn-secondary !text-lg !py-4 !px-10 flex items-center justify-center gap-2.5">
              <TelegramIcon className="w-5 h-5 text-[#35D9D0]" />
              <span>Launch Telegram Bot</span>
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-16 bg-[#060B14] border-t border-white/10 text-sm text-[#F7F8F4]/70">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 space-y-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <a href="#" className="flex items-center gap-3">
              <img src="/proxim-icon.png" alt="Proxim" className="w-8 h-8 rounded-xl object-cover" />
              <span className="text-xl font-extrabold text-white tracking-tight">Proxim</span>
            </a>

            <nav className="flex flex-wrap gap-7 text-sm font-semibold">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#currencies" className="hover:text-white transition-colors">Currencies</a>
              <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
              <a href="#business" className="hover:text-white transition-colors">Business &amp; Payroll</a>
              <a href="#developers-section" className="hover:text-white transition-colors">Developers</a>
              <a href="#security" className="hover:text-white transition-colors">Security</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
              <button
                onClick={() => setActivePage('coming-soon')}
                className="text-[#35D9D0] hover:text-white transition-colors font-semibold flex items-center gap-1.5"
              >
                <TelegramIcon className="w-4 h-4" /> Telegram Bot
              </button>
            </nav>

            <a
              href="https://x.com/proximfi" target="_blank" rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors"
              title="@proximfi on X"
            >
              <XIcon className="w-4 h-4" />
            </a>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[#F7F8F4]/50 text-xs sm:text-sm">
            <p>© 2026 Proxim Inc. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <span className="font-bold text-[#16C7B7]">proximfi.xyz</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

