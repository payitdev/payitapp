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
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

/* ══════════════════════════════════════════════════════
   SVG ICONS
   ══════════════════════════════════════════════════════ */
const XIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/* ══════════════════════════════════════════════════════
   PHOTOGRAPHIC SOUTHERN LIGHTS (AURORA AUSTRALIS) OVERLAY
   Matches the user's uploaded reference photos from Southern Africa:
   - Deep Crimson Red / Ruby-Rose Sky Glow
   - Vertical Pillars of Crimson Light rising from the horizon
   - Warm Amber & Coral reflections
   - Starry Night & Milky Way Sky
   ══════════════════════════════════════════════════════ */
interface SouthernLightsPillarsProps {
  intensity?: number;
}
const SouthernLightsPillars = ({ intensity = 0.55 }: SouthernLightsPillarsProps) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" style={{ opacity: intensity }}>
    {/* Deep Crimson & Ruby Sky Glow */}
    <div
      className="absolute inset-0"
      style={{
        background: `
          radial-gradient(ellipse 130% 80% at 50% -10%, rgba(220, 38, 38, 0.48) 0%, rgba(225, 29, 72, 0.35) 45%, rgba(244, 63, 94, 0.20) 70%, transparent 95%),
          radial-gradient(ellipse 100% 50% at 50% 90%, rgba(245, 158, 11, 0.22) 0%, rgba(220, 38, 38, 0.15) 50%, transparent 80%)
        `,
      }}
    />

    {/* Vertical Light Pillars (Photographic Match) */}
    <div className="pillar-anim absolute inset-0 flex justify-around opacity-75">
      <div className="w-16 sm:w-24 h-full" style={{ background: 'linear-gradient(to top, transparent 20%, rgba(220, 38, 38, 0.35) 60%, rgba(244, 63, 94, 0.15) 90%)', filter: 'blur(16px)' }} />
      <div className="w-24 sm:w-36 h-full" style={{ background: 'linear-gradient(to top, transparent 15%, rgba(225, 29, 72, 0.40) 65%, rgba(251, 113, 133, 0.20) 95%)', filter: 'blur(20px)' }} />
      <div className="w-20 sm:w-28 h-full" style={{ background: 'linear-gradient(to top, transparent 25%, rgba(220, 38, 38, 0.38) 70%, transparent 98%)', filter: 'blur(14px)' }} />
      <div className="w-28 sm:w-40 h-full" style={{ background: 'linear-gradient(to top, transparent 10%, rgba(244, 63, 94, 0.32) 55%, rgba(245, 158, 11, 0.15) 85%)', filter: 'blur(22px)' }} />
      <div className="w-16 sm:w-24 h-full" style={{ background: 'linear-gradient(to top, transparent 20%, rgba(220, 38, 38, 0.30) 60%, transparent 90%)', filter: 'blur(16px)' }} />
    </div>

    {/* Starry Night Sky Texture */}
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `radial-gradient(circle at 50% 25%, rgba(255, 255, 255, 0.40) 1px, transparent 1px), radial-gradient(circle at 15% 35%, rgba(255, 255, 255, 0.30) 1px, transparent 1px), radial-gradient(circle at 85% 20%, rgba(255, 255, 255, 0.35) 1px, transparent 1px), radial-gradient(circle at 70% 55%, rgba(255, 255, 255, 0.25) 1px, transparent 1px)`,
        backgroundSize: '200px 200px',
        opacity: 0.65,
      }}
    />
  </div>
);

/* ══════════════════════════════════════════════════════
   SEAMLESS AFRICAN LANDSCAPE ENVIRONMENT WRAPPER
   Feathers top & bottom edges so backgrounds seamlessly dissolve
   into one another without any hard boundary or line cut.
   ══════════════════════════════════════════════════════ */
interface RealEnvSectionProps {
  id?: string;
  className?: string;
  children: React.ReactNode;
  bgImage: string;
  bgOpacity?: number;
  auroraIntensity?: number;
  fadeInTop?: boolean;
  fadeInBottom?: boolean;
}
const RealEnvSection = ({
  id,
  className = '',
  children,
  bgImage,
  bgOpacity = 0.20,
  auroraIntensity = 0.45,
  fadeInTop = true,
  fadeInBottom = true,
}: RealEnvSectionProps) => (
  <section id={id} className={`relative overflow-hidden bg-[#04050E] ${className}`}>

    {/* REAL Photographic Background Image with Top & Bottom Fade Masks */}
    <div
      className="absolute inset-0 bg-cover bg-center pointer-events-none transition-opacity duration-700"
      style={{
        backgroundImage: `url(${bgImage})`,
        opacity: bgOpacity,
        filter: 'contrast(1.15) saturate(1.1)',
        WebkitMaskImage: `linear-gradient(to bottom, ${fadeInTop ? 'transparent 0%, black 20%' : 'black 0%'}, ${fadeInBottom ? 'black 80%, transparent 100%' : 'black 100%'})`,
        maskImage: `linear-gradient(to bottom, ${fadeInTop ? 'transparent 0%, black 20%' : 'black 0%'}, ${fadeInBottom ? 'black 80%, transparent 100%' : 'black 100%'})`,
      }}
    />

    {/* Photographic Crimson Southern Lights Overlay */}
    <SouthernLightsPillars intensity={auroraIntensity} />

    {/* Top & Bottom Seamless Feather Overlays */}
    {fadeInTop && (
      <div className="absolute top-0 left-0 right-0 h-36 pointer-events-none z-1"
        style={{ background: 'linear-gradient(to bottom, #04050E 0%, transparent 100%)' }} />
    )}
    {fadeInBottom && (
      <div className="absolute bottom-0 left-0 right-0 h-36 pointer-events-none z-1"
        style={{ background: 'linear-gradient(to top, #04050E 0%, transparent 100%)' }} />
    )}

    {/* Radial Ambient Center Highlight */}
    <div className="absolute inset-0 pointer-events-none"
      style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(4,5,14,0.35) 100%)' }} />

    {/* Section Content */}
    <div className="relative z-10">{children}</div>
  </section>
);

/* ══════════════════════════════════════════════════════
   MOTION VARIANTS
   ══════════════════════════════════════════════════════ */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.58, ease: 'easeOut' as const, delay: (i as number) * 0.09 },
  }),
};
const stagger = { visible: { transition: { staggerChildren: 0.09 } } };

/* ══════════════════════════════════════════════════════
   MAIN APP COMPONENT
   ══════════════════════════════════════════════════════ */
export default function App() {
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCurrencyCat, setActiveCurrencyCat] = useState<'fiats' | 'crypto' | 'stablecoins'>('fiats');
  const [activeFaq, setActiveFaq]       = useState<number | null>(0);
  const [scrolled, setScrolled]         = useState(false);

  // Waitlist form
  const [modalTitle, setModalTitle]     = useState('Join PURLEN Early Access');
  const [modalSub, setModalSub]         = useState('Money without limits. Be among the first to experience seamless multi-currency payments.');
  const [email, setEmail]               = useState('');
  const [persona, setPersona]           = useState<'freelancer'|'founder'|'sme'|'interested'>('freelancer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted]   = useState(false);
  const [submitError, setSubmitError]   = useState('');

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const openModal = (title = 'Join PURLEN Early Access', sub = 'Money without limits. Be among the first.') => {
    setModalTitle(title); setModalSub(sub);
    setIsSubmitted(false); setSubmitError(''); setEmail('');
    setIsModalOpen(true); setMobileMenuOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true); setSubmitError('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), persona, source: 'website_modal' }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Failed to submit. Please try again.');
      setIsSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message === 'Failed to fetch'
        ? "We couldn't reach our servers. Please check your connection."
        : err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── DATA ── */
  const innerOrbit = [
    { name: 'USDC', label: 'USD Coin',  flag: '/flags/usdc.png', angle: 0   },
    { name: 'USDT', label: 'Tether USD', flag: '/flags/usdt.png', angle: 180 },
  ];
  const middleOrbit = [
    { name: 'BTC', label: 'Bitcoin',   flag: '/flags/btc.png', angle: 0   },
    { name: 'ETH', label: 'Ethereum',  flag: '/flags/eth.png', angle: 72  },
    { name: 'SOL', label: 'Solana',    flag: '/flags/sol.png', angle: 144 },
    { name: 'ARB', label: 'Arbitrum',  flag: '/flags/arb.png', angle: 216 },
    { name: 'Particle', label: 'Particle', flag: '/partner-particle-clean.png', angle: 288 },
  ];
  const outerOrbit = [
    { name: 'NGN', label: 'Naira',       flag: '/flags/ng.png', angle: 0   },
    { name: 'USD', label: 'US Dollar',   flag: '/flags/us.png', angle: 20  },
    { name: 'EUR', label: 'Euro',        flag: '/flags/eu.png', angle: 40  },
    { name: 'GBP', label: 'Pound',       flag: '/flags/gb.png', angle: 60  },
    { name: 'KES', label: 'Shilling',    flag: '/flags/ke.png', angle: 80  },
    { name: 'GHS', label: 'Cedi',        flag: '/flags/gh.png', angle: 100 },
    { name: 'ZAR', label: 'Rand',        flag: '/flags/za.png', angle: 120 },
    { name: 'XOF', label: 'CFA Franc',   flag: '/flags/ci.png', angle: 140 },
    { name: 'EGP', label: 'Pound',       flag: '/flags/eg.png', angle: 160 },
    { name: 'RWF', label: 'Franc',       flag: '/flags/rw.png', angle: 180 },
    { name: 'UGX', label: 'Shilling',    flag: '/flags/ug.png', angle: 200 },
    { name: 'TZS', label: 'Shilling',    flag: '/flags/tz.png', angle: 220 },
    { name: 'ZMW', label: 'Kwacha',      flag: '/flags/zm.png', angle: 240 },
    { name: 'MAD', label: 'Dirham',      flag: '/flags/ma.png', angle: 260 },
    { name: 'BWP', label: 'Pula',        flag: '/flags/bw.png', angle: 280 },
    { name: 'CAD', label: 'Dollar',      flag: '/flags/ca.png', angle: 300 },
    { name: 'AUD', label: 'Dollar',      flag: '/flags/au.png', angle: 320 },
    { name: 'AED', label: 'Dirham',      flag: '/flags/ae.png', angle: 340 },
  ];

  const faqs = [
    {
      q: 'How does PURLEN handle payments across different currencies?',
      a: 'PURLEN gives you dedicated multi-currency balances. Hold, send, receive, and swap across 18+ local fiat currencies and digital dollars seamlessly, with automatic FX conversion at competitive market rates.',
    },
    {
      q: 'How fast are local bank withdrawals?',
      a: 'Withdrawals to local bank accounts — such as GTBank, Kuda, Zenith, or local mobile money — are processed instantly via automated settlement rails, arriving in your bank account in 30 seconds or less.',
    },
    {
      q: 'Are there any hidden fees or technical setup required?',
      a: 'No. PURLEN abstracts all underlying infrastructure. You will never encounter hidden network fees or complicated technical setup — the app feels and operates just like a modern digital bank.',
    },
    {
      q: 'How do PURLEN Virtual Visa cards work?',
      a: 'Generate virtual Visa debit cards directly inside the PURLEN app. Cards draw from your multi-currency balances and auto-convert at point-of-sale for international online shopping, subscriptions, and travel.',
    },
    {
      q: 'How does PURLEN keep my money safe?',
      a: 'PURLEN uses bank-grade encryption, hardware security modules, and multi-layer authentication. Your account is protected by institutional-grade infrastructure with real-time fraud monitoring.',
    },
  ];

  /* ══════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#04050E] text-[#080B18] font-sans antialiased overflow-x-hidden">

      {/* ──────────────────────────────────────────
          NAVIGATION
          ────────────────────────────────────────── */}
      <header className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'bg-[#04050E]/94 backdrop-blur-2xl border-b border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.45)]'
          : 'bg-[#04050E]/75 backdrop-blur-md'
      }`}>
        <nav className="max-w-6xl mx-auto px-5 sm:px-8 h-12 sm:h-16 flex items-center justify-between">

          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 group shrink-0" aria-label="PURLEN">
            <img src="/purlen-icon.png" alt="PURLEN"
              className="w-8 h-8 object-contain transition-transform duration-200 group-hover:scale-[1.06]" />
            <span className="text-xl font-extrabold text-white tracking-[-0.035em]">PURLEN</span>
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-7">
            {[['#experience','Features'],['#currencies','Currencies'],['#business','Business'],['#faq','FAQ']].map(([h,l]) => (
              <a key={h} href={h} className="text-[0.875rem] font-500 text-white/70 hover:text-white transition-colors duration-150">{l}</a>
            ))}
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            <a href="https://x.com/purlen" target="_blank" rel="noopener noreferrer"
              className="w-8 h-8 rounded-full bg-white/10 text-white/70 hover:bg-white hover:text-[#04050E] flex items-center justify-center transition-all border border-white/15"
              title="@purlen on X"><XIcon className="w-3.5 h-3.5" /></a>
            <button onClick={() => openModal('Sign In to PURLEN', 'Sign in for existing early access users.')}
              className="text-[0.875rem] font-600 text-white/80 hover:text-white transition-colors px-3 py-2">
              Sign in
            </button>
            <button onClick={() => openModal()} className="btn-primary !py-2.5 !px-5 !text-sm">
              Get started
            </button>
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu"
            className="md:hidden p-2 rounded-xl bg-white/10 border border-white/15 text-white">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[#08091A] border-b border-white/10 px-5 py-5 space-y-1">
              {[['#experience','Features'],['#currencies','Currencies'],['#business','Business'],['#faq','FAQ']].map(([h,l]) => (
                <a key={h} href={h} onClick={() => setMobileMenuOpen(false)}
                  className="block py-3 font-600 text-[0.9375rem] text-white border-b border-white/10 last:border-0">{l}</a>
              ))}
              <div className="pt-4 space-y-2.5">
                <button onClick={() => openModal('Sign In','Sign in for existing early access users.')}
                  className="w-full py-3 rounded-2xl font-700 text-sm bg-white/10 border border-white/15 text-white">Sign in</button>
                <button onClick={() => openModal()} className="btn-primary w-full !text-sm !py-3">Get started</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ──────────────────────────────────────────
          1. HERO — Vast African Mountain Landscape & Celestial Crimson Southern Lights Arc
          PICTORIAL LANGUAGE: Limitless horizon, money without limits.
          ────────────────────────────────────────── */}
      <RealEnvSection
        id="hero"
        className="min-h-[50vh] sm:min-h-[96vh] flex items-center pt-8 pb-20 sm:pt-10 sm:pb-28"
        bgImage="/bg/hero_mountain.png"
        bgOpacity={0.30}
        auroraIntensity={0.65}
        fadeInTop={false}
        fadeInBottom={true}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 relative z-10 w-full">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-center">

            {/* Left Column */}
            <motion.div className="lg:col-span-6 space-y-8 text-center lg:text-left"
              initial="hidden" animate="visible" variants={{ ...stagger }}>

              <motion.div variants={fadeUp} custom={0}>
                <span className="tag tag-dark"><ShieldCheck className="w-3.5 h-3.5" />Multi-Currency Accounts</span>
              </motion.div>

              <motion.h1 variants={fadeUp} custom={1}
                className="text-[2.8rem] sm:text-[4.2rem] lg:text-[4.8rem] font-extrabold text-white leading-[1.04] tracking-[-0.035em]">
                Money without{' '}
                <span className="relative inline-block">
                  <span style={{
                    background: 'linear-gradient(135deg, #F43F5E 0%, #DC2626 50%, #F59E0B 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>limits.</span>
                </span>
              </motion.h1>

              <motion.p variants={fadeUp} custom={2}
                className="text-base sm:text-lg leading-relaxed max-w-md mx-auto lg:mx-0 text-white/70">
                Move, hold, spend, and receive money across currencies from one simple account.
              </motion.p>

              <motion.div variants={fadeUp} custom={3}
                className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto lg:mx-0">
                <button onClick={() => openModal('Get Started with PURLEN', 'Create your free PURLEN account during our upcoming rollout.')}
                  className="btn-primary">
                  Get started <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                </button>
                <button onClick={() => openModal('Learn More', 'Explore everything PURLEN can do for you.')}
                  className="btn-ghost-dark">
                  How it works
                </button>
              </motion.div>

              <motion.div variants={fadeUp} custom={4}
                className="flex flex-wrap justify-center lg:justify-start gap-5 text-xs font-500 pt-6 border-t border-white/10 text-white/50">
                {[
                  [ShieldCheck, 'Bank-grade security'],
                  [Globe, '18+ currencies'],
                  [Lock, 'Regulated & compliant'],
                ].map(([Icon, label], i) => (
                  <div key={i} className="flex items-center gap-2">
                    {/* @ts-ignore */}
                    <Icon className="w-3.5 h-3.5 text-[#DC2626]" />
                    <span>{label as string}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right Column — Floating PURLEN Ecosystem over Landscape */}
            <motion.div className="lg:col-span-6 relative flex justify-center items-end min-h-[440px] sm:min-h-[540px]"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}>

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(ellipse, rgba(220,38,38,0.32) 0%, transparent 70%)' }} />

              {/* Phone App Interface Artifact */}
              <div className="float-a relative z-20 bottom-4 sm:bottom-8 left-2 sm:left-14"
                style={{ filter: 'drop-shadow(0 40px 60px rgba(220,38,38,0.38)) drop-shadow(0 0 40px rgba(245,158,11,0.20))' }}>
                <div className="w-[256px] sm:w-[284px] h-[516px] sm:h-[568px] rounded-[44px] p-[7px]"
                  style={{
                    background: 'linear-gradient(160deg, #2D0B12 0%, #08091A 55%, #04050E 100%)',
                    boxShadow: '0 32px 80px rgba(4,5,14,0.85), 0 0 0 1px rgba(255,255,255,0.14)',
                  }}>
                  <div className="w-full h-full rounded-[38px] flex flex-col overflow-hidden bg-[#08091A] border border-white/10">
                    {/* Notch */}
                    <div className="w-24 h-[22px] bg-[#04050E] rounded-b-2xl mx-auto flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#08091A] border border-white/10" />
                    </div>

                    <div className="flex-1 flex flex-col px-4 pb-4 pt-1 gap-3">
                      {/* Header */}
                      <div className="flex items-center justify-between py-0.5">
                        <div className="flex items-center gap-1.5">
                          <img src="/purlen-icon.png" alt="PURLEN" className="w-5 h-5 object-contain" />
                          <span className="text-[0.7rem] font-extrabold text-white tracking-tight">PURLEN</span>
                        </div>
                        <div className="flex gap-1.5">
                          {[Search, Bell].map((Icon, i) => (
                            <div key={i} className="w-6 h-6 rounded-full flex items-center justify-center bg-white/5 border border-white/10">
                              <Icon className="w-2.5 h-2.5 text-white/40" />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Balance Artifact */}
                      <div className="rounded-[18px] p-4 relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.35) 0%, rgba(16,18,46,0.88) 100%)', border: '1px solid rgba(220,38,38,0.40)' }}>
                        <p className="text-[0.58rem] font-600 uppercase tracking-widest mb-1 text-[#F43F5E]">Available Balance</p>
                        <p className="text-[1.45rem] font-extrabold text-white tracking-tight leading-none">₦4,250,220</p>
                        <div className="flex items-center gap-1 mt-1">
                          <ArrowUpRight className="w-3 h-3 text-[#F59E0B]" />
                          <span className="text-[0.58rem] font-600 text-[#F59E0B]">+12.5% this month</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { icon: Send, label: 'Send', color: '#DC2626', bg: 'rgba(220,38,38,0.22)', border: 'rgba(220,38,38,0.40)' },
                          { icon: ArrowDownLeft, label: 'Receive', color: '#F59E0B', bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.35)' },
                          { icon: RefreshCw, label: 'Swap', color: '#F43F5E', bg: 'rgba(244,63,94,0.18)', border: 'rgba(244,63,94,0.35)' },
                        ].map(({ icon: Icon, label, color, bg, border }) => (
                          <button key={label} onClick={() => openModal(`${label} Money`, `${label} feature coming in early access.`)}
                            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-[14px] active:scale-95 transition-transform"
                            style={{ background: bg, border: `1px solid ${border}` }}>
                            <Icon className="w-3.5 h-3.5" style={{ color }} />
                            <span className="text-[0.52rem] font-700 text-white">{label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Recent Activity */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[0.52rem] font-700 text-white/30">
                          <span>Recent activity</span>
                          <span className="text-[#DC2626] cursor-pointer">See all</span>
                        </div>
                        {[
                          { init: 'CO', name: 'Chinedu O.', sub: 'Payment received', amt: '+₦50,000', c: '#DC2626', ac: '#F59E0B' },
                          { init: 'IN', name: 'Freelance Invoice', sub: 'USD payment received', amt: '+$500', c: '#F43F5E', ac: '#DC2626' },
                        ].map((tx, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-[12px] bg-white/5 border border-white/5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[0.58rem] font-bold text-white"
                                style={{ background: `${tx.c}20`, border: `1px solid ${tx.c}30` }}>{tx.init}</div>
                              <div>
                                <p className="text-[0.6rem] font-700 text-white">{tx.name}</p>
                                <p className="text-[0.52rem] text-white/40">{tx.sub}</p>
                              </div>
                            </div>
                            <span className="text-[0.6rem] font-extrabold" style={{ color: tx.ac }}>{tx.amt}</span>
                          </div>
                        ))}
                      </div>

                      {/* Bottom Nav */}
                      <div className="flex items-center justify-between px-2 pt-2 mt-auto border-t border-white/10">
                        {[{I: Home, l: 'Home', a: true},{I: CreditCard, l: 'Cards', a: false},{I: PieChart, l: 'Save', a: false},{I: Grid, l: 'More', a: false}].map(({I, l, a}) => (
                          <div key={l} className="flex flex-col items-center gap-0.5 cursor-pointer"
                            onClick={() => !a && openModal(`PURLEN ${l}`, `${l} coming in early access.`)}>
                            <I className="w-3.5 h-3.5" style={{ color: a ? '#DC2626' : 'rgba(255,255,255,0.3)' }} />
                            <span className="text-[0.48rem] font-600" style={{ color: a ? '#DC2626' : 'rgba(255,255,255,0.3)' }}>{l}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Virtual Card Artifact — Metallic Dark Obsidian & Crimson Gradient */}
              <motion.div className="float-b absolute bottom-4 sm:bottom-8 left-2 sm:left-14 z-30 cursor-pointer"
                onClick={() => openModal('PURLEN Virtual Card', 'Multi-currency virtual Visa cards — coming soon.')}
                whileHover={{ y: -6, scale: 1.02, transition: { duration: 0.2 } }}>
                <div className="artifact-card w-[180px] sm:w-44 h-28 sm:h-32 rounded-[18px] p-4 flex flex-col justify-between overflow-hidden relative"
                  style={{
                    background: 'linear-gradient(135deg, #1A0408 0%, #2D0B12 45%, #DC2626 90%, #F59E0B 100%)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.65), 0 0 35px rgba(220,38,38,0.30), inset 0 1px 0 rgba(255,255,255,0.25)',
                  }}>
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-1.5">
                      <img src="/purlen-icon.png" alt="PURLEN" className="w-4 h-4 object-contain" />
                      <span className="text-[0.6rem] font-extrabold text-white tracking-[0.14em]">PURLEN</span>
                    </div>
                    <Wifi className="w-3 h-3 text-white/80 rotate-90" />
                  </div>
                  <div className="w-8 h-5 rounded relative bg-white/20 border border-white/20 shadow-inner z-10" />
                  <div className="relative z-10">
                    <p className="text-[0.56rem] font-mono tracking-[0.12em] text-white/90">•••• •••• •••• 1121</p>
                    <div className="flex justify-between items-center mt-0.5">
                      <span className="text-[0.52rem] text-white/70 font-500">ADEBAYO O.</span>
                      <span className="text-[0.58rem] font-extrabold text-white">VISA</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Floating Balance Chip Artifact — Dark Glassmorphism */}
              <motion.div className="float-c absolute top-8 right-2 sm:right-10 z-30"
                whileHover={{ scale: 1.05, transition: { duration: 0.15 } }}>
                <div className="w-[200px] sm:w-38 rounded-[18px] px-3.5 py-3 bg-[#08091A]/85 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                  <p className="text-[0.56rem] font-600 uppercase tracking-widest text-[#F43F5E]">USD Balance</p>
                  <p className="text-[1.1rem] font-extrabold text-white mt-0.5">$5,200.00</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse" />
                    <p className="text-[0.52rem] text-white/60">Auto FX active</p>
                  </div>
                </div>
              </motion.div>

            </motion.div>
          </div>
        </div>
      </RealEnvSection>

      {/* ──────────────────────────────────────────
          2. SPEED & INSTANT OFF-RAMP HIGHLIGHT — Running Cheetah under Crimson Southern Lights
          PICTORIAL LANGUAGE: Speed, instant 30-sec settlement.
          Seamlessly blended top & bottom into adjacent sections!
          ────────────────────────────────────────── */}
      <RealEnvSection
        id="speed"
        className="py-20 sm:py-28"
        bgImage="/bg/cheetah_speed.png"
        bgOpacity={0.30}
        auroraIntensity={0.68}
        fadeInTop={true}
        fadeInBottom={true}
      >
        <div className="max-w-5xl mx-auto px-5 sm:px-8 relative z-10">
          <div className="grid md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7 space-y-4">
              <span className="tag tag-dark"><Zap className="w-3.5 h-3.5 text-[#F59E0B]" />Instant Settlement</span>
              <h2 className="text-[2rem] sm:text-[3rem] font-extrabold text-white leading-tight tracking-tight">
                Built for speed.<br />
                <span className="text-[#F43F5E]">30-second bank payouts.</span>
              </h2>
              <p className="text-base text-white/70 leading-relaxed max-w-lg">
                Like a cheetah in full stride, PURLEN settles your local bank withdrawals instantly. Receive international transfers and move funds into your GTBank, Zenith, or Kuda account in under 30 seconds.
              </p>
            </div>
            <div className="md:col-span-5 flex justify-center">
              {/* Receipt Artifact — Glassmorphic Dark Container matching Background */}
              <div className="receipt p-5 space-y-3.5 w-full max-w-xs bg-[#08091A]/90 backdrop-blur-2xl border border-[#DC2626]/40 shadow-[0_24px_60px_rgba(0,0,0,0.7)] text-white">
                <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg, #DC2626, #F59E0B)' }}>
                    <Check className="w-5 h-5 text-white" strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-xs font-700 text-white">Bank Off-Ramp Complete</p>
                    <p className="text-[0.62rem] text-white/50">Settled in 24 seconds</p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/60">GTBank · 0123 ****89</span>
                  <span className="text-lg font-extrabold text-white">₦250,000</span>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <Zap className="w-3.5 h-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                  <span className="text-xs font-700 text-[#F43F5E]">Instant Automated Settlement</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </RealEnvSection>

      {/* ──────────────────────────────────────────
          3. FEATURES — African Rainforest & Canopy under Crimson Southern Lights
          PICTORIAL LANGUAGE: Rich ecosystem, multi-currency features & automated FX.
          Seamlessly blended top & bottom!
          ────────────────────────────────────────── */}
      <RealEnvSection
        id="experience"
        className="py-20 sm:py-28"
        bgImage="/bg/rainforest_canopy.png"
        bgOpacity={0.30}
        auroraIntensity={0.58}
        fadeInTop={true}
        fadeInBottom={true}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 relative z-10">

          <motion.div className="text-center max-w-2xl mx-auto space-y-4 mb-16 sm:mb-20"
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}
            variants={{ ...stagger }}>
            <motion.div variants={fadeUp}><span className="tag tag-dark"><Sparkles className="w-3.5 h-3.5 text-[#DC2626]" />Ecosystem</span></motion.div>
            <motion.h2 variants={fadeUp}
              className="text-[1.9rem] sm:text-[3rem] font-extrabold text-white tracking-tight leading-tight">
              Everything your money needs,<br className="hidden sm:block" /> in one account.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/70 text-base sm:text-lg leading-relaxed">
              Hold, send, receive, and spend across currencies. PURLEN handles the complexity so you don't have to.
            </motion.p>
          </motion.div>

          {/* Bento Grid — Dark Glass Containers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">

            {/* Multi-Currency Virtual Cards */}
            <motion.div className="p-6 sm:p-8 rounded-[28px] lg:col-span-2 flex flex-col justify-between space-y-6 bg-[#08091A]/85 backdrop-blur-xl border border-white/12 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={fadeUp}>
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#DC2626]/15 border border-[#DC2626]/30">
                  <CreditCard className="w-5 h-5 text-[#F43F5E]" strokeWidth={2} />
                </div>
                <h3 className="text-[1.05rem] font-bold text-white">Multi-Currency Virtual Cards</h3>
                <p className="text-sm text-white/70 leading-relaxed max-w-sm">
                  Spend in any currency worldwide. Your virtual Visa auto-converts at point of sale — no manual exchanges, no hidden charges.
                </p>
              </div>

              {/* Card visual artifact */}
              <div className="relative h-40 sm:h-48 rounded-2xl overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #2D0B12 0%, #08091A 65%, #04050E 100%)' }}>
                <div className="absolute inset-0"
                  style={{ background: 'radial-gradient(ellipse at 25% 40%, rgba(220,38,38,0.30) 0%, transparent 60%)' }} />

                <div className="absolute bottom-0 right-0 w-72 h-44 transform translate-x-6 translate-y-3">
                  <div className="absolute right-0 bottom-0 rounded-[18px] p-3.5 flex flex-col justify-between"
                    style={{ background: 'linear-gradient(135deg, #DC2626 0%, #E11D48 52%, #F59E0B 100%)', width: 224, height: 130,
                    boxShadow: '0 16px 40px rgba(220,38,38,0.45)' }}>
                    <div className="relative flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <img src="/purlen-icon.png" alt="PURLEN" className="w-3.5 h-3.5 object-contain" />
                        <span className="text-[0.58rem] font-extrabold text-white tracking-[0.14em]">PURLEN</span>
                      </div>
                      <Wifi className="w-3 h-3 text-white/70 rotate-90" />
                    </div>
                    <div className="relative">
                      <p className="text-[0.55rem] font-mono tracking-[0.10em] text-white/80">•••• •••• •••• 1121</p>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[0.50rem] text-white/60">ADEBAYO O.</span>
                        <span className="text-[0.55rem] font-extrabold text-white">VISA</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute left-5 top-5">
                  <p className="text-[0.58rem] font-700 uppercase tracking-widest text-[#F43F5E]">Subscription charge</p>
                  <p className="text-[1.4rem] font-extrabold text-white mt-0.5">-$14.99</p>
                  <p className="text-[0.55rem] mt-0.5 text-white/50">1 USD = ₦1,520 · No fee</p>
                </div>
              </div>
            </motion.div>

            {/* Save & Earn */}
            <motion.div className="p-6 sm:p-7 rounded-[28px] flex flex-col justify-between space-y-5 bg-[#08091A]/85 backdrop-blur-xl border border-white/12 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={fadeUp} custom={1}>
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#F59E0B]/15 border border-[#F59E0B]/30">
                  <TrendingUp className="w-5 h-5 text-[#F59E0B]" strokeWidth={2} />
                </div>
                <h3 className="text-[1.05rem] font-bold text-white">Save &amp; Earn Yield</h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  Earn competitive daily yield on your balances. No lock-up periods. Withdraw any time.
                </p>
              </div>
              <div className="rounded-2xl p-4 space-y-3 bg-white/5 border border-[#F59E0B]/30">
                <div className="flex justify-between items-center">
                  <span className="text-[0.68rem] font-700 text-[#F59E0B]">Daily Yield Payout</span>
                  <span className="text-[0.68rem] font-extrabold px-2.5 py-1 rounded-full text-white"
                    style={{ background: 'linear-gradient(135deg, #F59E0B, #DC2626)' }}>8.5% APY</span>
                </div>
                <div>
                  <p className="text-[0.6rem] text-white/40">Today's earnings</p>
                  <p className="text-[1.2rem] font-extrabold text-white">+$1.16 <span className="text-sm font-500 text-white/50">/ day</span></p>
                </div>
                <div className="h-1 rounded-full overflow-hidden bg-white/10">
                  <div className="h-full rounded-full w-3/4" style={{ background: 'linear-gradient(to right, #F59E0B, #DC2626)' }} />
                </div>
              </div>
            </motion.div>

            {/* Instant Bank Off-Ramp */}
            <motion.div className="p-6 sm:p-7 rounded-[28px] flex flex-col justify-between space-y-5 bg-[#08091A]/85 backdrop-blur-xl border border-white/12 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={fadeUp} custom={2}>
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#DC2626]/15 border border-[#DC2626]/30">
                  <ArrowDownLeft className="w-5 h-5 text-[#F43F5E]" strokeWidth={2} />
                </div>
                <h3 className="text-[1.05rem] font-bold text-white">Instant Bank Off-Ramp</h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  Receive international payments and withdraw to any local bank account in 30 seconds.
                </p>
              </div>
              <div className="receipt p-4 space-y-2.5 bg-white/5 border border-white/10 rounded-2xl text-white">
                <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.25), rgba(245,158,11,0.25))' }}>
                    <Check className="w-4 h-4 text-[#F43F5E]" strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-[0.72rem] font-700 text-white">Bank Transfer Complete</p>
                    <p className="text-[0.58rem] text-white/40">Settled in 27 seconds</p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[0.62rem] text-white/60">GTBank · 0123 ****89</span>
                  <span className="text-[1rem] font-extrabold text-white">₦250,000</span>
                </div>
              </div>
            </motion.div>

            {/* Business & Payroll */}
            <motion.div className="p-6 sm:p-8 rounded-[28px] lg:col-span-2 flex flex-col justify-between space-y-5 bg-[#08091A]/85 backdrop-blur-xl border border-white/12 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={fadeUp} custom={3}>
              <div className="flex flex-col sm:flex-row gap-4 sm:items-start sm:justify-between">
                <div className="space-y-2.5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#DC2626]/15 border border-[#DC2626]/30">
                    <Building2 className="w-5 h-5 text-[#F43F5E]" strokeWidth={2} />
                  </div>
                  <h3 className="text-[1.05rem] font-bold text-white">Business &amp; Payroll</h3>
                  <p className="text-sm text-white/70 leading-relaxed max-w-sm">
                    Automate cross-border payroll, manage invoices, and operate a global corporate treasury — all from one account.
                  </p>
                </div>
                <span className="shrink-0 self-start text-[0.65rem] font-700 px-3 py-1.5 rounded-full bg-[#DC2626]/15 text-[#F43F5E] border border-[#DC2626]/30">
                  Batch complete
                </span>
              </div>
              <div className="space-y-2">
                {[
                  { name: 'Engineering Team Payroll', sub: 'USD — batch disbursement', amt: '$14,500.00', c: '#F43F5E' },
                  { name: 'Contractor Invoice #INV-2026', sub: 'NGN — direct bank payout', amt: '₦2,800,000.00', c: '#F59E0B' },
                  { name: 'Design Team · 4 members', sub: 'GBP — cross-border payroll', amt: '£6,200.00', c: '#E11D48' },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <div>
                      <p className="text-[0.8rem] font-700 text-white">{row.name}</p>
                      <p className="text-[0.62rem] text-white/40">{row.sub}</p>
                    </div>
                    <span className="text-[0.84rem] font-extrabold" style={{ color: row.c }}>{row.amt}</span>
                  </div>
                ))}
              </div>
            </motion.div>

          </div>
        </div>
      </RealEnvSection>

      {/* ──────────────────────────────────────────
          4. CURRENCIES — African Ocean Horizon under Photographic Crimson Southern Lights
          PICTORIAL LANGUAGE: Cross-border flow & global trade routes.
          Seamlessly blended top & bottom!
          ────────────────────────────────────────── */}
      <RealEnvSection
        id="currencies"
        className="py-20 sm:py-28"
        bgImage="/bg/hero_mountain.png"
        bgOpacity={0.15}
        auroraIntensity={0.62}
        fadeInTop={true}
        fadeInBottom={true}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-14 sm:space-y-20 pb-10">

          <motion.div className="text-center max-w-xl mx-auto space-y-4"
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}
            variants={{ ...stagger }}>
            <motion.div variants={fadeUp}><span className="tag tag-dark"><Globe className="w-3.5 h-3.5 text-[#DC2626]" />Global reach</span></motion.div>
            <motion.h2 variants={fadeUp}
              className="text-[1.9rem] sm:text-[2.9rem] font-extrabold text-white tracking-tight leading-tight">
              Money that moves with you.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-base leading-relaxed text-white/60">
              Hold, send and receive across 18+ currencies without juggling separate accounts.
            </motion.p>
          </motion.div>

          {/* Desktop Orbit */}
          <div className="hidden sm:flex relative w-full max-w-[300px] sm:max-w-[420px] md:max-w-[560px] h-auto sm:h-[420px] md:h-[560px] mx-auto items-center justify-center scale-75 sm:scale-100">

            <div className="absolute w-[240px] h-[240px] rounded-full border border-[#DC2626]/35 shadow-[0_0_32px_rgba(220,38,38,0.15)_inset]" />
            <div className="absolute w-[420px] h-[420px] rounded-full border border-[#F59E0B]/25 shadow-[0_0_40px_rgba(245,158,11,0.10)_inset]" />
            <div className="absolute w-[640px] h-[640px] rounded-full border border-dashed border-white/15" />

            <div className="absolute w-[200px] h-[200px] rounded-full"
              style={{ background: 'radial-gradient(ellipse, rgba(220,38,38,0.38) 0%, transparent 70%)' }} />

            <motion.div initial={{ scale: 0.82, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }} transition={{ duration: 0.5 }}
              className="relative z-20 w-20 h-20 rounded-[20px] flex items-center justify-center cursor-pointer hover:scale-105 transition-transform bg-gradient-to-br from-[#2D0B12] to-[#08091A] border border-[#DC2626]/45 shadow-[0_0_48px_rgba(220,38,38,0.40)]"
              onClick={() => openModal('PURLEN Currency Engine', 'Multi-currency settlement engine.')}>
              <img src="/purlen-icon.png" alt="PURLEN" className="w-12 h-12 object-contain" />
            </motion.div>

            {/* Inner */}
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
              className="absolute w-[240px] h-[240px] rounded-full pointer-events-none z-10">
              {innerOrbit.map((a, i) => {
                const r = 120, rad = (a.angle * Math.PI) / 180;
                return (
                  <div key={i} style={{ position: 'absolute', left: `calc(50% + ${r * Math.cos(rad)}px - 22px)`, top: `calc(50% + ${r * Math.sin(rad)}px - 22px)` }} className="pointer-events-auto">
                    <motion.div animate={{ rotate: -360 }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
                      className="w-11 h-11 rounded-[12px] flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:scale-110 transition-all group bg-[#08091A]/90 border border-[#DC2626]/40 backdrop-blur-md"
                      onClick={() => openModal(`${a.name} Support`, `${a.name} digital dollars supported on PURLEN.`)}>
                      <img src={a.flag} alt={a.name} className="w-5 h-5 rounded-full object-cover" />
                      <span className="text-[0.48rem] font-extrabold group-hover:text-white text-[#F43F5E]">{a.name}</span>
                    </motion.div>
                  </div>
                );
              })}
            </motion.div>

            {/* Middle */}
            <motion.div animate={{ rotate: -360 }} transition={{ duration: 38, repeat: Infinity, ease: 'linear' }}
              className="absolute w-[420px] h-[420px] rounded-full pointer-events-none z-10">
              {middleOrbit.map((a, i) => {
                const r = 210, rad = (a.angle * Math.PI) / 180;
                return (
                  <div key={i} style={{ position: 'absolute', left: `calc(50% + ${r * Math.cos(rad)}px - 22px)`, top: `calc(50% + ${r * Math.sin(rad)}px - 22px)` }} className="pointer-events-auto">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 38, repeat: Infinity, ease: 'linear' }}
                      className="w-11 h-11 rounded-[12px] flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:scale-110 transition-all group bg-[#04050E]/90 border border-[#F59E0B]/30 backdrop-blur-md"
                      onClick={() => openModal(`${a.name} Support`, `${a.name} powered by Particle Network.`)}>
                      <img src={a.flag} alt={a.name} className="w-5 h-5 rounded-full object-cover" />
                      <span className="text-[0.48rem] font-extrabold group-hover:text-white text-white/60">{a.name}</span>
                    </motion.div>
                  </div>
                );
              })}
            </motion.div>

            {/* Outer */}
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 65, repeat: Infinity, ease: 'linear' }}
              className="absolute w-[640px] h-[640px] rounded-full pointer-events-none z-10">
              {outerOrbit.map((a, i) => {
                const r = 320, rad = (a.angle * Math.PI) / 180;
                return (
                  <div key={i} style={{ position: 'absolute', left: `calc(50% + ${r * Math.cos(rad)}px - 20px)`, top: `calc(50% + ${r * Math.sin(rad)}px - 20px)` }} className="pointer-events-auto">
                    <motion.div animate={{ rotate: -360 }} transition={{ duration: 65, repeat: Infinity, ease: 'linear' }}
                      className="w-10 h-10 rounded-[10px] flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:scale-110 transition-all group bg-[#04050E]/85 border border-white/10 backdrop-blur-md"
                      onClick={() => openModal(`${a.name} Account`, `${a.name} (${a.label}) powered by Nuvion.`)}>
                      <img src={a.flag} alt={a.name} className="w-5 h-5 rounded-full object-cover" />
                      <span className="text-[0.46rem] font-extrabold group-hover:text-white text-white/45">{a.name}</span>
                    </motion.div>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </RealEnvSection>

      {/* ──────────────────────────────────────────
          5. BUSINESS — African Cityscape at Night & Photographic Crimson Southern Lights Arc
          PICTORIAL LANGUAGE: Enterprise scale, corporate treasury & payroll.
          Seamlessly blended top & bottom!
          ────────────────────────────────────────── */}
      <RealEnvSection
        id="business"
        className="py-20 sm:py-28"
        bgImage="/bg/african_city.png"
        bgOpacity={0.30}
        auroraIntensity={0.68}
        fadeInTop={true}
        fadeInBottom={true}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">

            {/* Treasury Dashboard Artifact */}
            <motion.div
              initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.65, ease: 'easeOut' }}
              className="rounded-[28px] overflow-hidden bg-[#04050E]/85 backdrop-blur-2xl border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
              <div className="px-5 sm:px-6 py-4 flex items-center justify-between border-b border-white/10">
                <div>
                  <p className="text-[0.8rem] font-700 text-white">Corporate Treasury</p>
                  <p className="text-[0.62rem] text-white/50 mt-0.5">Batch disbursement · 12 recipients</p>
                </div>
                <span className="text-[0.62rem] font-700 px-2.5 py-1 rounded-full bg-[#DC2626]/20 text-[#F43F5E] border border-[#DC2626]/30">Processed</span>
              </div>
              <div className="px-5 sm:px-6 py-4 space-y-2.5">
                {[
                  { n: 'Engineering Team Payroll', s: 'USD — batch disbursement', a: '$14,500.00', c: '#F43F5E' },
                  { n: 'Contractor Invoice #INV-2026', s: 'NGN — direct bank payout', a: '₦2,800,000.00', c: '#F59E0B' },
                  { n: 'Marketing · Q3 Budget', s: 'GBP — international transfer', a: '£4,200.00', c: '#DC2626' },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10">
                    <div>
                      <p className="text-[0.78rem] font-700 text-white">{r.n}</p>
                      <p className="text-[0.60rem] text-white/40">{r.s}</p>
                    </div>
                    <span className="text-[0.82rem] font-extrabold" style={{ color: r.c }}>{r.a}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-white/10">
                  <p className="text-[0.65rem] text-white/40">Total disbursed this month</p>
                  <p className="text-[0.9rem] font-extrabold text-white">$32,400.00</p>
                </div>
              </div>
            </motion.div>

            {/* Copy */}
            <motion.div className="space-y-6 text-center lg:text-left"
              initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.65, ease: 'easeOut', delay: 0.12 }}>
              <span className="tag tag-dark"><Briefcase className="w-3.5 h-3.5 text-[#DC2626]" />For businesses</span>
              <h2 className="text-[1.9rem] sm:text-[2.9rem] font-extrabold text-white tracking-tight leading-tight">
                Built for businesses<br className="hidden sm:block" /> that move.
              </h2>
              <p className="text-base leading-relaxed max-w-[420px] mx-auto lg:mx-0 text-white/70">
                From invoices to payroll, PURLEN gives growing businesses one place to manage money across borders. Pay teams in their local currency, receive client payments, and manage corporate treasury — all from one account.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <button onClick={() => openModal('PURLEN Business', 'Corporate payroll and multi-currency business accounts.')}
                  className="btn-primary">
                  Explore Business <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                </button>
                <button onClick={() => openModal('Talk to Us', 'Business partnerships and inquiries.')} className="btn-ghost-dark">
                  Talk to us
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </RealEnvSection>

      {/* ──────────────────────────────────────────
          6. PARTNERS — Institutional Trust & Compliance
          Seamlessly blended top & bottom!
          ────────────────────────────────────────── */}
      <section id="partners" className="py-16 sm:py-20 bg-[#04050E] relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 relative z-10">
          <motion.p className="text-center text-[0.7rem] font-700 uppercase tracking-widest mb-10 text-white/50"
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={fadeUp}>
            Built on trusted infrastructure
          </motion.p>
          <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5 items-center max-w-3xl mx-auto"
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}>
            {[
              { src: '/partner-particle-clean.png', alt: 'Particle Network', h: 'max-h-6' },
              { src: '/partner-arbitrum-transparent.png', alt: 'Arbitrum', h: 'max-h-7' },
              { src: '/partner-nuvion-transparent.png', alt: 'Nuvion', h: 'max-h-6' },
              { src: '/partner-pods-transparent.png', alt: 'Pods Finance', h: 'max-h-5' },
            ].map((p, i) => (
              <motion.div key={i} variants={fadeUp}
                className="flex items-center justify-center h-16 sm:h-20 rounded-2xl border border-white/10 bg-white/5 hover:border-white/25 transition-all group">
                <img src={p.src} alt={p.alt}
                  className={`${p.h} w-auto object-contain opacity-60 group-hover:opacity-90 transition-opacity invert brightness-200`} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          7. FAQ — Ancient Baobab Tree under Starry Crimson Southern Lights Arc
          PICTORIAL LANGUAGE: Deep clarity, peace of mind & clear answers.
          Seamlessly blended top & bottom!
          ────────────────────────────────────────── */}
      <RealEnvSection
        id="faq"
        className="py-20 sm:py-28"
        bgImage="/bg/baobab_starry.png"
        bgOpacity={0.30}
        auroraIntensity={0.58}
        fadeInTop={true}
        fadeInBottom={true}
      >
        <div className="max-w-3xl mx-auto px-5 sm:px-8 relative z-10 space-y-12 sm:space-y-16">
          <motion.div className="text-center space-y-4"
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}
            variants={{ ...stagger }}>
            <motion.div variants={fadeUp}><span className="tag tag-dark"><HelpCircle className="w-3.5 h-3.5 text-[#DC2626]" />Questions</span></motion.div>
            <motion.h2 variants={fadeUp}
              className="text-[1.9rem] sm:text-[2.9rem] font-extrabold text-white tracking-tight">
              Frequently asked.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/70 text-base leading-relaxed">
              Everything you need to know about PURLEN accounts, bank off-ramps, and global payments.
            </motion.p>
          </motion.div>

          <motion.div className="space-y-2"
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
            {faqs.map((faq, idx) => {
              const open = activeFaq === idx;
              return (
                <motion.div key={idx} variants={fadeUp}
                  className="overflow-hidden rounded-2xl border transition-all duration-200 bg-[#08091A]/80 backdrop-blur-xl text-white"
                  style={{ borderColor: open ? '#DC2626' : 'rgba(255,255,255,0.12)' }}>
                  <button onClick={() => setActiveFaq(open ? null : idx)}
                    className="w-full px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between text-left gap-4 hover:bg-white/5 transition-colors"
                    aria-expanded={open}>
                    <span className="text-[0.88rem] sm:text-[0.96rem] font-700 text-white leading-snug">{faq.q}</span>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
                      style={{
                        background: open ? 'rgba(220,38,38,0.20)' : 'rgba(255,255,255,0.08)',
                        border: `1px solid ${open ? 'rgba(220,38,38,0.40)' : 'rgba(255,255,255,0.15)'}`,
                        color: open ? '#F43F5E' : 'rgba(255,255,255,0.6)',
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}>
                      <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </div>
                  </button>
                  <AnimatePresence>
                    {open && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="px-5 sm:px-6 pb-5 text-sm text-white/70 leading-relaxed border-t border-white/10"
                        style={{ paddingTop: 16 }}>
                        {faq.a}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>

          <motion.div className="card p-6 sm:p-7 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left bg-[#08091A]/85 backdrop-blur-2xl border border-white/15"
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={fadeUp}>
            <div>
              <h4 className="text-[0.92rem] font-700 text-white">Partnerships, Support &amp; Inquiries</h4>
              <p className="text-[0.82rem] text-white/60 mt-1">Have questions, business proposals, or feedback? We'd love to hear from you.</p>
            </div>
            <a href="mailto:igboze@purlen.com" className="btn-primary !text-sm shrink-0">
              <Mail className="w-4 h-4" />igboze@purlen.com
            </a>
          </motion.div>
        </div>
      </RealEnvSection>

      {/* ──────────────────────────────────────────
          8. CTA — Namib Desert Dunes & Photographic Crimson Southern Lights Arc
          PICTORIAL LANGUAGE: Frictionless future & infinite horizon.
          Seamlessly blended top!
          ────────────────────────────────────────── */}
      <RealEnvSection
        className="py-20 sm:py-28"
        bgImage="/bg/desert_dunes.png"
        bgOpacity={0.30}
        auroraIntensity={0.72}
        fadeInTop={true}
        fadeInBottom={false}
      >
        <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center relative z-10">
          <motion.div className="space-y-8"
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}
            variants={{ ...stagger }}>
            <motion.div variants={fadeUp}><span className="tag tag-dark"><Sparkles className="w-3.5 h-3.5 text-[#DC2626]" />Early Access</span></motion.div>
            <motion.h2 variants={fadeUp}
              className="text-[2rem] sm:text-[3.4rem] font-extrabold text-white leading-tight tracking-tight">
              Your next payment should be<br className="hidden sm:block" />
              <span style={{ background: 'linear-gradient(135deg, #F43F5E 0%, #DC2626 50%, #F59E0B 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {' '}your easiest one.
              </span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-base sm:text-lg leading-relaxed max-w-lg mx-auto text-white/60">
              Create your free account and experience a simpler way to move money — across borders, across currencies, without limits.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
              <button onClick={() => openModal('Join Early Access Waitlist', 'Be among the first invited to PURLEN.')}
                className="btn-primary w-full sm:w-auto">
                Get started <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <button onClick={() => openModal('PURLEN Business', 'Explore business account features.')}
                className="btn-ghost-dark w-full sm:w-auto">
                For business
              </button>
            </motion.div>
          </motion.div>
        </div>
      </RealEnvSection>

      {/* ──────────────────────────────────────────
          FOOTER
          ────────────────────────────────────────── */}
      <footer className="py-12 sm:py-16 bg-[#04050E] border-t border-white/10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
            <a href="#" className="flex items-center gap-2.5 group">
              <img src="/purlen-icon.png" alt="PURLEN" className="w-7 h-7 object-contain group-hover:scale-105 transition-transform" />
              <span className="text-lg font-extrabold text-white tracking-[-0.035em]">PURLEN</span>
            </a>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[0.8rem] font-500 text-white/50">
              {[['#experience','Features'],['#currencies','Currencies'],['#business','Business'],['#faq','FAQ']].map(([h,l]) => (
                <a key={h} href={h} className="hover:text-white transition-colors">{l}</a>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <a href="https://x.com/purlen" target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-white/50 hover:text-white"
                title="@purlen">
                <XIcon className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 text-[#8A8FAD]">
            <p className="text-[0.72rem]">
              © 2026 PURLEN Inc. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-[0.72rem]">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <span className="font-700 text-[#DC2626]">purlen.com</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ──────────────────────────────────────────
          WAITLIST MODAL
          ────────────────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 backdrop-blur-md bg-[#04050E]/80" />

            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative w-full sm:max-w-md bg-white rounded-t-[32px] sm:rounded-[28px] p-6 sm:p-8 z-10 space-y-5 max-h-[80vh] overflow-y-auto border border-[#DDE2F0] shadow-2xl">

              <button onClick={() => setIsModalOpen(false)}
                className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-[#EEF0FA] text-[#4E5275] border border-[#DDE2F0]">
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#DC2626]/10 border border-[#DC2626]/20">
                  <Sparkles className="w-4 h-4 text-[#DC2626]" />
                </div>
                <span className="tag tag-light">Early Access Waitlist</span>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl sm:text-[1.35rem] font-extrabold text-[#080B18] tracking-tight">{modalTitle}</h3>
                <p className="text-sm text-[#4E5275] leading-relaxed">{modalSub}</p>
              </div>

              {!isSubmitted ? (
                <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-700 text-[#080B18] flex justify-between">
                      <span>Email Address</span>
                      <span className="font-400 text-[#8A8FAD]">Required</span>
                    </label>
                    <input type="email" required placeholder="name@company.com" value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl text-sm text-[#080B18] transition-all outline-none bg-[#F7F8FC] border border-[#DDE2F0] focus:border-[#DC2626]" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-700 text-[#080B18]">What best describes you?</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { k: 'freelancer' as const, I: Briefcase, l: 'Freelancer', s: 'Remote worker' },
                        { k: 'founder' as const, I: Rocket, l: 'Founder', s: 'Startup lead' },
                        { k: 'sme' as const, I: Store, l: 'SME Owner', s: 'Business' },
                        { k: 'interested' as const, I: UserCheck, l: 'Interested', s: 'Personal use' },
                      ].map(({ k, I, l, s }) => (
                        <button key={k} type="button" onClick={() => setPersona(k)}
                          className="p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all"
                          style={{ background: persona === k ? 'rgba(220,38,38,0.06)' : '#F7F8FC', borderColor: persona === k ? '#DC2626' : '#DDE2F0' }}>
                          <div className="flex items-center gap-1.5">
                            <I className="w-3.5 h-3.5" style={{ color: persona === k ? '#DC2626' : '#8A8FAD' }} />
                            <span className="text-[0.78rem] font-700 text-[#080B18]">{l}</span>
                          </div>
                          <span className="text-[0.64rem] text-[#8A8FAD]">{s}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {submitError && (
                    <p className="text-xs font-700 text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl">{submitError}</p>
                  )}

                  <button type="submit" disabled={isSubmitting} className="btn-primary w-full !py-3.5 disabled:opacity-60">
                    {isSubmitting
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</>
                      : 'Reserve My Early Access Spot'}
                  </button>
                </form>
              ) : (
                <div className="rounded-2xl p-6 text-center space-y-4 bg-[#DC2626]/10 border border-[#DC2626]/20">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                    style={{ background: 'linear-gradient(135deg, #DC2626, #F59E0B)' }}>
                    <Check className="w-6 h-6 text-white" strokeWidth={3} />
                  </div>
                  <h4 className="text-lg font-700 text-[#080B18]">You're on the list.</h4>
                  <p className="text-sm text-[#4E5275] leading-relaxed">
                    We've registered <span className="font-700 text-[#080B18]">{email}</span> for early access. We'll reach out with your private invitation soon.
                  </p>
                  <button onClick={() => setIsModalOpen(false)} className="btn-primary !text-sm" style={{ width: 'auto' }}>
                    Done
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
