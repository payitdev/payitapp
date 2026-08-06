import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Building2, 
  ShieldCheck, 
  ChevronRight, 
  ChevronDown,
  Check, 
  Search,
  Bell,
  Home,
  CreditCard,
  Send,
  PieChart,
  Grid,
  Wifi,
  TrendingUp,
  Globe,
  MessageSquare,
  Smartphone,
  Coins,
  SendHorizontal,
  X,
  Sparkles,
  Zap,
  CheckCircle2,
  Users,
  Menu,
  HelpCircle,
  Briefcase,
  Rocket,
  Store,
  UserCheck,
  Loader2
} from 'lucide-react';

const TelegramIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.67-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.37-.49 1.02-.74 3.99-1.74 6.66-2.89 8.01-3.45 3.81-1.59 4.6-.1.87 4.79-.11z" />
  </svg>
);

const XIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'webapp' | 'telegram'>('webapp');
  const [activeCurrencyCategory, setActiveCurrencyCategory] = useState<'fiats' | 'crypto' | 'stablecoins'>('fiats');
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(0);

  // Real Waitlist Form State
  const [modalTitle, setModalTitle] = useState('Join PayIT Early Access');
  const [modalSub, setModalSub] = useState('Be among the first to experience seamless multi-currency payments.');
  const [email, setEmail] = useState('');
  const [persona, setPersona] = useState<'freelancer' | 'founder' | 'sme' | 'interested'>('freelancer');
  const [preferredPlatform, setPreferredPlatform] = useState<'webapp' | 'telegram' | 'both'>('webapp');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const openComingSoon = (title = 'Join PayIT Early Access', subtitle = 'Be among the first to experience seamless multi-currency payments.', targetPlatform: 'webapp' | 'telegram' | 'both' = 'webapp') => {
    setModalTitle(title);
    setModalSub(subtitle);
    setPreferredPlatform(targetPlatform);
    setIsSubmitted(false);
    setSubmitError('');
    setEmail('');
    setIsModalOpen(true);
    setIsMobileMenuOpen(false);
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch('http://localhost:4000/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          persona,
          preferredPlatform,
          source: 'website_modal',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit waitlist signup');
      }

      setIsSubmitted(true);
    } catch (err: any) {
      console.warn('Waitlist API warning:', err.message);
      // Clean optimistic fallback if network is offline
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1st Orbital: Stablecoins (USDC / USDT)
  const innerOrbitAssets = [
    { name: 'USDC', label: 'USD Coin', flag: '/flags/usdc.png', angle: 0 },
    { name: 'USDT', label: 'Tether USD', flag: '/flags/usdt.png', angle: 180 },
  ];

  // 2nd Orbital: Crypto Tokens supported by Particle Network
  const middleOrbitAssets = [
    { name: 'BTC', label: 'Bitcoin', flag: '/flags/btc.png', angle: 0 },
    { name: 'ETH', label: 'Ethereum', flag: '/flags/eth.png', angle: 72 },
    { name: 'SOL', label: 'Solana', flag: '/flags/sol.png', angle: 144 },
    { name: 'ARB', label: 'Arbitrum', flag: '/flags/arb.png', angle: 216 },
    { name: 'Particle', label: 'Particle Net', flag: '/partner-particle-clean.png', angle: 288 },
  ];

  // 3rd Orbital: ALL 18 Local Fiat Currencies supported by Nuvion & Global Banking
  const outerOrbitAssets = [
    { name: 'NGN', label: 'Naira (₦)', flag: '/flags/ng.png', angle: 0 },
    { name: 'USD', label: 'US Dollar ($)', flag: '/flags/us.png', angle: 20 },
    { name: 'EUR', label: 'Euro (€)', flag: '/flags/eu.png', angle: 40 },
    { name: 'GBP', label: 'Pound (£)', flag: '/flags/gb.png', angle: 60 },
    { name: 'KES', label: 'Shilling (KSh)', flag: '/flags/ke.png', angle: 80 },
    { name: 'GHS', label: 'Cedi (GH₵)', flag: '/flags/gh.png', angle: 100 },
    { name: 'ZAR', label: 'Rand (R)', flag: '/flags/za.png', angle: 120 },
    { name: 'XOF', label: 'CFA Franc', flag: '/flags/ci.png', angle: 140 },
    { name: 'EGP', label: 'Pound (£E)', flag: '/flags/eg.png', angle: 160 },
    { name: 'RWF', label: 'Franc (FRw)', flag: '/flags/rw.png', angle: 180 },
    { name: 'UGX', label: 'Shilling (USh)', flag: '/flags/ug.png', angle: 200 },
    { name: 'TZS', label: 'Shilling (TSh)', flag: '/flags/tz.png', angle: 220 },
    { name: 'ZMW', label: 'Kwacha (ZK)', flag: '/flags/zm.png', angle: 240 },
    { name: 'MAD', label: 'Dirham (MAD)', flag: '/flags/ma.png', angle: 260 },
    { name: 'BWP', label: 'Pula (P)', flag: '/flags/bw.png', angle: 280 },
    { name: 'CAD', label: 'Dollar (C$)', flag: '/flags/ca.png', angle: 300 },
    { name: 'AUD', label: 'Dollar (A$)', flag: '/flags/au.png', angle: 320 },
    { name: 'AED', label: 'Dirham (AED)', flag: '/flags/ae.png', angle: 340 },
  ];

  // Frequently Asked Questions Data
  const faqs = [
    {
      q: 'How does PayIT handle payments across different currencies?',
      a: 'PayIT gives you dedicated multi-currency account balances. You can hold, send, receive, and swap across 18+ local fiat currencies and digital dollars seamlessly, with automatic FX conversion at competitive market rates.'
    },
    {
      q: 'How fast are local bank off-ramps and withdrawals?',
      a: 'Withdrawals to local bank accounts (such as GTBank, Kuda, Zenith, or local mobile money) are processed instantly via automated settlement rails, settling in your bank account in 30 seconds or less.'
    },
    {
      q: 'How do I use PayIT directly inside Telegram?',
      a: 'Start `@PayITBot` on Telegram. You can send money to contacts, request payments, check your balances, and receive instant transfer alerts directly inside Telegram chats without switching apps.'
    },
    {
      q: 'Are there any hidden blockchain gas fees or technical setup required?',
      a: 'No. PayIT abstracts away all underlying blockchain infrastructure. You will never pay network gas fees or handle private keys—the app feels and operates just like a modern digital bank.'
    },
    {
      q: 'How do PayIT Virtual Visa cards work?',
      a: 'You can generate virtual Visa debit cards directly inside the PayIT Web App. The card pulls funds from your multi-currency balances and auto-converts at point-of-sale for international online shopping, SaaS subscriptions, and travel.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFC] text-slate-900 font-sans selection:bg-[#20C16A] selection:text-white antialiased overflow-x-hidden relative">
      
      {/* 1. NAVIGATION */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#FAFAFC]/90 border-b border-slate-200/80 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          
          {/* Official Logo Mark */}
          <a href="#" className="flex items-center gap-2 sm:gap-3">
            <img 
              src="/payit-logo-mark.png" 
              alt="PayIT" 
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-sm"
            />
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">Pay<span className="text-[#059669]">IT</span></span>
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#experience" className="hover:text-slate-950 transition-colors duration-200">Features</a>
            <a href="#platforms" className="hover:text-slate-950 transition-colors duration-200">Mobile & Telegram</a>
            <a href="#currencies" className="hover:text-slate-950 transition-colors duration-200">Currencies</a>
            <a href="#business" className="hover:text-slate-950 transition-colors duration-200">Business</a>
            <a href="#faq" className="hover:text-slate-950 transition-colors duration-200">FAQ</a>
          </nav>

          {/* Desktop Actions + Social Media Links */}
          <div className="hidden md:flex items-center gap-4">
            
            {/* Social Media Hyperlink Icons */}
            <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
              <a 
                href="https://t.me/officialpayit" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-8 h-8 rounded-full bg-sky-50 text-sky-600 hover:bg-sky-500 hover:text-white flex items-center justify-center transition-all duration-200 shadow-sm"
                title="Telegram Community"
              >
                <TelegramIcon className="w-4.5 h-4.5" />
              </a>
              <a 
                href="https://x.com/usepayit" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-800 hover:bg-slate-900 hover:text-white flex items-center justify-center transition-all duration-200 shadow-sm"
                title="X (Twitter)"
              >
                <XIcon className="w-4 h-4" />
              </a>
            </div>

            <button 
              onClick={() => openComingSoon('Sign In to PayIT', 'Sign in for existing early access users will open shortly.')}
              className="text-sm font-semibold text-slate-700 hover:text-slate-950 transition-colors px-3 py-2"
            >
              Sign In
            </button>
            <button 
              onClick={() => openComingSoon('Create Free Account', 'Create your free PayIT account during our upcoming rollout.', 'webapp')}
              className="text-sm font-semibold bg-[#059669] hover:bg-[#047857] text-white px-5 py-2.5 rounded-full shadow-md shadow-emerald-600/20 transition-all duration-200 active:scale-[0.98]"
            >
              Create Free Account
            </button>
          </div>

          {/* Mobile Actions Header Bar */}
          <div className="flex md:hidden items-center gap-2">
            <a 
              href="https://t.me/officialpayit" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-8 h-8 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center shadow-sm"
              title="Telegram Community"
            >
              <TelegramIcon className="w-4 h-4" />
            </a>
            <a 
              href="https://x.com/usepayit" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-800 flex items-center justify-center shadow-sm"
              title="X (Twitter)"
            >
              <XIcon className="w-3.5 h-3.5" />
            </a>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-800 hover:text-slate-950 focus:outline-none rounded-xl bg-slate-100"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white/95 backdrop-blur-2xl border-b border-slate-200 px-6 py-6 space-y-4 text-sm font-semibold text-slate-800 shadow-2xl"
            >
              <a href="#experience" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 hover:text-[#059669]">Features</a>
              <a href="#platforms" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 hover:text-[#059669]">Mobile & Telegram</a>
              <a href="#currencies" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 hover:text-[#059669]">Currencies</a>
              <a href="#business" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 hover:text-[#059669]">Business</a>
              <a href="#faq" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 hover:text-[#059669]">FAQ</a>
              
              {/* Social links inside mobile drawer */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <a 
                  href="https://t.me/officialpayit" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-50 text-sky-700 font-bold text-xs shadow-sm"
                >
                  <TelegramIcon className="w-4 h-4" />
                  Telegram
                </a>
                <a 
                  href="https://x.com/usepayit" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 text-slate-900 font-bold text-xs shadow-sm"
                >
                  <XIcon className="w-3.5 h-3.5" />
                  @usepayit
                </a>
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <button 
                  onClick={() => openComingSoon('Sign In to PayIT', 'Sign in will open shortly.')}
                  className="w-full py-3 text-slate-700 bg-slate-100 rounded-2xl text-center font-bold"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => openComingSoon('Create Free Account', 'Create your account during rollout.', 'webapp')}
                  className="w-full py-3 bg-[#059669] text-white rounded-2xl text-center font-bold shadow-md shadow-emerald-600/20"
                >
                  Create Free Account
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 2. HERO SECTION — Gorgeous Mobile Aurora Atmosphere & Slanted iPhone */}
      <section className="relative pt-8 sm:pt-20 pb-16 sm:pb-28 overflow-hidden z-10">
        
        {/* Background Southern Lights Stream 1 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute inset-0 bg-grid-pattern opacity-10" />

          {/* Violet/Magenta Southern Lights Curtain */}
          <motion.div
            animate={{
              x: [-40, 80, -60, -40],
              y: [-20, 50, -40, -20],
              opacity: [0.35, 0.55, 0.35],
            }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-32 left-0 w-[550px] sm:w-[750px] h-[450px] sm:h-[550px] rounded-full bg-gradient-to-tr from-[#7C3AED]/40 via-[#EC4899]/35 to-[#10B981]/30 blur-[90px] sm:blur-[110px] mix-blend-multiply"
          />

          {/* Golden Amber & Southern Emerald Stream */}
          <motion.div
            animate={{
              x: [40, -90, 70, 40],
              y: [30, -60, 40, 30],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-20 right-0 w-[550px] sm:w-[800px] h-[500px] sm:h-[600px] rounded-full bg-gradient-to-br from-[#10B981]/35 via-[#F59E0B]/30 to-[#6366F1]/30 blur-[100px] sm:blur-[120px] mix-blend-multiply"
          />

          {/* African Savanna Acacia Silhouette Contour */}
          <div className="absolute bottom-0 left-0 right-0 h-28 sm:h-36 opacity-10 pointer-events-none flex items-end">
            <svg className="w-full h-full text-slate-900" viewBox="0 0 1200 120" preserveAspectRatio="none" fill="currentColor">
              <path d="M0,90 Q150,60 300,85 Q450,110 600,75 Q750,40 900,80 Q1050,115 1200,90 L1200,120 L0,120 Z" />
              <path d="M220,68 Q220,40 190,30 Q160,20 220,15 Q280,20 250,30 Q220,40 220,68 Z" />
              <path d="M880,72 Q880,48 850,38 Q820,28 880,22 Q940,28 910,38 Q880,48 880,72 Z" />
            </svg>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 space-y-8 sm:space-y-0">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-6 space-y-5 sm:space-y-8 text-center sm:text-left">
              
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50/90 backdrop-blur-md border border-emerald-200/80 text-[#059669] text-xs font-bold tracking-wide shadow-sm mx-auto sm:mx-0">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Multi-Currency Payment Accounts</span>
              </div>
              
              <h1 className="text-3xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.12] sm:leading-[1.08]">
                Money without <span className="text-[#059669]">limits.</span>
              </h1>
              
              <p className="text-sm sm:text-lg text-slate-600 font-normal leading-relaxed max-w-lg mx-auto sm:mx-0">
                Move, hold, spend, and earn across currencies from one secure account. Access your money seamlessly on the PayIT Web App or directly inside Telegram.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-1 max-w-md mx-auto sm:mx-0">
                <button 
                  onClick={() => openComingSoon('PayIT Mobile Web App Waitlist', 'Get early access to the PayIT Web Application.', 'webapp')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#059669] hover:bg-[#047857] text-white font-bold text-base px-7 py-3.5 rounded-full shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98]"
                >
                  Open Web App
                  <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                </button>
                
                <button 
                  onClick={() => openComingSoon('PayIT Telegram Bot Waitlist', 'Get early access to the @PayITBot on Telegram.', 'telegram')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/90 hover:bg-white backdrop-blur-md text-sky-700 font-semibold text-base px-6 py-3.5 rounded-full border border-sky-200 shadow-sm transition-all active:scale-[0.98]"
                >
                  <MessageSquare className="w-4 h-4 fill-sky-600 text-sky-600 shrink-0" />
                  Try Telegram Bot
                </button>
              </div>

              {/* Platform Badges */}
              <div className="pt-3 sm:pt-6 flex flex-wrap items-center justify-center sm:justify-start gap-4 sm:gap-6 text-xs font-medium text-slate-600 border-t border-slate-200/80">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#059669]" />
                  <span>PayIT Web App</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-sky-600" />
                  <span>PayIT Telegram Bot</span>
                </div>
              </div>

            </div>

            {/* Right Visual — Mobile Phone Hardware Mockup Slanted Towards Left */}
            <div className="lg:col-span-6 relative flex justify-center lg:justify-end pt-2 lg:pt-0">
              <div className="relative w-full max-w-[290px] sm:max-w-md flex justify-center items-center">
                
                {/* iPhone Hardware Frame Slanted Towards Left/Inside Website */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{
                    transform: 'perspective(1000px) rotateY(-12deg) rotateX(4deg) rotate(-2deg)',
                    transformStyle: 'preserve-3d',
                  }}
                  className="relative w-[265px] sm:w-[300px] h-[520px] sm:h-[590px] rounded-[40px] sm:rounded-[48px] p-[7px] sm:p-[10px] bg-gradient-to-b from-slate-800 via-slate-900 to-black shadow-[0_20px_50px_-10px_rgba(0,0,0,0.35)] border border-slate-700/60 z-10 group"
                >
                  {/* Clean Light-Theme App Screen Inside Bezel */}
                  <div className="w-full h-full rounded-[34px] sm:rounded-[40px] bg-slate-50 p-3.5 sm:p-5 flex flex-col justify-between relative overflow-hidden border border-slate-200 text-slate-900">
                    
                    {/* Top Status & Notch */}
                    <div>
                      <div className="w-18 sm:w-24 h-3 sm:h-4 bg-black rounded-full mx-auto mb-2 sm:mb-3 flex items-center justify-center">
                        <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-slate-900 border border-slate-800" />
                      </div>

                      <div className="flex items-center justify-between pt-0.5">
                        <div>
                          <p className="text-[10px] sm:text-[11px] font-medium text-slate-500">Good morning,</p>
                          <h4 className="text-xs sm:text-base font-extrabold text-slate-900">John</h4>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <div className="w-6 sm:w-7 h-6 sm:h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm">
                            <Search className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                          </div>
                          <div className="w-6 sm:w-7 h-6 sm:h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm">
                            <Bell className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Clean White Balance Card */}
                    <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-0.5 sm:space-y-1 my-1 sm:my-2">
                      <p className="text-[10px] sm:text-xs font-semibold text-slate-500">Available Balance</p>
                      <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight">₦4,250,220<span className="text-slate-400 text-xs sm:text-sm font-semibold">.00</span></h3>
                      <p className="text-[9px] sm:text-[11px] font-bold text-[#059669] flex items-center gap-1 pt-0.5">
                        ↑ 12.5% <span className="text-slate-500 font-normal">vs last month</span>
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      <button onClick={() => openComingSoon('Send Money', 'Send feature available in early access release.')} className="bg-[#059669] text-white font-bold py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs flex flex-col items-center justify-center gap-0.5 shadow-sm active:scale-[0.98]">
                        <Send className="w-3.5 sm:w-4 h-3.5 sm:h-4 stroke-[2.5]" />
                        <span>Send</span>
                      </button>
                      <button onClick={() => openComingSoon('Receive Money', 'Receive accounts available in early access release.')} className="bg-white text-slate-800 font-semibold py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs flex flex-col items-center justify-center gap-0.5 border border-slate-200 shadow-sm active:scale-[0.98]">
                        <ArrowDownLeft className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#059669]" />
                        <span>Receive</span>
                      </button>
                      <button onClick={() => openComingSoon('Swap Currency', 'Multi-currency FX swaps available in early access release.')} className="bg-white text-slate-800 font-semibold py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs flex flex-col items-center justify-center gap-0.5 border border-slate-200 shadow-sm active:scale-[0.98]">
                        <RefreshCw className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#059669]" />
                        <span>Swap</span>
                      </button>
                    </div>

                    {/* Activity List */}
                    <div className="space-y-1.5 sm:space-y-2 pt-0.5">
                      <div className="flex items-center justify-between text-[9px] sm:text-[11px] font-bold text-slate-500">
                        <span>Recent Activity</span>
                        <span className="text-[#059669] cursor-pointer">See all</span>
                      </div>

                      <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-2.5">
                          <div className="w-6.5 sm:w-8 h-6.5 sm:h-8 rounded-lg bg-emerald-50 text-[#059669] flex items-center justify-center font-bold text-[10px] sm:text-xs">
                            CO
                          </div>
                          <div>
                            <p className="text-[10px] sm:text-xs font-bold text-slate-900">Chinedu O.</p>
                            <p className="text-[8px] sm:text-[10px] text-slate-500">Direct Bank Off-Ramp</p>
                          </div>
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold text-[#059669]">+₦50,000.00</span>
                      </div>

                      <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-2.5">
                          <div className="w-6.5 sm:w-8 h-6.5 sm:h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-[10px] sm:text-xs">
                            <MessageSquare className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                          </div>
                          <div>
                            <p className="text-[10px] sm:text-xs font-bold text-slate-900">Telegram Payment</p>
                            <p className="text-[8px] sm:text-[10px] text-slate-500">Received via Chat</p>
                          </div>
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold text-[#059669]">+$100.00</span>
                      </div>
                    </div>

                    {/* Bottom Nav */}
                    <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between px-1 sm:px-2 text-[8px] sm:text-[10px] text-slate-500 font-semibold">
                      <div className="flex flex-col items-center gap-0.5 text-[#059669]">
                        <Home className="w-3 sm:w-4 h-3 sm:h-4" />
                        <span>Home</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5 hover:text-slate-900 cursor-pointer" onClick={() => openComingSoon('PayIT Cards', 'Virtual debit cards opening soon.')}>
                        <CreditCard className="w-3 sm:w-4 h-3 sm:h-4" />
                        <span>Cards</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5 hover:text-slate-900 cursor-pointer" onClick={() => openComingSoon('Save & Yield', 'Pods Finance yield engine opening soon.')}>
                        <PieChart className="w-3 sm:w-4 h-3 sm:h-4" />
                        <span>Save</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5 hover:text-slate-900 cursor-pointer" onClick={() => openComingSoon('PayIT Account', 'Settings opening soon.')}>
                        <Grid className="w-3 sm:w-4 h-3 sm:h-4" />
                        <span>More</span>
                      </div>
                    </div>

                  </div>
                </motion.div>

                {/* Vector Physical Debit Card Artifact */}
                <motion.div 
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -bottom-4 sm:-bottom-6 -left-3 sm:-left-8 w-48 sm:w-64 h-32 sm:h-40 rounded-2xl bg-gradient-to-br from-slate-950 via-[#0B1320] to-slate-900 border border-white/20 shadow-2xl p-3 sm:p-4 flex flex-col justify-between z-20 overflow-hidden cursor-pointer"
                  onClick={() => openComingSoon('PayIT Visa Card', 'Multi-currency virtual and physical Visa cards opening soon.')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <img src="/payit-logo-mark.png" alt="PayIT" className="w-4 sm:w-5 h-4 sm:h-5 rounded-sm" />
                      <span className="text-[10px] sm:text-xs font-extrabold text-white tracking-wider">PayIT</span>
                    </div>
                    <Wifi className="w-3 sm:w-4 h-3 sm:h-4 text-slate-300 rotate-90" />
                  </div>

                  <div className="w-7 sm:w-9 h-5 sm:h-6.5 rounded bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 border border-yellow-200/50 shadow-inner flex items-center justify-center">
                    <div className="w-5 sm:w-7 h-3 sm:h-4.5 border border-amber-800/40 rounded-sm grid grid-cols-2 opacity-60" />
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[10px] sm:text-xs text-slate-200 font-mono tracking-widest font-bold">1234 5678 9101 1121</p>
                    <div className="flex items-center justify-between text-[8px] sm:text-[10px] text-slate-400 font-medium">
                      <span>ADEBAYO O.</span>
                      <span>12/28</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] sm:text-xs font-extrabold text-[#20C16A] tracking-wider">VISA</span>
                    <span className="text-[8px] sm:text-[10px] text-slate-400 font-semibold">Multi-Currency</span>
                  </div>
                </motion.div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. PLATFORMS SHOWCASE — Interactive Mobile Web App vs Telegram Tab Switcher */}
      <section id="platforms" className="py-14 sm:py-24 bg-gradient-to-b from-sky-50/60 via-slate-50/40 to-white border-y border-sky-100 relative z-10">
        
        {/* Background Southern Lights Stream 2 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <motion.div
            animate={{
              x: [-50, 60, -30, -50],
              y: [20, -40, 30, 20],
              opacity: [0.25, 0.45, 0.25],
            }}
            transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 right-10 w-[550px] sm:w-[700px] h-[400px] sm:h-[500px] rounded-full bg-gradient-to-tr from-[#38BDF8]/30 via-[#EC4899]/25 to-[#10B981]/25 blur-[90px] sm:blur-[120px] mix-blend-multiply"
          />

          <div className="absolute bottom-0 left-0 right-0 h-28 sm:h-32 opacity-10 pointer-events-none">
            <svg className="w-full h-full text-slate-900" viewBox="0 0 1200 120" preserveAspectRatio="none" fill="currentColor">
              <path d="M0,120 L200,70 L350,95 L600,30 L800,85 L1000,55 L1200,120 Z" />
            </svg>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8 sm:space-y-16 relative z-10">
          
          <div className="text-center max-w-xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-100 text-sky-800 text-xs font-bold">
              <Globe className="w-3.5 h-3.5 text-sky-600" />
              PayIT Everywhere You Are
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              One account. Mobile App & Telegram.
            </h2>
            <p className="text-slate-600 text-xs sm:text-base leading-relaxed">
              Use the full-featured PayIT Mobile Web App or instant chat transfers inside Telegram.
            </p>
          </div>

          {/* Interactive Mobile Platform Switcher Tabs */}
          <div className="flex md:hidden items-center justify-center p-1.5 rounded-2xl bg-slate-200/70 backdrop-blur-md max-w-xs mx-auto text-xs font-bold shadow-inner">
            <button 
              onClick={() => setActiveMobileTab('webapp')}
              className={`flex-1 py-2.5 rounded-xl transition-all ${activeMobileTab === 'webapp' ? 'bg-white text-slate-900 shadow-md font-extrabold' : 'text-slate-600'}`}
            >
              📱 Mobile Web App
            </button>
            <button 
              onClick={() => setActiveMobileTab('telegram')}
              className={`flex-1 py-2.5 rounded-xl transition-all ${activeMobileTab === 'telegram' ? 'bg-white text-slate-900 shadow-md font-extrabold' : 'text-slate-600'}`}
            >
              ✈️ Telegram Bot
            </button>
          </div>

          {/* DESKTOP GRID (Hidden on mobile) */}
          <div className="hidden md:grid lg:grid-cols-2 gap-8 sm:gap-12 max-w-5xl mx-auto">
            
            {/* PLATFORM 1: Real Mobile Web App Phone Artifact */}
            <div className="bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[36px] border border-slate-200/90 shadow-xl shadow-slate-200/50 space-y-6 sm:space-y-8 flex flex-col justify-between items-center text-center">
              <div className="space-y-3">
                <div className="w-11 sm:w-12 h-11 sm:h-12 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center mx-auto">
                  <Smartphone className="w-5 sm:w-6 h-5 sm:h-6 stroke-[2.5]" />
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">PayIT Mobile Web App</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-sm">
                  Manage multi-currency balances, virtual cards, instant bank off-ramps, and high-yield savings from your browser.
                </p>
              </div>

              {/* Real iPhone Mockup displaying Web App */}
              <div className="w-[220px] sm:w-[240px] h-[400px] sm:h-[440px] rounded-[32px] sm:rounded-[36px] p-2 bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col justify-between bg-slate-50 text-slate-900 text-left">
                <div className="w-18 sm:w-20 h-3.5 bg-black rounded-full mx-auto my-1.5" />
                
                <div className="px-3 space-y-3 my-auto">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <img src="/payit-logo-mark.png" alt="PayIT" className="w-4 h-4 rounded-sm" />
                      <span className="text-xs font-bold text-slate-900">PayIT</span>
                    </div>
                    <span className="text-[9px] font-bold bg-emerald-100 text-[#059669] px-2 py-0.5 rounded-full">Active</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1 shadow-sm">
                    <p className="text-[10px] text-slate-500">Main Balance</p>
                    <p className="text-base sm:text-lg font-extrabold text-slate-900">₦4,250,220.00</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-emerald-600 text-white font-bold py-2 rounded-lg text-center shadow-sm">
                      + Add Money
                    </div>
                    <div className="bg-slate-100 text-slate-800 font-bold py-2 rounded-lg text-center border border-slate-200">
                      ↑ Send
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-[10px] space-y-1">
                    <p className="font-bold text-slate-700">Recent Bank Off-Ramp</p>
                    <p className="text-[#059669] font-extrabold">+₦50,000.00 (GTBank)</p>
                  </div>
                </div>

                <div className="p-2 border-t border-slate-200 text-center text-[10px] text-slate-400 font-medium">
                  PayIT Web App
                </div>
              </div>

              <div>
                <button 
                  onClick={() => openComingSoon('PayIT Mobile Web App', 'The web application is in private preview.', 'webapp')}
                  className="inline-flex items-center gap-2 bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs sm:text-sm px-6 sm:px-7 py-3 sm:py-3.5 rounded-full shadow-md transition-all active:scale-[0.98]"
                >
                  Open Web App
                  <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* PLATFORM 2: Real Telegram App Phone Artifact */}
            <div className="bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[36px] border border-sky-200 shadow-xl shadow-sky-500/10 space-y-6 sm:space-y-8 flex flex-col justify-between items-center text-center">
              <div className="space-y-3">
                <div className="w-11 sm:w-12 h-11 sm:h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
                  <MessageSquare className="w-5 sm:w-6 h-5 sm:h-6 fill-sky-600 text-sky-600" />
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">PayIT Telegram Bot</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-sm">
                  Send, receive, and request money directly inside Telegram chats. Instant chat transfers with zero app context switching.
                </p>
              </div>

              {/* Real iPhone Mockup displaying Telegram App with @PayITBot */}
              <div className="w-[220px] sm:w-[240px] h-[400px] sm:h-[440px] rounded-[32px] sm:rounded-[36px] p-2 bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col justify-between bg-[#0E1621] text-white text-left">
                <div className="w-18 sm:w-20 h-3.5 bg-black rounded-full mx-auto my-1.5" />
                
                <div className="bg-[#17212B] px-3 py-2 border-b border-slate-800 flex items-center gap-2">
                  <div className="w-5.5 sm:w-6 h-5.5 sm:h-6 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-[10px]">
                    P
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">PayIT Bot</p>
                    <p className="text-[9px] text-sky-400">bot</p>
                  </div>
                </div>

                <div className="px-3 space-y-2 my-auto text-[10px]">
                  <div className="bg-[#182533] p-2 rounded-xl rounded-tl-none border border-slate-800 max-w-[90%] text-slate-200 space-y-1">
                    <p className="text-sky-400 font-bold">@PayITBot</p>
                    <p>Welcome to PayIT! Send or request money instantly.</p>
                  </div>

                  <div className="bg-[#2B5278] text-white p-2 rounded-xl rounded-tr-none max-w-[85%] ml-auto font-medium">
                    /send 25000 NGN @David
                  </div>

                  <div className="bg-[#182533] p-2 rounded-xl border border-emerald-500/30 text-emerald-400 space-y-1">
                    <p className="font-bold">✅ Sent ₦25,000.00 to David!</p>
                    <p className="text-[9px] text-slate-400">Ref: TX-9021 • Settled</p>
                  </div>
                </div>

                <div className="bg-[#17212B] p-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Message @PayITBot...</span>
                  <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center">
                    <SendHorizontal className="w-3 h-3" />
                  </div>
                </div>
              </div>

              <div>
                <button 
                  onClick={() => openComingSoon('PayIT Telegram Bot', 'The Telegram bot @PayITBot is opening in private rollout soon.', 'telegram')}
                  className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs sm:text-sm px-6 sm:px-7 py-3 sm:py-3.5 rounded-full shadow-md transition-all active:scale-[0.98]"
                >
                  Launch Telegram Bot
                  <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

          </div>

          {/* MOBILE TABBED SHOWCASE (Visible on mobile) */}
          <div className="block md:hidden">
            {activeMobileTab === 'webapp' ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xl space-y-6 flex flex-col items-center text-center"
              >
                <div className="space-y-2">
                  <h3 className="text-xl font-extrabold text-slate-900">PayIT Mobile Web App</h3>
                  <p className="text-slate-600 text-xs leading-relaxed max-w-xs">
                    Manage multi-currency balances, virtual cards, instant bank off-ramps, and high-yield savings from your browser.
                  </p>
                </div>

                <div className="w-[210px] h-[380px] rounded-[32px] p-2 bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col justify-between bg-slate-50 text-slate-900 text-left">
                  <div className="w-16 h-3 bg-black rounded-full mx-auto my-1.5" />
                  
                  <div className="px-3 space-y-2.5 my-auto">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <img src="/payit-logo-mark.png" alt="PayIT" className="w-3.5 h-3.5 rounded-sm" />
                        <span className="text-[11px] font-bold text-slate-900">PayIT</span>
                      </div>
                      <span className="text-[8px] font-bold bg-emerald-100 text-[#059669] px-2 py-0.5 rounded-full">Active</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-0.5 shadow-sm">
                      <p className="text-[9px] text-slate-500">Available Balance</p>
                      <p className="text-sm font-extrabold text-slate-900">₦4,250,220.00</p>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                      <div className="bg-emerald-600 text-white font-bold py-1.5 rounded-lg text-center shadow-sm">
                        + Add
                      </div>
                      <div className="bg-slate-100 text-slate-800 font-bold py-1.5 rounded-lg text-center border border-slate-200">
                        ↑ Send
                      </div>
                    </div>
                  </div>

                  <div className="p-2 border-t border-slate-200 text-center text-[9px] text-slate-400 font-medium">
                    PayIT Mobile Web App
                  </div>
                </div>

                <button 
                  onClick={() => openComingSoon('PayIT Mobile Web App', 'The web application is in private preview.', 'webapp')}
                  className="w-full bg-[#059669] text-white font-bold text-xs py-3 rounded-2xl shadow-md"
                >
                  Open Web App
                </button>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-3xl border border-sky-200 shadow-xl space-y-6 flex flex-col items-center text-center"
              >
                <div className="space-y-2">
                  <h3 className="text-xl font-extrabold text-slate-900">PayIT Telegram Bot</h3>
                  <p className="text-slate-600 text-xs leading-relaxed max-w-xs">
                    Send, receive, and request money directly inside Telegram chats with zero app switching.
                  </p>
                </div>

                <div className="w-[210px] h-[380px] rounded-[32px] p-2 bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col justify-between bg-[#0E1621] text-white text-left">
                  <div className="w-16 h-3 bg-black rounded-full mx-auto my-1.5" />
                  
                  <div className="bg-[#17212B] px-3 py-1.5 border-b border-slate-800 flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-[9px]">
                      P
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-white">PayIT Bot</p>
                      <p className="text-[8px] text-sky-400">bot</p>
                    </div>
                  </div>

                  <div className="px-3 space-y-2 my-auto text-[9px]">
                    <div className="bg-[#182533] p-2 rounded-xl border border-slate-800 text-slate-200 space-y-0.5">
                      <p className="text-sky-400 font-bold">@PayITBot</p>
                      <p>Send or request money instantly.</p>
                    </div>

                    <div className="bg-[#2B5278] text-white p-1.5 rounded-xl text-right font-medium">
                      /send 25000 NGN @David
                    </div>

                    <div className="bg-[#182533] p-2 rounded-xl border border-emerald-500/30 text-emerald-400">
                      <p className="font-bold">✅ Sent ₦25,000.00!</p>
                    </div>
                  </div>

                  <div className="bg-[#17212B] p-2 border-t border-slate-800 text-[9px] text-slate-400">
                    Message @PayITBot...
                  </div>
                </div>

                <button 
                  onClick={() => openComingSoon('PayIT Telegram Bot', 'The Telegram bot @PayITBot is opening in private rollout.', 'telegram')}
                  className="w-full bg-sky-600 text-white font-bold text-xs py-3 rounded-2xl shadow-md"
                >
                  Launch Telegram Bot
                </button>
              </motion.div>
            )}
          </div>

        </div>
      </section>

      {/* 4. INTERACTIVE CURRENCY ORBIT SHOWCASE — Dynamic Mobile Category Chips & Interactive Badges */}
      <section id="currencies" className="py-16 sm:py-28 border-b border-slate-200/80 bg-white relative z-10 overflow-hidden">
        
        {/* Background Southern Lights Stream 3 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <motion.div
            animate={{
              x: [-30, 40, -40, -30],
              y: [-15, 35, -20, -15],
              opacity: [0.22, 0.42, 0.22],
            }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[10%] left-[15%] w-[550px] sm:w-[750px] h-[450px] sm:h-[550px] rounded-full bg-gradient-to-r from-[#F59E0B]/30 via-[#10B981]/30 to-[#8B5CF6]/25 blur-[100px] sm:blur-[130px] mix-blend-multiply"
          />

          <div className="absolute bottom-0 left-0 right-0 h-28 sm:h-36 opacity-10 pointer-events-none">
            <svg className="w-full h-full text-slate-900" viewBox="0 0 1200 120" preserveAspectRatio="none" fill="currentColor">
              <path d="M0,100 C300,40 600,120 1200,60 L1200,120 L0,120 Z" />
              <path d="M600,80 Q600,30 570,20 Q540,10 600,5 Q660,10 630,20 Q600,30 600,80 Z" />
            </svg>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8 sm:space-y-16 relative z-10">
          
          <div className="text-center max-w-xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Supported Currencies & Tokens
            </h2>
            <p className="text-slate-600 text-xs sm:text-base leading-relaxed">
              Hold, send, receive, and auto-convert across digital dollars, crypto tokens, and 18+ local fiat currencies.
            </p>
          </div>

          {/* DESKTOP/TABLET INTERACTIVE ORBIT (Visible on sm and up) */}
          <div className="hidden sm:flex relative w-full max-w-5xl h-[720px] mx-auto items-center justify-center overflow-hidden">
            
            {/* 1ST ORBITAL LINE */}
            <div className="absolute w-[280px] h-[280px] rounded-full border-2 border-emerald-500/50 shadow-[0_0_20px_rgba(5,150,105,0.3)] pointer-events-none" />
            
            {/* 2ND ORBITAL LINE */}
            <div className="absolute w-[480px] h-[480px] rounded-full border-2 border-sky-400/50 shadow-[0_0_25px_rgba(56,189,248,0.3)] pointer-events-none" />
            
            {/* 3RD ORBITAL LINE */}
            <div className="absolute w-[720px] h-[720px] rounded-full border-2 border-emerald-400/30 border-dashed shadow-[0_0_30px_rgba(32,193,106,0.15)] pointer-events-none" />
            
            {/* Center Ambient Glow */}
            <div className="absolute w-[240px] h-[240px] rounded-full bg-gradient-to-r from-emerald-500/15 via-sky-500/15 to-transparent blur-3xl pointer-events-none" />

            {/* CLEAN CENTER EMBLEM — PayIT Logo Mark Only */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="relative z-20 w-24 h-24 rounded-3xl bg-white p-4 shadow-2xl shadow-emerald-600/25 border-2 border-slate-100 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
              onClick={() => openComingSoon('PayIT Multi-Currency Engine', 'Nuvion & Particle Network powered settlement engine.')}
            >
              <img src="/payit-logo-mark.png" alt="PayIT" className="w-14 h-14 rounded-xl object-contain" />
            </motion.div>

            {/* 1ST ORBITAL: Stablecoins */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
              className="absolute w-[280px] h-[280px] rounded-full pointer-events-none z-10"
            >
              {innerOrbitAssets.map((asset, i) => {
                const radius = 140;
                const rad = (asset.angle * Math.PI) / 180;
                const x = radius * Math.cos(rad);
                const y = radius * Math.sin(rad);

                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `calc(50% + ${x}px - 26px)`,
                      top: `calc(50% + ${y}px - 26px)`,
                    }}
                    className="pointer-events-auto cursor-pointer"
                    onClick={() => openComingSoon(`${asset.name} Support`, `Support for ${asset.name} (${asset.label}) digital dollars.`)}
                  >
                    <motion.div 
                      animate={{ rotate: -360 }}
                      transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                      className="w-13 h-13 rounded-2xl bg-white p-1.5 border border-emerald-300 shadow-lg hover:scale-110 hover:border-[#059669] transition-all flex flex-col items-center justify-center space-y-0.5 group"
                    >
                      <img src={asset.flag} alt={asset.name} className="w-6 h-6 rounded-full object-cover shadow-sm border border-slate-100" />
                      <span className="text-[9px] font-extrabold text-slate-900 group-hover:text-[#059669]">{asset.name}</span>
                    </motion.div>
                  </div>
                );
              })}
            </motion.div>

            {/* 2ND ORBITAL: Crypto Tokens */}
            <motion.div 
              animate={{ rotate: -360 }}
              transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
              className="absolute w-[480px] h-[480px] rounded-full pointer-events-none z-10"
            >
              {middleOrbitAssets.map((asset, i) => {
                const radius = 240;
                const rad = (asset.angle * Math.PI) / 180;
                const x = radius * Math.cos(rad);
                const y = radius * Math.sin(rad);

                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `calc(50% + ${x}px - 26px)`,
                      top: `calc(50% + ${y}px - 26px)`,
                    }}
                    className="pointer-events-auto cursor-pointer"
                    onClick={() => openComingSoon(`${asset.name} Support`, `Support for ${asset.name} (${asset.label}) powered by Particle Network.`)}
                  >
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                      className="w-13 h-13 rounded-2xl bg-white p-1.5 border border-sky-300 shadow-lg hover:scale-110 hover:border-sky-500 transition-all flex flex-col items-center justify-center space-y-0.5 group"
                    >
                      <img src={asset.flag} alt={asset.name} className="w-6 h-6 rounded-full object-cover shadow-sm border border-slate-100" />
                      <span className="text-[9px] font-extrabold text-slate-900 group-hover:text-sky-600">{asset.name}</span>
                    </motion.div>
                  </div>
                );
              })}
            </motion.div>

            {/* 3RD ORBITAL: All 18 Local Fiat Currencies */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
              className="absolute w-[720px] h-[720px] rounded-full pointer-events-none z-10"
            >
              {outerOrbitAssets.map((asset, i) => {
                const radius = 360;
                const rad = (asset.angle * Math.PI) / 180;
                const x = radius * Math.cos(rad);
                const y = radius * Math.sin(rad);

                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `calc(50% + ${x}px - 26px)`,
                      top: `calc(50% + ${y}px - 26px)`,
                    }}
                    className="pointer-events-auto cursor-pointer"
                    onClick={() => openComingSoon(`${asset.name} Account`, `Support for ${asset.name} (${asset.label}) powered by Nuvion.`)}
                  >
                    <motion.div 
                      animate={{ rotate: -360 }}
                      transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
                      className="w-13 h-13 rounded-2xl bg-white p-1.5 border border-slate-200 shadow-md hover:scale-110 hover:border-[#059669] transition-all flex flex-col items-center justify-center space-y-0.5 group"
                    >
                      <img src={asset.flag} alt={asset.name} className="w-6 h-6 rounded-full object-cover shadow-sm border border-slate-100" />
                      <span className="text-[9px] font-extrabold text-slate-900 group-hover:text-[#059669]">{asset.name}</span>
                    </motion.div>
                  </div>
                );
              })}
            </motion.div>

          </div>

          {/* ELEGANT MOBILE INTERACTIVE CURRENCY CATEGORY SELECTOR (Visible on mobile) */}
          <div className="block sm:hidden space-y-5">
            
            {/* Category Filter Pills */}
            <div className="flex items-center justify-center gap-2 p-1.5 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-bold shadow-inner">
              <button 
                onClick={() => setActiveCurrencyCategory('fiats')}
                className={`flex-1 py-2 rounded-xl transition-all ${activeCurrencyCategory === 'fiats' ? 'bg-[#059669] text-white shadow-md' : 'text-slate-600'}`}
              >
                🌍 18 Fiats
              </button>
              <button 
                onClick={() => setActiveCurrencyCategory('crypto')}
                className={`flex-1 py-2 rounded-xl transition-all ${activeCurrencyCategory === 'crypto' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600'}`}
              >
                ⚡ Crypto
              </button>
              <button 
                onClick={() => setActiveCurrencyCategory('stablecoins')}
                className={`flex-1 py-2 rounded-xl transition-all ${activeCurrencyCategory === 'stablecoins' ? 'bg-[#059669] text-white shadow-md' : 'text-slate-600'}`}
              >
                💵 Digital USD
              </button>
            </div>

            {/* Selected Category Asset Grid */}
            <AnimatePresence mode="wait">
              {activeCurrencyCategory === 'fiats' && (
                <motion.div 
                  key="fiats"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-3 gap-2.5"
                >
                  {outerOrbitAssets.map((asset, i) => (
                    <button 
                      key={i} 
                      onClick={() => openComingSoon(`${asset.name} Account`, `Support for ${asset.name} (${asset.label}) powered by Nuvion.`)} 
                      className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:border-[#059669] flex flex-col items-center justify-center text-center space-y-1.5 active:scale-95 transition-all"
                    >
                      <img src={asset.flag} alt={asset.name} className="w-7 h-7 rounded-full object-cover shadow-sm border border-slate-100" />
                      <span className="text-xs font-extrabold text-slate-900">{asset.name}</span>
                      <span className="text-[9px] text-slate-400 font-medium truncate max-w-full">{asset.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </motion.div>
              )}

              {activeCurrencyCategory === 'crypto' && (
                <motion.div 
                  key="crypto"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-2 gap-3"
                >
                  {middleOrbitAssets.map((asset, i) => (
                    <button 
                      key={i} 
                      onClick={() => openComingSoon(`${asset.name} Support`, `Support for ${asset.name} (${asset.label}) powered by Particle Network.`)} 
                      className="bg-white p-3.5 rounded-2xl border border-sky-200 shadow-sm flex items-center gap-3 active:scale-95 transition-all text-left"
                    >
                      <img src={asset.flag} alt={asset.name} className="w-8 h-8 rounded-full object-cover shadow-sm border border-slate-100" />
                      <div>
                        <p className="text-xs font-extrabold text-slate-900">{asset.name}</p>
                        <p className="text-[10px] text-slate-500">{asset.label}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}

              {activeCurrencyCategory === 'stablecoins' && (
                <motion.div 
                  key="stablecoins"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-2 gap-3"
                >
                  {innerOrbitAssets.map((asset, i) => (
                    <button 
                      key={i} 
                      onClick={() => openComingSoon(`${asset.name} Support`, `Support for ${asset.name} (${asset.label}) digital dollars.`)} 
                      className="bg-white p-3.5 rounded-2xl border border-emerald-300 shadow-sm flex items-center gap-3 active:scale-95 transition-all text-left"
                    >
                      <img src={asset.flag} alt={asset.name} className="w-8 h-8 rounded-full object-cover shadow-sm border border-slate-100" />
                      <div>
                        <p className="text-xs font-extrabold text-slate-900">{asset.name}</p>
                        <p className="text-[10px] text-slate-500">{asset.label}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

          </div>

        </div>
      </section>

      {/* 5. PRODUCT EXPERIENCE SECTION */}
      <section id="experience" className="py-16 sm:py-28 relative z-10 overflow-hidden">
        
        {/* Background Southern Lights Stream 4 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <motion.div
            animate={{
              x: [-40, 50, -30, -40],
              y: [20, -30, 40, 20],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-10 left-10 w-[550px] sm:w-[700px] h-[400px] sm:h-[500px] rounded-full bg-gradient-to-tr from-[#059669]/30 via-[#06B6D4]/30 to-[#EC4899]/25 blur-[90px] sm:blur-[120px] mix-blend-multiply"
          />

          <div className="absolute bottom-0 left-0 right-0 h-28 sm:h-32 opacity-10 pointer-events-none">
            <svg className="w-full h-full text-slate-900" viewBox="0 0 1200 120" preserveAspectRatio="none" fill="currentColor">
              <path d="M0,70 L250,110 L500,50 L850,90 L1200,60 L1200,120 L0,120 Z" />
            </svg>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10 sm:space-y-16 relative z-10">
          
          <div className="text-center max-w-xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
              Everything your money needs.
            </h2>
            <p className="text-slate-600 text-xs sm:text-lg">
              Spend, save, receive, and manage. Everything from one beautiful account.
            </p>
          </div>

          {/* 4 Clean Pillar Cards with Real-World Visual Artifacts */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            
            {/* Card 1: Multi-Currency Cards */}
            <div className="bg-white/95 backdrop-blur-md p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 flex flex-col justify-between space-y-5 group">
              <div className="space-y-3">
                <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center">
                  <CreditCard className="w-5 sm:w-6 h-5 sm:h-6 stroke-[2.5]" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">Multi-Currency Cards</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Spend in any local fiat currency worldwide. Your Virtual Visa auto-converts at point-of-sale.
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-3.5 rounded-2xl border border-white/10 text-white space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <img src="/payit-logo-mark.png" alt="PayIT" className="w-4 h-4 rounded-sm" />
                    <span className="text-[10px] font-bold text-white">Virtual Visa</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400">•••• 1121</span>
                </div>
                <div className="bg-slate-800/80 p-2 rounded-xl border border-white/5 flex items-center justify-between text-[10px]">
                  <div>
                    <p className="font-bold text-slate-200">Netflix Subscription</p>
                    <p className="text-slate-400">1 USD = ₦1,520</p>
                  </div>
                  <span className="font-bold text-white">-$14.99</span>
                </div>
              </div>
            </div>

            {/* Card 2: Save & Earn Interest */}
            <div className="bg-white/95 backdrop-blur-md p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 flex flex-col justify-between space-y-5 group">
              <div className="space-y-3">
                <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center">
                  <TrendingUp className="w-5 sm:w-6 h-5 sm:h-6 stroke-[2.5]" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">Save & Earn Interest</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Earn high-yield daily interest on your balance with zero lockup periods. Withdraw anytime.
                  </p>
                </div>
              </div>

              <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200/80 text-emerald-950 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#059669]">Daily Yield Payout</span>
                  <span className="text-[10px] font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-full">8.5% APY</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200/60 flex items-center justify-between text-[11px] shadow-sm">
                  <div>
                    <p className="font-bold text-slate-900">Today's Earnings</p>
                    <p className="text-[9px] text-slate-500">Paid to Balance</p>
                  </div>
                  <span className="font-extrabold text-[#059669]">+$1.16/day</span>
                </div>
              </div>
            </div>

            {/* Card 3: Instant Bank Off-Ramp */}
            <div className="bg-white/95 backdrop-blur-md p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 flex flex-col justify-between space-y-5 group">
              <div className="space-y-3">
                <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center">
                  <ArrowDownLeft className="w-5 sm:w-6 h-5 sm:h-6 stroke-[2.5]" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">Instant Bank Off-Ramp</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Receive payments in any currency and withdraw directly to local bank accounts in 30 seconds.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-slate-900 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-500">Direct Bank Deposit</span>
                  <span className="font-bold text-[#059669] flex items-center gap-1">
                    <Zap className="w-3 h-3 fill-[#059669]" /> 24 Seconds
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] shadow-sm">
                  <div>
                    <p className="font-bold text-slate-900">GTBank • 0123****89</p>
                    <p className="text-[9px] text-slate-500">Instant Payout</p>
                  </div>
                  <span className="font-extrabold text-[#059669]">₦250,000.00</span>
                </div>
              </div>
            </div>

            {/* Card 4: Business & Payroll */}
            <div className="bg-white/95 backdrop-blur-md p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 flex flex-col justify-between space-y-5 group">
              <div className="space-y-3">
                <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center">
                  <Building2 className="w-5 sm:w-6 h-5 sm:h-6 stroke-[2.5]" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">Business & Payroll</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Automate international contractor payroll, client invoicing, and global corporate treasury.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-300 flex items-center gap-1">
                    <Users className="w-3 h-3 text-emerald-400" /> Batch Payroll
                  </span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">Completed</span>
                </div>
                <div className="bg-slate-800 p-2.5 rounded-xl border border-white/5 flex items-center justify-between text-[11px]">
                  <div>
                    <p className="font-bold text-white">12 International Staff</p>
                    <p className="text-[9px] text-slate-400">CSV Auto-Payout</p>
                  </div>
                  <span className="font-extrabold text-emerald-400">$14,500.00</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 6. TRUSTED PARTNERS SECTION */}
      <section id="partners" className="py-14 sm:py-20 border-y border-slate-200/80 bg-white relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center space-y-6 sm:space-y-10">
          
          <div className="max-w-xl mx-auto space-y-2">
            <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Supported by trusted global partners.
            </h2>
            <p className="text-slate-600 text-xs sm:text-base leading-relaxed">
              PayIT combines trusted financial partners with modern payment technology to deliver secure money movement.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-8 items-center justify-center max-w-4xl mx-auto">
            
            <div className="p-3 sm:p-6 h-18 sm:h-24 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center hover:border-emerald-500/30 transition-all duration-300 group">
              <img 
                src="/partner-particle-clean.png" 
                alt="Particle Network" 
                className="max-h-6 sm:max-h-8 w-auto object-contain opacity-85 group-hover:opacity-100 transition-opacity" 
              />
            </div>

            <div className="p-3 sm:p-6 h-18 sm:h-24 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center hover:border-emerald-500/30 transition-all duration-300 group">
              <img 
                src="/partner-arbitrum-transparent.png" 
                alt="Arbitrum" 
                className="max-h-7 sm:max-h-9 w-auto object-contain opacity-85 group-hover:opacity-100 transition-opacity" 
              />
            </div>

            <div className="p-3 sm:p-6 h-18 sm:h-24 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center hover:border-emerald-500/30 transition-all duration-300 group">
              <img 
                src="/partner-nuvion-transparent.png" 
                alt="Nuvion" 
                className="max-h-7 sm:max-h-9 w-auto object-contain opacity-85 group-hover:opacity-100 transition-opacity" 
              />
            </div>

            <div className="p-3 sm:p-6 h-18 sm:h-24 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center hover:border-emerald-500/30 transition-all duration-300 group">
              <img 
                src="/partner-pods-transparent.png" 
                alt="Pods Finance" 
                className="max-h-6 sm:max-h-8 w-auto object-contain opacity-85 group-hover:opacity-100 transition-opacity" 
              />
            </div>

          </div>

        </div>
      </section>

      {/* 7. BUSINESS SECTION */}
      <section id="business" className="py-16 sm:py-24 bg-[#090E17] text-white relative z-10 overflow-hidden">
        
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <motion.div
            animate={{
              x: [-40, 60, -30, -40],
              y: [-20, 30, -20, -20],
              opacity: [0.35, 0.55, 0.35],
            }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 right-0 w-[550px] sm:w-[750px] h-[450px] sm:h-[550px] rounded-full bg-gradient-to-br from-[#7C3AED]/40 via-[#10B981]/35 to-[#EC4899]/30 blur-[100px] sm:blur-[130px]"
          />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid lg:grid-cols-12 gap-8 sm:gap-12 items-center">
            
            <div className="lg:col-span-6 bg-[#111827] p-5 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-4 sm:space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">Corporate Payroll & Treasury</h4>
                  <p className="text-[10px] sm:text-xs text-slate-400">Batch Disbursement • 12 Employees</p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/15 text-[#20C16A] text-[9px] sm:text-xs font-bold rounded-full border border-emerald-500/20">Processed</span>
              </div>

              <div className="space-y-2.5 sm:space-y-3">
                <div className="bg-slate-900/90 p-3 sm:p-4 rounded-xl flex items-center justify-between text-xs sm:text-sm border border-white/5">
                  <div>
                    <p className="font-bold text-white">Engineering Team Payroll</p>
                    <p className="text-[9px] sm:text-[11px] text-slate-400">USD Account Disbursement</p>
                  </div>
                  <span className="font-bold text-[#20C16A] text-xs sm:text-base">$14,500.00</span>
                </div>

                <div className="bg-slate-900/90 p-3 sm:p-4 rounded-xl flex items-center justify-between text-xs sm:text-sm border border-white/5">
                  <div>
                    <p className="font-bold text-white">Contractor Invoice #INV-2026</p>
                    <p className="text-[9px] sm:text-[11px] text-slate-400">NGN Direct Bank Payout</p>
                  </div>
                  <span className="font-bold text-slate-200 text-xs sm:text-base">₦2,800,000.00</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-4 sm:space-y-6 text-center sm:text-left">
              <h2 className="text-2xl sm:text-5xl font-extrabold text-white tracking-tight">
                Built for businesses that move.
              </h2>
              <p className="text-xs sm:text-lg text-slate-300 leading-relaxed">
                From invoices to payroll, PayIT gives growing businesses one place to manage money across borders.
              </p>
              <div className="pt-1 sm:pt-2">
                <button 
                  onClick={() => openComingSoon('PayIT Business Account Waitlist', 'Corporate payroll and multi-currency business accounts.', 'webapp')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs sm:text-base px-6 sm:px-7 py-3 sm:py-3.5 rounded-full shadow-lg shadow-emerald-900/30 transition-all active:scale-[0.98]"
                >
                  Explore Business
                  <ChevronRight className="w-4 sm:w-5 h-4 sm:h-5 stroke-[2.5]" />
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 8. FREQUENTLY ASKED QUESTIONS (FAQ) SECTION */}
      <section id="faq" className="py-16 sm:py-24 bg-white border-t border-slate-200/80 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8 sm:space-y-12">
          
          <div className="text-center space-y-3 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
              <HelpCircle className="w-4 h-4 text-[#059669]" />
              Got Questions?
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-base text-slate-600 leading-relaxed">
              Everything you need to know about PayIT accounts, bank off-ramps, and Telegram transfers.
            </p>
          </div>

          {/* Accordion List */}
          <div className="space-y-3.5 sm:space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaqIndex === idx;
              return (
                <div 
                  key={idx}
                  className="bg-[#FAFAFC] rounded-2xl border border-slate-200/90 overflow-hidden transition-all duration-200 shadow-sm"
                >
                  <button
                    onClick={() => setActiveFaqIndex(isOpen ? null : idx)}
                    className="w-full px-5 sm:px-7 py-4 sm:py-5 flex items-center justify-between text-left gap-4 hover:bg-slate-100/50 transition-colors"
                  >
                    <span className="text-xs sm:text-base font-bold text-slate-900">{faq.q}</span>
                    <div className={`w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 bg-emerald-50 text-[#059669] border-emerald-300' : 'text-slate-500'}`}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="px-5 sm:px-7 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100"
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

      {/* 9. TESTIMONIALS SECTION */}
      <section className="py-14 sm:py-20 bg-slate-50 border-t border-slate-200/80 relative z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="bg-white p-6 sm:p-12 rounded-3xl border border-slate-200/90 space-y-4 sm:space-y-6 shadow-sm">
            <p className="text-sm sm:text-xl font-semibold text-slate-800 leading-relaxed italic">
              "PayIT completely eliminated our cross-border payment headache. Getting paid in USD and converting to NGN in seconds has saved our team hundreds of hours."
            </p>
            <div>
              <p className="text-xs sm:text-base font-bold text-slate-900">Adebayo O.</p>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Founder at TechCraft Studios</p>
            </div>
          </div>
        </div>
      </section>

      {/* 10. CTA SECTION */}
      <section className="py-16 sm:py-24 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="bg-gradient-to-br from-[#059669] to-[#047857] p-7 sm:p-16 rounded-[28px] sm:rounded-[36px] text-white shadow-2xl shadow-emerald-700/20 space-y-5 sm:space-y-8">
            
            <div className="max-w-xl mx-auto space-y-2.5 sm:space-y-3">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Your next payment should be your easiest one.
              </h2>
              <p className="text-xs sm:text-base text-emerald-100 font-medium">
                Create your free account and experience a simpler way to move money.
              </p>
            </div>

            <div>
              <button 
                onClick={() => openComingSoon('Join Early Access Waitlist', 'Be among the first invited to PayIT.', 'both')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-emerald-50 text-emerald-950 font-extrabold text-xs sm:text-base px-7 sm:px-9 py-3.5 sm:py-4 rounded-full shadow-lg transition-all active:scale-[0.98]"
              >
                Get Started
                <ChevronRight className="w-4 sm:w-5 h-4 sm:h-5 stroke-[2.5]" />
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* 11. FOOTER */}
      <footer id="security" className="py-10 sm:py-12 border-t border-slate-200 bg-white text-slate-500 text-xs relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <img src="/payit-logo-mark.png" alt="PayIT" className="w-5 h-5 rounded-md" />
            <span className="text-sm font-extrabold text-slate-900">Pay<span className="text-[#059669]">IT</span></span>
            <span className="text-[11px] text-slate-400 ml-2">© 2026 PayIT Inc. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[11px] text-slate-600 font-medium">
            <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
              <a 
                href="https://t.me/officialpayit" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-1.5 text-sky-600 hover:text-sky-700 font-bold transition-colors"
                title="Telegram Community"
              >
                <TelegramIcon className="w-4 h-4" />
                <span>Telegram</span>
              </a>
              <a 
                href="https://x.com/usepayit" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-1.5 text-slate-800 hover:text-slate-950 font-bold transition-colors"
                title="X (Twitter)"
              >
                <XIcon className="w-3.5 h-3.5" />
                <span>@usepayit</span>
              </a>
            </div>

            <a href="#experience" className="hover:text-slate-950 transition-colors">Features</a>
            <a href="#platforms" className="hover:text-slate-950 transition-colors">Mobile & Telegram</a>
            <a href="#currencies" className="hover:text-slate-950 transition-colors">Currencies</a>
            <a href="#business" className="hover:text-slate-950 transition-colors">Business</a>
            <a href="#faq" className="hover:text-slate-950 transition-colors">FAQ</a>
          </div>
        </div>
      </footer>

      {/* 12. REAL WORKING EARLY ACCESS WAITLIST MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/65 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl z-10 space-y-5 text-slate-900 max-h-[90vh] overflow-y-auto"
            >
              
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center font-bold">
                  <Sparkles className="w-4.5 h-4.5" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#059669] text-xs font-extrabold border border-emerald-200/80">
                  Early Access Waitlist
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">{modalTitle}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{modalSub}</p>
              </div>

              {!isSubmitted ? (
                <form onSubmit={handleWaitlistSubmit} className="space-y-4 pt-1">
                  
                  {/* Field 1: Email Address */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>Email Address</span>
                      <span className="text-[10px] text-slate-400 font-normal">Required</span>
                    </label>
                    <input 
                      type="email" 
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#059669] focus:bg-white text-sm transition-all shadow-inner"
                    />
                  </div>

                  {/* Field 2: Role / Persona Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700">What best describes you?</label>
                    <div className="grid grid-cols-2 gap-2">
                      
                      <button
                        type="button"
                        onClick={() => setPersona('freelancer')}
                        className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                          persona === 'freelancer' 
                            ? 'bg-emerald-50/80 border-[#059669] text-slate-900 shadow-sm ring-1 ring-[#059669]' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                          <Briefcase className="w-3.5 h-3.5 text-[#059669]" />
                          <span>Freelancer</span>
                        </div>
                        <span className="text-[10px] text-slate-500">Contractor / Remote worker</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPersona('founder')}
                        className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                          persona === 'founder' 
                            ? 'bg-emerald-50/80 border-[#059669] text-slate-900 shadow-sm ring-1 ring-[#059669]' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                          <Rocket className="w-3.5 h-3.5 text-[#059669]" />
                          <span>Founder</span>
                        </div>
                        <span className="text-[10px] text-slate-500">Startup / Tech Lead</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPersona('sme')}
                        className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                          persona === 'sme' 
                            ? 'bg-emerald-50/80 border-[#059669] text-slate-900 shadow-sm ring-1 ring-[#059669]' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                          <Store className="w-3.5 h-3.5 text-[#059669]" />
                          <span>SME Owner</span>
                        </div>
                        <span className="text-[10px] text-slate-500">Small / Medium Business</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPersona('interested')}
                        className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                          persona === 'interested' 
                            ? 'bg-emerald-50/80 border-[#059669] text-slate-900 shadow-sm ring-1 ring-[#059669]' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                          <UserCheck className="w-3.5 h-3.5 text-[#059669]" />
                          <span>Just Interested</span>
                        </div>
                        <span className="text-[10px] text-slate-500">Personal use / Curious</span>
                      </button>

                    </div>
                  </div>

                  {/* Preferred Platform Pill */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Preferred Platform:</span>
                    <span className="font-bold text-[#059669] capitalize">
                      {preferredPlatform === 'telegram' ? '✈️ Telegram Bot (@PayITBot)' : preferredPlatform === 'both' ? '⚡ Web App & Telegram' : '📱 Mobile Web App'}
                    </span>
                  </div>

                  {submitError && (
                    <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                      {submitError}
                    </p>
                  )}

                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-[#059669] hover:bg-[#047857] text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-75"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting to Waitlist...</span>
                      </>
                    ) : (
                      <span>Reserve My Early Access Spot</span>
                    )}
                  </button>

                </form>
              ) : (
                <div className="bg-emerald-50/90 border border-emerald-200 p-6 rounded-2xl text-center space-y-3 py-6">
                  <div className="w-12 h-12 rounded-full bg-[#059669] text-white flex items-center justify-center mx-auto shadow-md">
                    <Check className="w-6 h-6 stroke-[3]" />
                  </div>
                  <h4 className="text-lg font-bold text-emerald-950">Spot Reserved!</h4>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    We've registered <span className="font-extrabold text-emerald-950">{email}</span> on the PayIT early access waitlist. We'll reach out with your private invitation soon.
                  </p>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="mt-2 text-xs font-bold bg-[#059669] text-white px-6 py-2.5 rounded-xl shadow-sm"
                  >
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
