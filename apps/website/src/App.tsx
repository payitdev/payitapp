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
  Users, PiggyBank, LineChart, Award, CheckCircle, Clock
} from 'lucide-react';

const APP_URL = 'https://app.proximfi.xyz/';

const XIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
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
        background: 'linear-gradient(175deg, rgba(53, 217, 208, 0.75) 0%, rgba(22, 199, 183, 0.60) 40%, rgba(74, 140, 255, 0.35) 75%, transparent 100%)',
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
    <div
      className="absolute inset-0"
      style={{
        background: 'radial-gradient(ellipse at 30% 30%, transparent 20%, rgba(6, 11, 20, 0.70) 80%, #060B14 100%)',
      }}
    />
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
   MAIN APPLICATION
   ══════════════════════════════════════════════════════ */
export default function App() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [activeEntityTab, setActiveEntityTab] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL');
  const [phoneArtifactTab, setPhoneArtifactTab] = useState<'VAULTS' | 'SEND' | 'YIELD'>('VAULTS');

  // FX Demo Transfer State
  const [sendAmount, setSendAmount] = useState('1000');
  const [sourceCurrency, setSourceCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  const [targetCurrency, setTargetCurrency] = useState<'NGN' | 'KES' | 'GHS'>('NGN');

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
    { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', flag: '/flags/ng.png', route: 'Instant Direct Bank Payout' },
    { code: 'USD', name: 'US Dollar', symbol: '$', flag: '/flags/us.png', route: 'ACH & FedWire Rails' },
    { code: 'EUR', name: 'Euro', symbol: '€', flag: '/flags/eu.png', route: 'SEPA Instant Transfer' },
    { code: 'GBP', name: 'British Pound', symbol: '£', flag: '/flags/gb.png', route: 'Faster Payments Network' },
    { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', flag: '/flags/ke.png', route: 'M-Pesa & Bank Deposit' },
    { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', flag: '/flags/gh.png', route: 'Mobile Money & GCB Bank' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '/flags/za.png', route: 'EFT Instant Settlement' },
    { code: 'USDC', name: 'USD Coin', symbol: '$', flag: '/flags/usdc.png', route: 'Digital Dollar Reserve' },
    { code: 'USDT', name: 'Tether USD', symbol: '$', flag: '/flags/usdt.png', route: 'Global Liquidity Rail' },
    { code: 'BTC', name: 'Bitcoin', symbol: '₿', flag: '/flags/btc.png', route: 'Digital Asset Settlement' },
    { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', flag: '/flags/eth.png', route: 'Smart Contract Rail' },
    { code: 'SOL', name: 'Solana', symbol: 'SOL', flag: '/flags/sol.png', route: 'High-Speed Settlement' },
  ];

  const faqs = [
    {
      q: 'What is Proxim?',
      a: 'Proxim is a modern borderless financial platform that enables individuals and businesses to send, receive, hold, convert, and manage money across 18+ currencies with instant bank settlement.',
    },
    {
      q: 'How fast do international transfers settle?',
      a: 'Outbound payments to local bank accounts (e.g. GTBank, Access, Kuda, M-Pesa, SEPA) settle in under 30 seconds with real-time tracking.',
    },
    {
      q: 'Are there hidden FX conversion markups?',
      a: 'No. Proxim provides institutional real-time exchange rates with zero hidden markups or surprise fees.',
    },
    {
      q: 'Can I hold both Fiat and Digital Dollars (USDC)?',
      a: 'Yes. You can hold NGN, USD, EUR, GBP, USDC, and USDT in unified multi-currency vaults inside one account.',
    },
    {
      q: 'How does the Auto-Yield Engine work?',
      a: 'Idle cash balances automatically earn between 4.0% and 8.5% Net APY through automated sweep vaults without locking your money.',
    },
    {
      q: 'How does Proxim protect my funds and security?',
      a: 'Proxim uses biometric Passkeys (FaceID/TouchID), multi-party key infrastructure (HSMs), and bank-grade encryption to guarantee enterprise security.',
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
          <div className="hidden md:flex items-center gap-9 text-sm font-500 text-[#F7F8F4]/80">
            {[['#features', 'Features'], ['#currencies', 'Currencies'], ['#how-it-works', 'How it works'], ['#business', 'Business'], ['#security', 'Security'], ['#faq', 'FAQ']].map(([h, l]) => (
              <a key={h} href={h} className="hover:text-white transition-colors duration-150">{l}</a>
            ))}
          </div>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href={APP_URL} target="_blank" rel="noopener noreferrer"
              className="text-sm font-600 text-[#F7F8F4]/85 hover:text-white transition-colors px-3 py-2"
            >
              Sign in
            </a>
            <a
              href={APP_URL} target="_blank" rel="noopener noreferrer"
              className="btn-primary !text-sm !py-2.5 !px-5"
            >
              Get started <ArrowRight className="w-4 h-4" />
            </a>
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
              {[['#features', 'Features'], ['#currencies', 'Currencies'], ['#how-it-works', 'How it works'], ['#business', 'Business'], ['#security', 'Security'], ['#faq', 'FAQ']].map(([h, l]) => (
                <a
                  key={h} href={h} onClick={() => setMobileMenuOpen(false)}
                  className="block py-2.5 text-base font-600 text-[#F7F8F4] border-b border-white/10 last:border-0"
                >
                  {l}
                </a>
              ))}
              <div className="pt-2 space-y-3">
                <a
                  href={APP_URL} target="_blank" rel="noopener noreferrer"
                  className="w-full text-center block py-3 rounded-2xl font-700 text-sm bg-white/10 border border-white/15 text-white"
                >
                  Sign in
                </a>
                <a
                  href={APP_URL} target="_blank" rel="noopener noreferrer"
                  className="btn-primary w-full text-center block !text-sm !py-3"
                >
                  Get started <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ──────────────────────────────────────────
          01 — HERO SECTION (3-SECOND RULE REWRITE & TRUST STRIP)
          ────────────────────────────────────────── */}
      <section id="hero" className="relative overflow-hidden pt-12 pb-24 sm:pt-20 sm:pb-36 bg-[#060B14]">
        <ProximBrandGuideSky />

        <div className="relative z-20 max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">

            {/* Left Column Copy (High Conversion Clarity) */}
            <motion.div className="lg:col-span-6 space-y-8 text-center lg:text-left" initial="hidden" animate="visible" variants={stagger}>
              
              <motion.div variants={fadeUp} custom={0}>
                <span className="badge-aurora">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#35D9D0]" /> Borderless Multi-Currency Account
                </span>
              </motion.div>

              {/* H1 Headline */}
              <motion.h1
                variants={fadeUp} custom={1}
                className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-white leading-[1.14] tracking-[-0.02em]"
              >
                Send, hold and spend{' '}
                <span className="relative inline-block">
                  global money
                  <span className="absolute -bottom-1.5 left-0 w-20 sm:w-28 h-1 rounded-full bg-[#35D9D0]" />
                </span>{' '}
                <span className="text-gradient-without-limits">without limits.</span>
              </motion.h1>

              {/* Sub-headline */}
              <motion.p
                variants={fadeUp} custom={2}
                className="text-base sm:text-lg text-[#F7F8F4]/85 leading-relaxed max-w-md mx-auto lg:mx-0 font-normal"
              >
                Proxim gives individuals and businesses local multi-currency accounts in NGN, USD, EUR &amp; Digital Dollars with instant bank payouts settling in under 30 seconds.
              </motion.p>

              {/* Action Buttons */}
              <motion.div
                variants={fadeUp} custom={3}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start max-w-sm mx-auto lg:mx-0 pt-2"
              >
                <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  Open Account Free <ArrowRight className="w-4 h-4" />
                </a>
                <a href="#how-it-works" className="btn-secondary">
                  See live demo
                </a>
              </motion.div>

              {/* Immediate Trust & Security Strip */}
              <motion.div
                variants={fadeUp} custom={4}
                className="pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left max-w-lg mx-auto lg:mx-0"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#16C7B7] shrink-0" />
                  <span className="text-[0.72rem] font-600 text-white/80 leading-tight">Passkey Biometric Security</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#35D9D0] shrink-0" />
                  <span className="text-[0.72rem] font-600 text-white/80 leading-tight">Instant &lt; 30s Bank Payouts</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#7567F8] shrink-0" />
                  <span className="text-[0.72rem] font-600 text-white/80 leading-tight">18+ Global Currencies</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#FF5DA8] shrink-0" />
                  <span className="text-[0.72rem] font-600 text-white/80 leading-tight">8.5% APY Auto-Yield Engine</span>
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
                  { id: 'VAULTS', label: '1. Vaults', icon: Wallet },
                  { id: 'SEND', label: '2. Instant Send', icon: Send },
                  { id: 'YIELD', label: '3. Auto-Yield', icon: PiggyBank },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setPhoneArtifactTab(id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-700 flex items-center gap-1.5 transition-all ${
                      phoneArtifactTab === id
                        ? 'bg-[#16C7B7] text-[#060B14] shadow-md'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Smartphone Frame */}
              <div
                className="phone-3d-frame relative z-20 w-[310px] sm:w-[340px] h-[630px] sm:h-[675px] rounded-[48px] p-3.5 shadow-2xl"
                style={{
                  background: 'linear-gradient(145deg, #2A364F 0%, #151D2A 50%, #0A0E17 100%)',
                  boxShadow: '0 30px 90px rgba(0, 0, 0, 0.90), inset 0 1px 1px rgba(255, 255, 255, 0.3), 0 0 50px rgba(53, 217, 208, 0.30)',
                }}
              >
                <div className="absolute -left-1.5 top-28 w-1 h-10 rounded-l-md bg-white/20" />
                <div className="absolute -left-1.5 top-42 w-1 h-10 rounded-l-md bg-white/20" />
                <div className="absolute -right-1.5 top-36 w-1 h-14 rounded-r-md bg-white/20" />

                {/* Dynamic Screen Content Based on Active Tab */}
                <div className="w-full h-full rounded-[40px] bg-[#0A0E17] border border-white/15 overflow-hidden flex flex-col justify-between p-3.5 relative">
                  
                  {/* Top Bar */}
                  <div className="space-y-2 shrink-0">
                    <div className="flex items-center justify-between text-[0.6rem] font-bold text-white/70 px-2">
                      <span className="font-mono text-white">Proxim</span>
                      <div className="w-20 h-4 bg-[#060B14] rounded-full mx-auto flex items-center justify-center gap-1.5 border border-white/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#35D9D0]" />
                        <div className="w-1 h-1 rounded-full bg-white/30" />
                      </div>
                      <span className="font-mono">9:41</span>
                    </div>

                    <div className="flex items-center justify-between bg-white/5 p-2 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#16C7B7]/20 border border-[#16C7B7] flex items-center justify-center text-xs font-bold text-[#35D9D0]">
                          I
                        </div>
                        <div>
                          <p className="text-[0.55rem] text-white/50 leading-tight">Good evening</p>
                          <p className="text-xs font-extrabold text-white leading-tight">igbozeigboze</p>
                        </div>
                      </div>

                      <button
                        onClick={() => setActiveEntityTab(activeEntityTab === 'PERSONAL' ? 'BUSINESS' : 'PERSONAL')}
                        className="px-2.5 py-1 rounded-xl text-[0.6rem] font-700 bg-[#16C7B7]/20 text-[#35D9D0] border border-[#16C7B7]/40 flex items-center gap-1"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#35D9D0] animate-pulse" />
                        {activeEntityTab === 'PERSONAL' ? 'Personal' : 'Business'}
                      </button>
                    </div>
                  </div>

                  {/* TAB 1: MULTI-CURRENCY VAULTS */}
                  {phoneArtifactTab === 'VAULTS' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2.5 my-auto">
                      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#151D2A] to-[#0A0E17] border border-[#16C7B7]/35 space-y-2 shadow-lg">
                        <div className="flex justify-between items-center text-[0.6rem]">
                          <span className="text-white/60 font-600 uppercase tracking-wider">Available</span>
                          <span className="px-2 py-0.5 rounded-lg bg-white/10 text-white font-bold text-[0.62rem] border border-white/10">
                            NGN ⌄
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <p className="text-2xl font-extrabold text-white tracking-tight">
                            {activeEntityTab === 'PERSONAL' ? '₦4,250,220.00' : '₦14,850,000.00'}
                          </p>
                          <div className="flex items-center justify-between text-[0.62rem]">
                            <span className="text-white/70 font-500">Held as $2,742.00 USDC</span>
                            <span className="text-[#35D9D0] font-700">+$1,250.00 today</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-6 gap-1 pt-1 text-center">
                          {[
                            { label: 'Send', icon: Send, bg: 'bg-[#16C7B7] text-[#060B14]' },
                            { label: 'Receive', icon: ArrowDownLeft, bg: 'bg-white/10 text-white' },
                            { label: 'Request', icon: Bell, bg: 'bg-white/10 text-white' },
                            { label: 'Contacts', icon: Users, bg: 'bg-white/10 text-white' },
                            { label: 'Save', icon: PiggyBank, bg: 'bg-white/10 text-white' },
                            { label: 'Stocks', icon: LineChart, bg: 'bg-white/10 text-white' },
                          ].map(({ label, icon: Icon, bg }) => (
                            <div key={label} className="flex flex-col items-center gap-1">
                              <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center shadow-md`}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-[0.55rem] font-600 text-white/90 truncate">{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 space-y-1 text-[0.65rem]">
                        <p className="text-white/60 font-600">Active Multi-Currency Accounts:</p>
                        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                          <div className="p-1.5 rounded-xl bg-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <img src="/flags/ng.png" alt="NGN" className="w-3.5 h-3.5 rounded-full" />
                              <span className="font-700 text-white">₦4,250,220</span>
                            </div>
                            <span className="text-[0.55rem] text-white/50">NGN</span>
                          </div>
                          <div className="p-1.5 rounded-xl bg-[#16C7B7]/10 border border-[#16C7B7]/30 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <img src="/flags/usdc.png" alt="USDC" className="w-3.5 h-3.5 rounded-full" />
                              <span className="font-700 text-[#35D9D0]">$5,000.00</span>
                            </div>
                            <span className="text-[0.55rem] text-[#16C7B7] font-700">USDC</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 2: INSTANT GLOBAL SEND FLOW */}
                  {phoneArtifactTab === 'SEND' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2.5 my-auto">
                      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                        <div className="flex justify-between items-center text-[0.6rem]">
                          <span className="text-white/60 font-600 uppercase">Transfer to Local Bank</span>
                          <span className="text-[#16C7B7] font-700">&lt; 30s Guaranteed</span>
                        </div>

                        <div className="p-2 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center text-xs">
                          <div>
                            <p className="text-[0.58rem] text-white/50">You Send</p>
                            <p className="font-extrabold text-white">$500.00 USD</p>
                          </div>
                          <span className="text-[#35D9D0] font-mono text-[0.65rem]">Rate: 1550</span>
                        </div>

                        <div className="p-2 rounded-xl bg-[#16C7B7]/15 border border-[#16C7B7]/40 flex justify-between items-center text-xs">
                          <div>
                            <p className="text-[0.58rem] text-[#35D9D0] font-600">Recipient Receives (GTBank)</p>
                            <p className="font-extrabold text-[#35D9D0]">₦775,000.00 NGN</p>
                          </div>
                          <CheckCircle className="w-4 h-4 text-[#16C7B7]" />
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center space-y-1">
                        <p className="text-[0.6rem] text-white/60">Payout Delivery Counter</p>
                        <p className="text-lg font-extrabold text-[#16C7B7] font-mono">00:14.2s — SETTLED</p>
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 3: AUTO-YIELD ENGINE */}
                  {phoneArtifactTab === 'YIELD' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2.5 my-auto">
                      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#16C7B7]/20 to-[#7567F8]/20 border border-[#16C7B7]/40 space-y-2">
                        <div className="flex items-center justify-between text-[0.6rem]">
                          <span className="font-extrabold text-white uppercase">Automated Idle Cash Sweep</span>
                          <span className="px-2 py-0.5 rounded-full text-[0.58rem] font-800 bg-[#16C7B7]/30 text-[#35D9D0]">
                            8.5% APY
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <p className="text-2xl font-extrabold text-white">$2,450.00</p>
                          <p className="text-[0.62rem] text-[#35D9D0]">+$14.20 interest earned this month</p>
                        </div>

                        <div className="p-2 rounded-xl bg-white/10 flex justify-between items-center text-[0.6rem]">
                          <span className="text-white/80">Sweep Threshold</span>
                          <span className="font-bold text-white">Above $500</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Bottom Navigation */}
                  <div className="grid grid-cols-4 gap-1 p-2 rounded-2xl bg-white/5 border border-white/10 text-center shrink-0">
                    <div className="flex flex-col items-center gap-0.5 text-[#35D9D0]">
                      <Home className="w-3.5 h-3.5" />
                      <span className="text-[0.55rem] font-700">Home</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 text-white/60">
                      <Activity className="w-3.5 h-3.5" />
                      <span className="text-[0.55rem] font-600">Activity</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 text-white/60">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span className="text-[0.55rem] font-600">Cards</span>
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
                  <p className="text-[0.7rem] text-[#35D9D0]">Instant &lt; 30s bank payout</p>
                </div>
              </div>

            </motion.div>

          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          02 — REAL CURRENCY & PAYOUT ROUTES (SOFT IVORY SECTION)
          ────────────────────────────────────────── */}
      <section id="currencies" className="relative overflow-hidden py-24 bg-[#F7F8F4] text-[#0F1414]">
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-700 uppercase tracking-wider bg-[#0F1414]/10 text-[#0F1414] border border-[#0F1414]/15">
              Global Coverage &amp; Payout Routes
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F1414] tracking-tight">
              Supported Fiat &amp; Digital Currencies
            </h2>
            <p className="text-sm sm:text-base text-[#0F1414]/70">
              Direct settlement into local bank accounts across Africa, Europe, the US, and global digital reserves.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {currenciesList.map((c) => (
              <div
                key={c.code}
                className="p-5 rounded-2xl bg-white border border-[#0F1414]/10 shadow-md flex items-center justify-between hover:border-[#16C7B7] transition-all hover:shadow-lg"
              >
                <div className="flex items-center gap-3.5">
                  <img
                    src={c.flag}
                    alt={c.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0 shadow-sm"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-extrabold text-[#0F1414] leading-tight">{c.code}</p>
                      <span className="text-xs text-[#0F1414]/50 font-mono">({c.symbol})</span>
                    </div>
                    <p className="text-xs text-[#0F1414]/70 font-500">{c.name}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 rounded-lg text-[0.68rem] font-700 bg-[#16C7B7]/15 text-[#0F1414] border border-[#16C7B7]/30">
                    {c.route}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          03 — THE PROBLEM STATEMENT
          ────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-36 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-4xl mx-auto px-6 sm:px-8 space-y-8 text-center sm:text-left">
          <span className="badge-aurora">The Challenge</span>
          <h2 className="text-2xl sm:text-4xl font-bold text-white leading-tight tracking-tight">
            Money is still fragmented across borders, currencies, and platforms.
          </h2>
          <p className="text-lg sm:text-xl text-[#F7F8F4]/80 leading-relaxed max-w-2xl">
            High conversion fees, delayed international settlement times, and disconnected financial rails slow down individuals and growing businesses. Proxim unifies global money into one transparent system.
          </p>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          04 — RE-ENGINEERED LIVE RATE SIMULATOR
          ────────────────────────────────────────── */}
      <section id="features" className="relative overflow-hidden py-24 sm:py-36 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            <div className="lg:col-span-5 space-y-6">
              <span className="badge-aurora">01 — Move Money</span>
              <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
                Transfer money anywhere in seconds.
              </h2>
              <p className="text-base sm:text-lg text-[#F7F8F4]/80 leading-relaxed">
                Send money across borders directly into local destination bank accounts. Real-time rates, zero hidden markup, instant settlement.
              </p>
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 text-sm text-[#F7F8F4]">
                  <CheckCircle2 className="w-4 h-4 text-[#16C7B7]" />
                  <span>Settles in under 30 seconds</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-[#F7F8F4]">
                  <CheckCircle2 className="w-4 h-4 text-[#16C7B7]" />
                  <span>Live institutional FX conversion rates</span>
                </div>
              </div>
            </div>

            {/* Transparent Rate & Fee Simulator */}
            <div className="lg:col-span-7 card-glass p-6 sm:p-8 rounded-[36px] border-[#16C7B7]/30 space-y-6 bg-[#0F1524]/90">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-xs font-700 text-white uppercase tracking-wider">Live Institutional Rate Calculator</span>
                  <p className="text-[0.7rem] text-[#35D9D0]">Real-time Mid-Market FX Feed</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-700 bg-[#16C7B7]/20 text-[#16C7B7] border border-[#16C7B7]/40 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 animate-pulse" /> Live Market Feed
                </span>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs text-[#F7F8F4]/60 font-600">
                    <span>You Send</span>
                    <span>Source Balance</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <input
                      type="number"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="w-full bg-transparent text-2xl font-extrabold text-white outline-none"
                    />
                    <select
                      value={sourceCurrency}
                      onChange={(e: any) => setSourceCurrency(e.target.value)}
                      className="bg-[#060B14] text-white text-sm font-700 px-3 py-2 rounded-xl border border-white/15 outline-none cursor-pointer"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-[#16C7B7]/20 border border-[#16C7B7] flex items-center justify-center">
                    <Repeat className="w-4 h-4 text-[#16C7B7]" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs text-[#F7F8F4]/60 font-600">
                    <span>Recipient Receives (Direct Bank)</span>
                    <span>Guaranteed Rate</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-2xl font-extrabold text-[#35D9D0]">
                      {calculatedOutput}
                    </span>
                    <select
                      value={targetCurrency}
                      onChange={(e: any) => setTargetCurrency(e.target.value)}
                      className="bg-[#060B14] text-white text-sm font-700 px-3 py-2 rounded-xl border border-white/15 outline-none cursor-pointer"
                    >
                      <option value="NGN">NGN (₦)</option>
                      <option value="KES">KES (KSh)</option>
                      <option value="GHS">GHS (GH₵)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Transparent Fee & Delivery Guarantee Banner */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 text-center text-xs">
                <div>
                  <p className="text-[0.62rem] text-white/50 uppercase">Proxim Fee</p>
                  <p className="font-extrabold text-[#16C7B7]">₦0.00</p>
                </div>
                <div>
                  <p className="text-[0.62rem] text-white/50 uppercase">Delivery Time</p>
                  <p className="font-extrabold text-[#35D9D0]">&lt; 30 Seconds</p>
                </div>
                <div>
                  <p className="text-[0.62rem] text-white/50 uppercase">Rate Guarantee</p>
                  <p className="font-extrabold text-white">Locked 15 Mins</p>
                </div>
              </div>

              <div className="pt-2">
                <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="btn-primary w-full text-center block !py-3">
                  Send Money Now
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          05 — SPEND GLOBALLY (VIRTUAL DEBIT CARD)
          ────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-36 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Debit Card Artifact */}
            <div className="lg:col-span-6 relative flex justify-center items-center min-h-[340px]">
              <div className="w-[320px] sm:w-[360px] h-[200px] sm:h-[225px] rounded-3xl p-6 card-glass bg-gradient-to-br from-[#1A2333] via-[#060B14] to-[#0A0E17] border-[#16C7B7]/30 shadow-2xl relative z-10 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <img src="/proxim-icon.png" alt="Proxim" className="w-7 h-7 rounded-lg object-cover" />
                    <p className="text-[0.65rem] font-bold text-white tracking-wider uppercase mt-1">Proxim</p>
                  </div>
                  <Wifi className="w-5 h-5 text-[#35D9D0]" />
                </div>
                <div>
                  <p className="text-xs font-mono text-white/70 tracking-widest mb-1">4892 •••• •••• 9102</p>
                  <div className="flex justify-between items-end text-xs text-white">
                    <div>
                      <p className="text-[0.6rem] text-white/50 uppercase">Cardholder</p>
                      <p className="font-600">PRIMARY ACCOUNT</p>
                    </div>
                    <span className="font-bold text-[#16C7B7]">VISA</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-6">
              <span className="badge-aurora">02 — Spend Globally</span>
              <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
                Pay anywhere, auto-converted.
              </h2>
              <p className="text-base sm:text-lg text-[#F7F8F4]/80 leading-relaxed">
                Generate virtual debit cards instantly. Pay for international subscriptions, software tools, and online travel. Auto-converts from your multi-currency balances at point-of-sale.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          06 — PROXIM FOR BUSINESS (DUAL STORYTELLING)
          ────────────────────────────────────────── */}
      <section id="business" className="relative overflow-hidden py-24 sm:py-36 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">

            <div className="lg:col-span-6 space-y-6">
              <span className="badge-aurora">Proxim for Business</span>
              <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
                Built for businesses that move globally.
              </h2>
              <p className="text-base sm:text-lg text-[#F7F8F4]/80 leading-relaxed">
                Pay global contractors, execute automated batch payroll runs in local currencies, and manage multi-currency treasury without traditional bank markups.
              </p>
              <div>
                <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  Explore Proxim for Business <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Business Treasury Artifact */}
            <div className="lg:col-span-6 card-glass p-6 sm:p-8 rounded-[36px] space-y-6 border-[#16C7B7]/30 bg-[#0F1524]/90">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h4 className="text-base font-bold text-white">Treasury &amp; Payroll Engine</h4>
                  <p className="text-xs text-[#35D9D0]">Business Multi-Currency Account</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-700 bg-[#16C7B7]/20 text-[#16C7B7] border border-[#16C7B7]/40">
                  Active Treasury
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-[0.68rem] text-white/60 font-600 uppercase">Monthly Payroll</p>
                  <p className="text-xl font-extrabold text-white mt-1">₦14,850,000</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-[0.68rem] text-white/60 font-600 uppercase">Global Vendors</p>
                  <p className="text-xl font-extrabold text-[#35D9D0] mt-1">12 Paid</p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <p className="font-700 text-white/60 uppercase">Batch Payout Executed</p>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex justify-between">
                  <span className="font-600 text-white">Engineering Team Payroll</span>
                  <span className="text-[#16C7B7] font-700">Processed (&lt; 30s)</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          07 — SECURITY & LICENSED INFRASTRUCTURE
          ────────────────────────────────────────── */}
      <section id="security" className="relative overflow-hidden py-24 sm:py-36 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 space-y-16">
          <div className="max-w-2xl space-y-4">
            <span className="badge-aurora">Security Architecture</span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              Enterprise security. Zero compromise.
            </h2>
            <p className="text-base sm:text-lg text-[#F7F8F4]/80">
              Built from the ground up to protect your funds, privacy, and account security.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card-glass p-8 rounded-3xl space-y-4 border-white/12">
              <div className="w-12 h-12 rounded-2xl bg-[#16C7B7]/20 border border-[#16C7B7] flex items-center justify-center text-[#35D9D0]">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Biometric Passkey Security</h3>
              <p className="text-sm text-[#F7F8F4]/75 leading-relaxed">
                Sign in securely with FaceID, TouchID, or hardware keys. No passwords to leak or intercept.
              </p>
            </div>

            <div className="card-glass p-8 rounded-3xl space-y-4 border-white/12">
              <div className="w-12 h-12 rounded-2xl bg-[#7567F8]/20 border border-[#7567F8] flex items-center justify-center text-[#7567F8]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Cryptographic Custody</h3>
              <p className="text-sm text-[#F7F8F4]/75 leading-relaxed">
                Hardware Security Modules (HSMs) and multi-party authentication safeguard multi-currency reserves.
              </p>
            </div>

            <div className="card-glass p-8 rounded-3xl space-y-4 border-white/12">
              <div className="w-12 h-12 rounded-2xl bg-[#FF5DA8]/20 border border-[#FF5DA8] flex items-center justify-center text-[#FF5DA8]">
                <Server className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">24/7 Monitored Settlement</h3>
              <p className="text-sm text-[#F7F8F4]/75 leading-relaxed">
                Real-time bank payout tracking with automated failover guarantees your transfers complete in under 30 seconds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          08 — INFRASTRUCTURE PARTNER LOGOS
          ────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-32 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-8 space-y-12 text-center">
          <div className="space-y-3 max-w-xl mx-auto">
            <span className="badge-aurora">Infrastructure</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Engineered on licensed financial &amp; security infrastructure.
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 items-center justify-center max-w-5xl mx-auto pt-4">
            <div className="p-6 rounded-2xl bg-white flex items-center justify-center h-24 shadow-lg hover:scale-105 transition-all">
              <img src="/partners/privy.png" alt="Privy" className="h-8 sm:h-9 w-auto object-contain" />
            </div>

            <div className="p-6 rounded-2xl bg-white flex items-center justify-center h-24 shadow-lg hover:scale-105 transition-all">
              <img src="/partners/near.png" alt="NEAR" className="h-8 sm:h-9 w-auto object-contain" />
            </div>

            <div className="p-6 rounded-2xl bg-white flex items-center justify-center h-24 shadow-lg hover:scale-105 transition-all">
              <img src="/partners/yellowcard.png" alt="Yellow Card" className="h-8 sm:h-9 w-auto object-contain" />
            </div>

            <div className="p-6 rounded-2xl bg-[#0F1524] border border-white/20 flex items-center justify-center h-24 shadow-lg hover:scale-105 transition-all">
              <img src="/partners/senviok.png" alt="Senviok" className="h-8 sm:h-9 w-auto object-contain rounded-lg" />
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          09 — FAQ SECTION
          ────────────────────────────────────────── */}
      <section id="faq" className="relative overflow-hidden py-24 sm:py-36 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-3xl mx-auto px-6 sm:px-8 space-y-12">
          <div className="space-y-3 text-center">
            <span className="badge-aurora">FAQ</span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              Frequently asked questions.
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const open = activeFaq === idx;
              return (
                <div key={idx} className="card-glass rounded-2xl border-white/10 overflow-hidden">
                  <button
                    onClick={() => setActiveFaq(open ? null : idx)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left gap-4 hover:bg-white/5 transition-colors"
                  >
                    <span className="text-base font-700 text-white">{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#35D9D0] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {open && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-6 pb-5 text-sm text-[#F7F8F4]/80 leading-relaxed border-t border-white/10 pt-4"
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
          10 — FINAL CTA & FOOTER
          ────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-36 border-t border-white/10 bg-[#060B14]">
        <ProximBrandGuideSky />
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
          <span className="badge-aurora">Get Started</span>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
            Your money should work around you.
          </h2>
          <p className="text-base sm:text-lg text-[#F7F8F4]/80 max-w-xl mx-auto">
            Open your Proxim account in minutes and experience borderless global money.
          </p>
          <div>
            <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="btn-primary !text-base !py-4 !px-9">
              Open Account Free <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-14 bg-[#060B14] border-t border-white/10 text-xs text-[#F7F8F4]/60">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <a href="#" className="flex items-center gap-3">
              <img src="/proxim-icon.png" alt="Proxim" className="w-7 h-7 rounded-lg object-cover" />
              <span className="text-lg font-extrabold text-white tracking-tight">Proxim</span>
            </a>

            <nav className="flex flex-wrap gap-7 text-sm font-500">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#currencies" className="hover:text-white transition-colors">Currencies</a>
              <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
              <a href="#business" className="hover:text-white transition-colors">Business</a>
              <a href="#security" className="hover:text-white transition-colors">Security</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            </nav>

            <a
              href="https://x.com/proximfi" target="_blank" rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors"
              title="@proximfi on X"
            >
              <XIcon className="w-4 h-4" />
            </a>
          </div>

          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[#F7F8F4]/40 text-xs">
            <p>© 2026 Proxim Inc. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <span className="font-700 text-[#16C7B7]">proximfi.xyz</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
