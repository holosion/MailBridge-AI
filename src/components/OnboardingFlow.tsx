import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Lock,
  Mail,
  MessageSquare,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { motion } from 'motion/react';
import { GoogleSignInButton, MailBridgeLogo } from './MailBridgeLogo';
import { FOCUS_CATEGORY_OPTIONS, type SensitivityMode } from '../types/mailbridge';

type OnboardingStep =
  | 'splash'
  | 'intro_1'
  | 'intro_2'
  | 'intro_3'
  | 'welcome_auth'
  | 'gmail_permission'
  | 'whatsapp_setup'
  | 'preferences';

interface OnboardingFlowProps {
  isAuthenticated: boolean;
  userEmail: string | null;
  gmailConnected: boolean;
  whatsappConfiguredOnServer: boolean;
  onGoogleSignIn: () => Promise<void>;
  onConnectGmail: () => Promise<void>;
  onEnterDemoMode: () => void;
  onSaveWhatsAppSetup: (phone: string, optIn: boolean) => Promise<{
    configured: boolean;
    status: string;
    error?: string;
  }>;
  onCompleteOnboarding: (prefs: {
    aiConsentGranted: boolean;
    focusCategories: string[];
    prioritySenders: string[];
    sensitivity: SensitivityMode;
  }) => Promise<void>;
}

const INTRO_PAGES = [
  {
    step: 'intro_1' as const,
    image: '/src/assets/images/onboarding_bridge_inbox_1795254185581.jpg',
    title: 'Never miss critical emails buried in your inbox',
    description:
      'MailBridge AI connects to your Gmail with strict read-only permissions, surfacing urgent academic, work, and financial messages automatically.',
  },
  {
    step: 'intro_2' as const,
    image: '/src/assets/images/onboarding_ai_triage_1795254186252.jpg',
    title: 'Concise AI summaries and verified deadlines',
    description:
      'Every important thread is distilled into a clear summary, required action, and explicit deadline—never inventing dates that were not in the email.',
  },
  {
    step: 'intro_3' as const,
    image: '/src/assets/images/onboarding_instant_alerts_1795254185947.jpg',
    title: 'Instant urgent alerts on mobile and WhatsApp',
    description:
      'Receive mobile notifications and optional opt-in WhatsApp summaries from MailBridge AI’s verified business sender, respecting your quiet hours.',
  },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  isAuthenticated,
  userEmail,
  gmailConnected,
  whatsappConfiguredOnServer,
  onGoogleSignIn,
  onConnectGmail,
  onEnterDemoMode,
  onSaveWhatsAppSetup,
  onCompleteOnboarding,
}) => {
  const [step, setStep] = useState<OnboardingStep>(
    isAuthenticated ? (gmailConnected ? 'whatsapp_setup' : 'gmail_permission') : 'splash'
  );
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Consent & preferences state
  const [aiConsent, setAiConsent] = useState(true);
  const [phone, setPhone] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [whatsappFeedback, setWhatsappFeedback] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'university',
    'jobs',
    'work',
    'security',
  ]);
  const [vipInput, setVipInput] = useState('');
  const [prioritySenders, setPrioritySenders] = useState<string[]>([]);
  const [sensitivity, setSensitivity] = useState<SensitivityMode>('balanced');

  useEffect(() => {
    if (step === 'splash') {
      const timer = window.setTimeout(() => {
        setStep(isAuthenticated ? 'gmail_permission' : 'intro_1');
      }, 1500);
      return () => window.clearTimeout(timer);
    }
  }, [step, isAuthenticated]);

  const handleAuthClick = async () => {
    setErrorMsg(null);
    setBusy(true);
    try {
      await onGoogleSignIn();
      setStep('gmail_permission');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Google sign-in could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const handleGmailClick = async () => {
    setErrorMsg(null);
    setBusy(true);
    try {
      await onConnectGmail();
      setStep('whatsapp_setup');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gmail authorization was cancelled.');
    } finally {
      setBusy(false);
    }
  };

  const handleWhatsAppNext = async (skip = false) => {
    setErrorMsg(null);
    setWhatsappFeedback(null);
    if (skip || !whatsappOptIn) {
      setStep('preferences');
      return;
    }
    setBusy(true);
    try {
      const result = await onSaveWhatsAppSetup(phone, whatsappOptIn);
      if (result.status === 'verified') {
        setStep('preferences');
      } else {
        setWhatsappFeedback(
          result.error ||
            'Number saved with pending status. Official Meta WhatsApp Cloud API delivery activates once server credentials are configured.'
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save WhatsApp settings.');
    } finally {
      setBusy(false);
    }
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const addVipSender = () => {
    const clean = vipInput.trim().toLowerCase();
    if (!clean || prioritySenders.includes(clean)) return;
    setPrioritySenders((prev) => [...prev.slice(0, 24), clean]);
    setVipInput('');
  };

  const handleFinish = async () => {
    setErrorMsg(null);
    setBusy(true);
    try {
      await onCompleteOnboarding({
        aiConsentGranted: aiConsent,
        focusCategories: selectedCategories,
        prioritySenders,
        sensitivity,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save preferences.');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'splash') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F7FB] px-6 dark:bg-[#0B1120]">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center"
        >
          <MailBridgeLogo size={76} className="shadow-lg shadow-[#174EA6]/20 rounded-2xl" />
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            MailBridge AI
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Intelligent email triage & instant alerts
          </p>
        </motion.div>
      </div>
    );
  }

  const introIdx = INTRO_PAGES.findIndex((p) => p.step === step);
  if (introIdx !== -1) {
    const current = INTRO_PAGES[introIdx];
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FB] p-6 dark:bg-[#0B1120]">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <MailBridgeLogo size={32} />
              <span className="font-display text-base font-bold text-slate-900 dark:text-white">
                MailBridge AI
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStep('welcome_auth')}
              className="min-h-[40px] px-3 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Skip
            </button>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-[#F4F7FB] dark:border-slate-800 dark:bg-slate-950">
            <img
              src={current.image}
              alt={current.title}
              referrerPolicy="no-referrer"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>

          <div className="mt-6">
            <p className="text-xs font-medium text-[#174EA6] dark:text-[#00BCD4]">
              Step {introIdx + 1} of 3
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
              {current.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {current.description}
            </p>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {INTRO_PAGES.map((p, i) => (
                <span
                  key={p.step}
                  className={`h-1.5 rounded-full transition-all ${
                    i === introIdx
                      ? 'w-6 bg-[#174EA6] dark:bg-[#00BCD4]'
                      : 'w-2 bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {introIdx > 0 && (
                <button
                  type="button"
                  onClick={() => setStep(INTRO_PAGES[introIdx - 1].step)}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  introIdx < INTRO_PAGES.length - 1
                    ? setStep(INTRO_PAGES[introIdx + 1].step)
                    : setStep('welcome_auth')
                }
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#174EA6] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#133f87]"
              >
                {introIdx < INTRO_PAGES.length - 1 ? 'Next' : 'Get Started'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FB] p-6 dark:bg-[#0B1120]">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MailBridgeLogo size={32} />
            <span className="font-display text-base font-bold text-slate-900 dark:text-white">
              MailBridge AI
            </span>
          </div>
          {userEmail && (
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
              {userEmail}
            </span>
          )}
        </div>

        {errorMsg && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        {step === 'welcome_auth' && (
          <div className="mt-7">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
              Sign in to MailBridge AI
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Authenticate securely with your Google account. MailBridge AI never asks for your
              Gmail password and separates identity sign-in from read-only Gmail access.
            </p>

            <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#174EA6] dark:text-[#00BCD4]" />
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Your preferences and AI insights are isolated strictly to your Firebase user
                  account.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#174EA6] dark:text-[#00BCD4]" />
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Disconnect your Gmail or permanently delete stored metadata at any time in
                  Settings.
                </p>
              </div>
            </div>

            <div className="mt-7 space-y-3">
              <GoogleSignInButton onClick={handleAuthClick} disabled={busy} />
              <button
                type="button"
                onClick={onEnterDemoMode}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Explore Sample Inbox (Demo Mode)
              </button>
            </div>
          </div>
        )}

        {step === 'gmail_permission' && (
          <div className="mt-7">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#174EA6] dark:text-[#00BCD4]">
              <Mail className="h-4 w-4" />
              <span>Gmail Connection & Consent</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Authorize read-only Gmail access
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              To identify urgent correspondence and extract deadlines, MailBridge AI requests only
              the least-privilege <span className="font-mono text-xs">gmail.readonly</span> scope.
            </p>

            <ul className="mt-5 space-y-2.5 text-sm text-slate-700 dark:text-slate-200">
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Read recent inbox headers and message bodies for AI analysis</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Never replies, forwards, modifies labels, or deletes your emails</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Access token stays strictly in memory and clears on sign-out</span>
              </li>
            </ul>

            <label className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200 p-4 cursor-pointer dark:border-slate-800">
              <input
                type="checkbox"
                checked={aiConsent}
                onChange={(e) => setAiConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded accent-[#174EA6]"
              />
              <span className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                I consent to MailBridge AI sending individual email messages I choose to analyze (or
                sync) to Gemini AI to produce priority scores, summaries, and deadline extraction.
              </span>
            </label>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleGmailClick}
                disabled={busy}
                className="flex-1 min-h-[46px] rounded-xl bg-[#174EA6] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#133f87] disabled:opacity-60"
              >
                {busy ? 'Authorizing Gmail...' : 'Connect Gmail (Read-Only)'}
              </button>
              <button
                type="button"
                onClick={() => setStep('whatsapp_setup')}
                className="min-h-[46px] rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {step === 'whatsapp_setup' && (
          <div className="mt-7">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#174EA6] dark:text-[#00BCD4]">
              <MessageSquare className="h-4 w-4" />
              <span>WhatsApp Business Cloud Alerts</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Register your alert phone number
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              You never expose your personal WhatsApp account. Urgent email alerts are sent from
              MailBridge AI’s verified business sender to the number you opt in below.
            </p>

            {!whatsappConfiguredOnServer && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                Meta WhatsApp Business Cloud API credentials are not yet configured on this server.
                You can still register your preference now, and live WhatsApp delivery will remain
                inactive until credentials are provided.
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  WhatsApp phone number (E.164 format)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+14155552671"
                  className="mt-1.5 w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-[#174EA6] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappOptIn}
                  onChange={(e) => setWhatsappOptIn(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded accent-[#174EA6]"
                />
                <span className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  I explicitly opt in to receive urgent email summaries on WhatsApp from MailBridge
                  AI, subject to my quiet hours and priority rules.
                </span>
              </label>

              {whatsappFeedback && (
                <p className="text-xs text-amber-700 dark:text-amber-300">{whatsappFeedback}</p>
              )}
            </div>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => handleWhatsAppNext(false)}
                disabled={busy}
                className="flex-1 min-h-[46px] rounded-xl bg-[#174EA6] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#133f87] disabled:opacity-60"
              >
                {busy ? 'Checking...' : whatsappOptIn ? 'Save & Verify Number' : 'Continue'}
              </button>
              <button
                type="button"
                onClick={() => handleWhatsAppNext(true)}
                className="min-h-[46px] rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {step === 'preferences' && (
          <div className="mt-7">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#174EA6] dark:text-[#00BCD4]">
              <SlidersHorizontal className="h-4 w-4" />
              <span>Priority Preferences</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              What matters most in your inbox?
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
              Select topics and VIP senders to guide Gemini priority classification.
            </p>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {FOCUS_CATEGORY_OPTIONS.map((cat) => {
                const active = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`min-h-[44px] flex items-center justify-between rounded-xl border px-3.5 py-2 text-left text-xs font-medium transition-colors ${
                      active
                        ? 'border-[#174EA6] bg-[#174EA6]/8 text-[#174EA6] dark:border-[#00BCD4] dark:bg-[#00BCD4]/10 dark:text-[#00BCD4]'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{cat.label}</span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Notification sensitivity
              </label>
              <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-950">
                {(
                  [
                    { id: 'strict', label: 'Strict' },
                    { id: 'balanced', label: 'Balanced' },
                    { id: 'high_recall', label: 'High Recall' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setSensitivity(mode.id)}
                    className={`min-h-[38px] rounded-lg text-xs font-medium transition-colors ${
                      sensitivity === mode.id
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                VIP senders or domains (optional)
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="text"
                  value={vipInput}
                  onChange={(e) => setVipInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addVipSender();
                    }
                  }}
                  placeholder="e.g. exams@university.edu"
                  className="flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-[#174EA6] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <button
                  type="button"
                  onClick={addVipSender}
                  className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Add
                </button>
              </div>
              {prioritySenders.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                  {prioritySenders.map((sender) => (
                    <button
                      key={sender}
                      type="button"
                      onClick={() =>
                        setPrioritySenders((prev) => prev.filter((item) => item !== sender))
                      }
                      className="rounded-lg bg-slate-100 px-2.5 py-1 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
                      {sender} ×
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleFinish}
              disabled={busy}
              className="mt-7 w-full min-h-[48px] rounded-xl bg-[#174EA6] px-5 py-3 text-sm font-semibold text-white hover:bg-[#133f87] disabled:opacity-60"
            >
              {busy ? 'Launching Dashboard...' : 'Launch MailBridge AI Dashboard'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
