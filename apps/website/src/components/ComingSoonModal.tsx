import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Sparkles, CheckCircle2, ExternalLink } from 'lucide-react';

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramUrl?: string;
}

const TelegramIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
  </svg>
);

export const ComingSoonModal: React.FC<ComingSoonModalProps> = ({
  isOpen,
  onClose,
  telegramUrl = 'https://t.me/payeetbot',
}) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#060B14]/80 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Modal Card */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="coming-soon-title"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-lg rounded-3xl bg-[#0F1524] border border-white/15 p-6 sm:p-8 shadow-2xl overflow-hidden"
          >
            {/* Aurora glow background highlight */}
            <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-[#16C7B7]/15 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-56 h-56 rounded-full bg-[#7567F8]/15 blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="absolute top-5 right-5 p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-6">
              {/* Badge & Icon */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#16C7B7]/15 border border-[#16C7B7]/40 flex items-center justify-center text-[#35D9D0]">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.7rem] font-bold uppercase tracking-wider bg-[#35D9D0]/10 text-[#35D9D0] border border-[#35D9D0]/30">
                    <Sparkles className="w-3 h-3" /> Mobile App
                  </div>
                  <h3 id="coming-soon-title" className="text-2xl font-extrabold text-white tracking-tight mt-1">
                    Coming Soon
                  </h3>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm sm:text-base text-[#F7F8F4]/80 leading-relaxed">
                The Proxim mobile app is currently in private testing. We're finalizing the experience to ensure smooth, secure everyday payments and money management on your device.
              </p>

              {/* Waitlist Notification */}
              <div className="bg-[#060B14]/60 border border-white/10 rounded-2xl p-4 space-y-3">
                {submitted ? (
                  <div className="flex items-center gap-3 py-1 text-left">
                    <div className="w-9 h-9 rounded-full bg-[#16C7B7]/20 border border-[#16C7B7] flex items-center justify-center text-[#35D9D0] shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">You're on the list!</p>
                      <p className="text-xs text-[#F7F8F4]/70">We'll email you the moment the mobile app launches.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-2">
                    <p className="text-xs font-semibold text-white/80">
                      Get notified when the mobile app launches
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="flex-1 bg-[#060B14] text-white text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-white/15 outline-none focus:border-[#35D9D0] transition-colors"
                      />
                      <button
                        type="submit"
                        className="btn-primary !text-xs !py-2.5 !px-5 whitespace-nowrap shrink-0"
                      >
                        Notify Me
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Alternative: Use Telegram */}
              <div className="pt-2 border-t border-white/10 space-y-3">
                <p className="text-xs text-white/60">
                  Ready to manage your money right now? Start instantly with our Telegram bot:
                </p>
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary w-full !text-sm !py-3 flex items-center justify-center gap-2"
                >
                  <TelegramIcon className="w-4 h-4 text-[#35D9D0]" />
                  <span>Get started on Telegram</span>
                  <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

