import React, { useState } from 'react';
import { Check, Moon, Shield, Sun, Trash2, Unplug } from 'lucide-react';
import {
  FOCUS_CATEGORY_OPTIONS,
  type SensitivityMode,
  type UserPreferences,
  type UserProfile,
} from '../types/mailbridge';

interface SettingsViewProps {
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  isDemoMode: boolean;
  darkMode: boolean;
  onToggleDarkMode: (next: boolean) => void;
  onToggleAiConsent: (granted: boolean) => Promise<void>;
  onSavePreferences: (prefs: Omit<UserPreferences, 'uid' | 'updatedAt'>) => Promise<void>;
  onDisconnectGmail: () => Promise<void>;
  onDeleteAllData: () => Promise<void>;
  onExitDemoMode: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  preferences,
  isDemoMode,
  darkMode,
  onToggleDarkMode,
  onToggleAiConsent,
  onSavePreferences,
  onDisconnectGmail,
  onDeleteAllData,
  onExitDemoMode,
}) => {
  const [focusCategories, setFocusCategories] = useState<string[]>(
    preferences?.focusCategories ?? ['university', 'jobs', 'work', 'security']
  );
  const [prioritySenders, setPrioritySenders] = useState<string[]>(
    preferences?.prioritySenders ?? []
  );
  const [vipInput, setVipInput] = useState('');
  const [sensitivity, setSensitivity] = useState<SensitivityMode>(
    preferences?.sensitivity ?? 'balanced'
  );
  const [quietEnabled, setQuietEnabled] = useState(preferences?.quietHoursEnabled ?? true);
  const [quietStart, setQuietStart] = useState(preferences?.quietHoursStart ?? '22:00');
  const [quietEnd, setQuietEnd] = useState(preferences?.quietHoursEnd ?? '07:00');
  const [pushEnabled, setPushEnabled] = useState(preferences?.pushAlertsEnabled ?? true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(
    preferences?.whatsappAlertsEnabled ?? false
  );

  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleCategory = (id: string) => {
    setFocusCategories((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const addVip = () => {
    const clean = vipInput.trim().toLowerCase();
    if (!clean || prioritySenders.includes(clean)) return;
    setPrioritySenders((prev) => [...prev.slice(0, 24), clean]);
    setVipInput('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedToast(null);
    try {
      await onSavePreferences({
        focusCategories,
        prioritySenders,
        sensitivity,
        quietHoursEnabled: quietEnabled,
        quietHoursStart: quietStart,
        quietHoursEnd: quietEnd,
        pushAlertsEnabled: pushEnabled,
        whatsappAlertsEnabled: whatsappEnabled,
      });
      setSavedToast('Preferences saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDeleteAllData();
      setConfirmDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Appearance & AI Consent */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Appearance & AI Privacy
        </h1>
        <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
          <div className="py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">Theme Mode</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Switch between clean daylight and low-glare dark mode.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onToggleDarkMode(!darkMode)}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>

          <div className="py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Gemini AI Processing Consent
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Allow MailBridge AI to analyze selected inbox messages for summaries and deadlines.
              </p>
            </div>
            <input
              type="checkbox"
              checked={profile?.aiConsentGranted ?? false}
              onChange={(e) => onToggleAiConsent(e.target.checked)}
              className="h-5 w-5 rounded accent-[#174EA6] cursor-pointer"
              aria-label="Toggle AI processing consent"
            />
          </div>
        </div>
      </section>

      {/* Priority Preferences Form */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-6"
      >
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Personalized AI Preferences
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Customize what topics, VIP senders, and quiet hours govern urgent alerts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {FOCUS_CATEGORY_OPTIONS.map((cat) => {
            const active = focusCategories.includes(cat.id);
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Alert Sensitivity
            </label>
            <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-950">
              {(
                [
                  { id: 'strict', label: 'Strict' },
                  { id: 'balanced', label: 'Balanced' },
                  { id: 'high_recall', label: 'High Recall' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSensitivity(m.id)}
                  className={`min-h-[38px] rounded-lg text-xs font-medium ${
                    sensitivity === m.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Quiet Hours
              </label>
              <input
                type="checkbox"
                checked={quietEnabled}
                onChange={(e) => setQuietEnabled(e.target.checked)}
                className="h-4 w-4 rounded accent-[#174EA6]"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="time"
                value={quietStart}
                disabled={!quietEnabled}
                onChange={(e) => setQuietStart(e.target.value)}
                className="flex-1 min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="time"
                value={quietEnd}
                disabled={!quietEnabled}
                onChange={(e) => setQuietEnd(e.target.value)}
                className="flex-1 min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Important VIP Senders
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              type="text"
              value={vipInput}
              onChange={(e) => setVipInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addVip();
                }
              }}
              placeholder="Add email or domain (e.g. hr@company.com)"
              className="flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-[#174EA6] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <button
              type="button"
              onClick={addVip}
              className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Add
            </button>
          </div>
          {prioritySenders.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {prioritySenders.map((sender) => (
                <button
                  key={sender}
                  type="button"
                  onClick={() => setPrioritySenders((prev) => prev.filter((s) => s !== sender))}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                >
                  {sender} ×
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-700 dark:text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pushEnabled}
              onChange={(e) => setPushEnabled(e.target.checked)}
              className="h-4 w-4 rounded accent-[#174EA6]"
            />
            <span>Mobile Push Alerts</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={whatsappEnabled}
              onChange={(e) => setWhatsappEnabled(e.target.checked)}
              className="h-4 w-4 rounded accent-[#174EA6]"
            />
            <span>WhatsApp Urgent Alerts</span>
          </label>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {savedToast || ''}
          </span>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] rounded-xl bg-[#174EA6] px-5 py-2 text-sm font-semibold text-white hover:bg-[#133f87] disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>

      {/* Account Security & Data Deletion */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#174EA6] dark:text-[#00BCD4]" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Security & Data Controls
          </h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          Connected account: <span className="font-mono">{profile?.email || 'Demo Session'}</span> ·
          Scope: <span className="font-mono">gmail.readonly</span>. MailBridge AI never retains raw
          email attachments or modifies your Gmail mailbox.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {isDemoMode ? (
            <button
              type="button"
              onClick={onExitDemoMode}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              Exit Demo Mode & Sign In
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onDisconnectGmail}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Unplug className="h-4 w-4" />
                Disconnect Gmail & Sign Out
              </button>

              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
                Delete All Stored Data
              </button>
            </>
          )}
        </div>
      </section>

      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Permanently delete stored data?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              This removes all AI summaries, extracted deadlines, reminders, alert logs, WhatsApp
              config, and preferences stored in MailBridge AI. Your actual Gmail inbox emails are
              untouched.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="min-h-[42px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="min-h-[42px] rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
