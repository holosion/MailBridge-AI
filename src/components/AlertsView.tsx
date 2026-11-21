import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Code2,
  MessageSquare,
  Send,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import type { AlertLog, BackendHealth, UserPreferences, WhatsAppConfig } from '../types/mailbridge';

interface AlertsViewProps {
  backendHealth: BackendHealth | null;
  whatsappConfig: WhatsAppConfig | null;
  preferences: UserPreferences | null;
  alerts: AlertLog[];
  onSaveWhatsApp: (phone: string, optIn: boolean) => Promise<{
    configured: boolean;
    status: string;
    error?: string;
  }>;
  onTestPushNotification: () => Promise<void>;
  onSendTestWhatsApp: () => Promise<{
    configured: boolean;
    status: string;
    error?: string;
  }>;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  backendHealth,
  whatsappConfig,
  preferences,
  alerts,
  onSaveWhatsApp,
  onTestPushNotification,
  onSendTestWhatsApp,
}) => {
  const [phone, setPhone] = useState(whatsappConfig?.phoneNumber ?? '');
  const [optIn, setOptIn] = useState(whatsappConfig?.optInGranted ?? false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatusFeedback(null);
    try {
      const res = await onSaveWhatsApp(phone, optIn);
      setStatusFeedback(
        res.status === 'verified'
          ? 'Phone number verified through Meta WhatsApp Business Cloud API.'
          : res.error ||
              'Preferences saved. Official WhatsApp delivery requires backend Meta Cloud API credentials.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleTestWhatsApp = async () => {
    setBusy(true);
    setStatusFeedback(null);
    try {
      const res = await onSendTestWhatsApp();
      setStatusFeedback(
        res.status === 'sent'
          ? 'Test urgent alert delivered via Meta WhatsApp Business Cloud API.'
          : res.error || 'WhatsApp delivery did not execute because credentials are not configured.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* WhatsApp Business Cloud API Configuration */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-[#174EA6] dark:text-[#00BCD4]" />
                WhatsApp Business Cloud Alerts
              </h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Urgent alerts originate from MailBridge AI’s official business sender. Your
                personal WhatsApp account is never connected.
              </p>
            </div>
            <span
              className={`text-xs font-semibold whitespace-nowrap ${
                backendHealth?.whatsappConfigured
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {backendHealth?.whatsappConfigured ? 'API Configured' : 'API Unconfigured'}
            </span>
          </div>

          {!backendHealth?.whatsappConfigured && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Meta Cloud API Credentials Required</span>
              </div>
              <p className="mt-1.5">
                Live WhatsApp delivery is disabled until <span className="font-mono">WHATSAPP_ACCESS_TOKEN</span> and{' '}
                <span className="font-mono">WHATSAPP_PHONE_NUMBER_ID</span> are added to backend
                secrets. MailBridge AI will never pretend a message was sent when the API is
                unconfigured.
              </p>
            </div>
          )}

          <form onSubmit={handleVerifyAndSave} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Recipient WhatsApp number (E.164)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+14155552671"
                className="mt-1.5 w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 outline-none focus:border-[#174EA6] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
                className="mt-1 h-4 w-4 rounded accent-[#174EA6]"
              />
              <span className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Enable opt-in WhatsApp notifications for qualifying urgent emails (respecting quiet
                hours {preferences?.quietHoursEnabled ? `${preferences.quietHoursStart}–${preferences.quietHoursEnd}` : 'currently off'}).
              </span>
            </label>

            {statusFeedback && (
              <p className="text-xs font-medium text-[#174EA6] dark:text-[#00BCD4]">
                {statusFeedback}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="min-h-[44px] rounded-xl bg-[#174EA6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#133f87] disabled:opacity-60"
              >
                {busy ? 'Verifying...' : 'Save & Verify Number'}
              </button>
              <button
                type="button"
                onClick={handleTestWhatsApp}
                disabled={busy || !optIn || !phone}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Send className="h-4 w-4" />
                Send Test WhatsApp Alert
              </button>
            </div>
          </form>

          {/* Approved Message Template Preview */}
          <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Approved Notification Format Preview
            </p>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-[#F5F7FB] p-4 font-mono text-xs leading-relaxed text-slate-700 dark:bg-slate-950 dark:text-slate-300">
{`MailBridge AI

URGENT EMAIL

From: University Administration
Subject: Examination Timetable Update
Summary: Your examination timetable has been updated.
Action: Review the new schedule.

Open MailBridge AI to view the email.`}
            </pre>
          </div>
        </section>

        {/* Mobile Push + Real-Time Monitoring Architecture */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-[#174EA6] dark:text-[#00BCD4]" />
              Mobile Push & FCM Pipeline
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              On Android, MailBridge AI receives Firebase Cloud Messaging (FCM) high-priority pushes
              triggered by Gmail Pub/Sub watch events. In this browser preview, you can test local
              desktop/mobile push notifications directly.
            </p>

            <button
              type="button"
              onClick={onTestPushNotification}
              className="mt-4 w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Bell className="h-4 w-4" />
              Test Urgent Push Notification
            </button>

            <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Duplicate alert prevention keyed by Gmail messageId</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Webhook endpoint active at <span className="font-mono">/api/gmail/watch-webhook</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-[#174EA6] dark:text-[#00BCD4] shrink-0" />
                <span>Native Android Kotlin / Compose source included in <span className="font-mono">/android</span></span>
              </div>
            </div>
          </section>

          {/* Delivery Status Log */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Alert Delivery Log ({alerts.length})
            </h2>

            {alerts.length === 0 ? (
              <p className="py-6 text-xs text-slate-500 dark:text-slate-400">
                No notification deliveries logged yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[340px] overflow-y-auto">
                {alerts.map((log) => (
                  <div key={log.id || `${log.messageId}_${log.channel}`} className="py-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                        {log.channel} · {log.status.replace(/_/g, ' ')}
                      </span>
                      <span className="font-mono text-slate-400 tabular-nums">
                        {log.createdAtIso
                          ? new Date(log.createdAtIso).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Now'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-1">
                      {log.title}
                    </p>
                    {log.errorDetail && (
                      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                        {log.errorDetail}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
