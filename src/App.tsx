import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Home,
  Inbox,
  Moon,
  RefreshCw,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { AiInsightsView } from './components/AiInsightsView';
import { AlertsView } from './components/AlertsView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeDashboard } from './components/HomeDashboard';
import { MailBridgeLogo } from './components/MailBridgeLogo';
import { OnboardingFlow } from './components/OnboardingFlow';
import { SettingsView } from './components/SettingsView';
import { SmartInboxView } from './components/SmartInboxView';
import { SAMPLE_DEMO_EMAILS } from './data/demoEmails';
import {
  authorizeGmailReadOnly,
  clearGmailAccessToken,
  getGmailAccessToken,
  signInWithGoogleIdentity,
  signOutAccount,
  subscribeToAuthChanges,
  testFirestoreConnection,
} from './lib/firebase';
import {
  analyzeEmailWithGemini,
  fetchBackendHealth,
  isWithinQuietHours,
  sendWhatsAppUrgentAlert,
  triggerBrowserUrgentNotification,
  verifyWhatsAppRecipient,
} from './services/aiService';
import {
  createDeadlineReminder,
  deleteAllUserStoredData,
  ensureUserPreferences,
  ensureUserProfile,
  ensureWhatsAppConfig,
  recordAlertLog,
  saveUserPreferences,
  saveWhatsAppConfig,
  subscribeUserAlerts,
  subscribeUserInsights,
  subscribeUserReminders,
  toggleActionCompleted,
  toggleReminderCompleted,
  updateUserProfileFields,
  upsertEmailInsight,
} from './services/firestoreService';
import { fetchRecentGmailMessages, GmailAuthError } from './services/gmailService';
import type {
  AlertLog,
  BackendHealth,
  DeadlineReminder,
  EmailInsightRecord,
  EmailMessage,
  NavTab,
  SensitivityMode,
  UserPreferences,
  UserProfile,
  WhatsAppConfig,
} from './types/mailbridge';

function MailBridgeShell() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig | null>(null);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);

  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [insights, setInsights] = useState<EmailInsightRecord[]>([]);
  const [reminders, setReminders] = useState<DeadlineReminder[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [analyzingMessageId, setAnalyzingMessageId] = useState<string | null>(null);
  const [analyzingBatch, setAnalyzingBatch] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Track messageIds already alerted in current session to prevent duplicate dispatches
  const alertedMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    testFirestoreConnection();
    fetchBackendHealth()
      .then(setBackendHealth)
      .catch(() => setBackendHealth(null));
  }, []);

  useEffect(() => {
    const unsub = subscribeToAuthChanges(async (user, token) => {
      setAuthUser(user);
      setGmailToken(token);
      if (user) {
        setIsDemoMode(false);
        const [prof, prefs, wa] = await Promise.all([
          ensureUserProfile(user.uid, user.email || '', user.displayName || 'MailBridge User'),
          ensureUserPreferences(user.uid),
          ensureWhatsAppConfig(user.uid),
        ]);
        setProfile(prof);
        setPreferences(prefs);
        setWhatsappConfig(wa);
        setDarkMode(Boolean(prof.darkMode));
      } else {
        setProfile(null);
        setPreferences(null);
        setWhatsappConfig(null);
        setInsights([]);
        setReminders([]);
        setAlerts([]);
        setEmails([]);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Attach Firestore real-time listeners only when authenticated
  useEffect(() => {
    if (!authUser) return;
    const unsubInsights = subscribeUserInsights(authUser.uid, (rows) => {
      setInsights(rows);
    });
    const unsubReminders = subscribeUserReminders(authUser.uid, (rows) => {
      setReminders(rows);
    });
    const unsubAlerts = subscribeUserAlerts(authUser.uid, (rows) => {
      setAlerts(rows);
      for (const a of rows) {
        alertedMessageIdsRef.current.add(a.messageId);
      }
    });
    return () => {
      unsubInsights();
      unsubReminders();
      unsubAlerts();
    };
  }, [authUser]);

  const insightsMap = useMemo(() => {
    const map: Record<string, EmailInsightRecord> = {};
    for (const item of insights) {
      map[item.messageId] = item;
    }
    return map;
  }, [insights]);

  const refreshGmailInbox = useCallback(async (tokenOverride?: string | null) => {
    if (isDemoMode) {
      setEmails(SAMPLE_DEMO_EMAILS);
      setEmailError(null);
      return;
    }
    const token = tokenOverride ?? getGmailAccessToken();
    if (!token) {
      return;
    }
    setLoadingEmails(true);
    setEmailError(null);
    try {
      const fetched = await fetchRecentGmailMessages(token, 20);
      setEmails(fetched);
    } catch (err) {
      if (err instanceof GmailAuthError) {
        clearGmailAccessToken();
        setGmailToken(null);
      }
      setEmailError(err instanceof Error ? err.message : 'Unable to retrieve Gmail inbox.');
    } finally {
      setLoadingEmails(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      setEmails(SAMPLE_DEMO_EMAILS);
      return;
    }
    if (gmailToken) {
      refreshGmailInbox(gmailToken);
    }
  }, [isDemoMode, gmailToken, refreshGmailInbox]);

  const handleGoogleSignIn = async () => {
    const user = await signInWithGoogleIdentity();
    setAuthUser(user);
  };

  const handleConnectGmail = async () => {
    const { user, accessToken } = await authorizeGmailReadOnly();
    setAuthUser(user);
    setGmailToken(accessToken);
    setIsDemoMode(false);
    await updateUserProfileFields(user.uid, { gmailConnected: true });
    setProfile((prev) => (prev ? { ...prev, gmailConnected: true } : prev));
    await refreshGmailInbox(accessToken);
  };

  const handleEnterDemoMode = () => {
    setIsDemoMode(true);
    setEmails(SAMPLE_DEMO_EMAILS);
    setProfile({
      uid: 'demo_user',
      email: 'demo@mailbridge.example',
      displayName: 'Demo Preview',
      onboardingCompleted: true,
      gmailConnected: false,
      aiConsentGranted: true,
      darkMode,
    });
    setPreferences({
      uid: 'demo_user',
      focusCategories: ['university', 'jobs', 'work', 'security'],
      prioritySenders: ['exams@university.edu'],
      sensitivity: 'balanced',
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      pushAlertsEnabled: true,
      whatsappAlertsEnabled: false,
    });
    setWhatsappConfig({
      uid: 'demo_user',
      phoneNumber: '',
      verified: false,
      verificationStatus: 'unconfigured',
      optInGranted: false,
      lastTestStatus: 'Demo mode',
    });
  };

  const dispatchUrgentNotifications = async (
    email: EmailMessage,
    summary: string,
    actionRequired: string,
    priority: 'urgent' | 'important'
  ) => {
    if (priority !== 'urgent') return;
    if (alertedMessageIdsRef.current.has(email.messageId)) return;
    alertedMessageIdsRef.current.add(email.messageId);

    const quiet = preferences ? isWithinQuietHours(preferences) : false;

    // 1. Mobile / Web Push Notification
    if (preferences?.pushAlertsEnabled) {
      const pushStatus = quiet
        ? 'skipped_quiet_hours'
        : await triggerBrowserUrgentNotification(
            `URGENT: ${email.senderName}`,
            `${email.subject} — ${summary}`
          );

      const logEntry: Omit<AlertLog, 'id' | 'uid' | 'createdAt'> = {
        messageId: email.messageId,
        channel: 'push',
        priority: 'urgent',
        title: `${email.senderName}: ${email.subject}`,
        body: summary,
        status: pushStatus,
        errorDetail:
          pushStatus === 'skipped_quiet_hours'
            ? 'Deferred due to quiet hours.'
            : pushStatus === 'failed'
              ? 'Browser notification permission not granted.'
              : '',
      };

      if (authUser && !isDemoMode) {
        await recordAlertLog(authUser.uid, logEntry);
      } else {
        setAlerts((prev) => [
          { ...logEntry, uid: 'demo_user', createdAtIso: new Date().toISOString() },
          ...prev,
        ]);
      }
    }

    // 2. WhatsApp Cloud API Notification (if opted in & phone provided)
    if (
      preferences?.whatsappAlertsEnabled &&
      whatsappConfig?.optInGranted &&
      whatsappConfig.phoneNumber
    ) {
      if (quiet) {
        if (authUser && !isDemoMode) {
          await recordAlertLog(authUser.uid, {
            messageId: email.messageId,
            channel: 'whatsapp',
            priority: 'urgent',
            title: email.subject,
            body: summary,
            status: 'skipped_quiet_hours',
            errorDetail: 'Deferred during quiet hours.',
          });
        }
        return;
      }

      const waRes = await sendWhatsAppUrgentAlert({
        phoneNumber: whatsappConfig.phoneNumber,
        senderName: email.senderName,
        subject: email.subject,
        summary,
        actionRequired,
        priority: 'urgent',
      });

      const waLog: Omit<AlertLog, 'id' | 'uid' | 'createdAt'> = {
        messageId: email.messageId,
        channel: 'whatsapp',
        priority: 'urgent',
        title: `${email.senderName}: ${email.subject}`,
        body: summary,
        status: waRes.status,
        errorDetail: waRes.error || '',
      };

      if (authUser && !isDemoMode) {
        await recordAlertLog(authUser.uid, waLog);
      } else {
        setAlerts((prev) => [
          { ...waLog, uid: 'demo_user', createdAtIso: new Date().toISOString() },
          ...prev,
        ]);
      }
    }
  };

  const handleAnalyzeSingleEmail = async (email: EmailMessage) => {
    setAnalyzingMessageId(email.messageId);
    setEmailError(null);
    try {
      const analysis = await analyzeEmailWithGemini(email, preferences ?? undefined);
      const record: EmailInsightRecord = {
        uid: authUser?.uid || 'demo_user',
        messageId: email.messageId,
        threadId: email.threadId,
        senderName: email.senderName,
        senderEmail: email.senderEmail,
        subject: email.subject,
        snippet: email.snippet,
        receivedAt: email.receivedAt,
        isUnread: email.isUnread,
        isDemo: email.isDemo,
        priority: analysis.priority,
        summary: analysis.summary,
        reason: analysis.reason,
        actionRequired: analysis.action_required,
        deadline: analysis.deadline ?? '',
        deadlineConfidence: analysis.deadline_confidence,
        suggestedAction: analysis.suggested_action,
        actionCompleted: insightsMap[email.messageId]?.actionCompleted ?? false,
        reminderCreated: insightsMap[email.messageId]?.reminderCreated ?? false,
      };

      if (authUser && !isDemoMode) {
        await upsertEmailInsight(authUser.uid, record);
      } else {
        setInsights((prev) => [
          record,
          ...prev.filter((item) => item.messageId !== record.messageId),
        ]);
      }

      if (analysis.priority === 'urgent') {
        await dispatchUrgentNotifications(
          email,
          analysis.summary,
          analysis.action_required,
          'urgent'
        );
      }
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Gemini analysis failed.');
    } finally {
      setAnalyzingMessageId(null);
    }
  };

  const handleAnalyzeUnprocessed = async () => {
    const queue = emails.filter((e) => !insightsMap[e.messageId]).slice(0, 5);
    if (queue.length === 0) return;
    setAnalyzingBatch(true);
    try {
      for (const email of queue) {
        await handleAnalyzeSingleEmail(email);
      }
    } finally {
      setAnalyzingBatch(false);
    }
  };

  const handleSaveWhatsApp = async (phone: string, optIn: boolean) => {
    if (!optIn) {
      const nextCfg: Omit<WhatsAppConfig, 'uid' | 'updatedAt'> = {
        phoneNumber: phone.trim(),
        verified: false,
        verificationStatus: 'disabled',
        optInGranted: false,
        lastTestStatus: 'Disabled by user',
      };
      if (authUser && !isDemoMode) {
        await saveWhatsAppConfig(authUser.uid, nextCfg);
      }
      setWhatsappConfig({ uid: authUser?.uid || 'demo_user', ...nextCfg });
      return { configured: Boolean(backendHealth?.whatsappConfigured), status: 'disabled' };
    }

    const res = await verifyWhatsAppRecipient(phone);
    const nextCfg: Omit<WhatsAppConfig, 'uid' | 'updatedAt'> = {
      phoneNumber: phone.trim(),
      verified: res.status === 'verified',
      verificationStatus:
        res.status === 'verified'
          ? 'verified'
          : res.configured
            ? 'pending_verification'
            : 'unconfigured',
      optInGranted: optIn,
      lastTestStatus: res.error || res.status,
    };

    if (authUser && !isDemoMode) {
      await saveWhatsAppConfig(authUser.uid, nextCfg);
    }
    setWhatsappConfig({ uid: authUser?.uid || 'demo_user', ...nextCfg });
    return res;
  };

  const handleCompleteOnboarding = async (input: {
    aiConsentGranted: boolean;
    focusCategories: string[];
    prioritySenders: string[];
    sensitivity: SensitivityMode;
  }) => {
    if (!authUser) return;
    await updateUserProfileFields(authUser.uid, {
      aiConsentGranted: input.aiConsentGranted,
      onboardingCompleted: true,
    });
    const nextPrefs: Omit<UserPreferences, 'uid' | 'updatedAt'> = {
      focusCategories: input.focusCategories,
      prioritySenders: input.prioritySenders,
      sensitivity: input.sensitivity,
      quietHoursEnabled: preferences?.quietHoursEnabled ?? true,
      quietHoursStart: preferences?.quietHoursStart ?? '22:00',
      quietHoursEnd: preferences?.quietHoursEnd ?? '07:00',
      pushAlertsEnabled: preferences?.pushAlertsEnabled ?? true,
      whatsappAlertsEnabled: Boolean(whatsappConfig?.optInGranted),
    };
    await saveUserPreferences(authUser.uid, nextPrefs);
    setProfile((prev) =>
      prev
        ? { ...prev, aiConsentGranted: input.aiConsentGranted, onboardingCompleted: true }
        : prev
    );
    setPreferences({ uid: authUser.uid, ...nextPrefs });
  };

  const handleToggleDarkMode = async (next: boolean) => {
    setDarkMode(next);
    if (authUser && !isDemoMode) {
      await updateUserProfileFields(authUser.uid, { darkMode: next });
      setProfile((prev) => (prev ? { ...prev, darkMode: next } : prev));
    }
  };

  const handleGrantConsent = async () => {
    if (authUser && !isDemoMode) {
      await updateUserProfileFields(authUser.uid, { aiConsentGranted: true });
    }
    setProfile((prev) => (prev ? { ...prev, aiConsentGranted: true } : prev));
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FB] dark:bg-[#0B1120]">
        <MailBridgeLogo size={52} className="animate-pulse" />
      </div>
    );
  }

  // Render Onboarding until completed or Demo Mode entered
  if (!isDemoMode && (!authUser || !profile?.onboardingCompleted)) {
    return (
      <OnboardingFlow
        isAuthenticated={Boolean(authUser)}
        userEmail={authUser?.email ?? null}
        gmailConnected={Boolean(gmailToken)}
        whatsappConfiguredOnServer={Boolean(backendHealth?.whatsappConfigured)}
        onGoogleSignIn={handleGoogleSignIn}
        onConnectGmail={handleConnectGmail}
        onEnterDemoMode={handleEnterDemoMode}
        onSaveWhatsAppSetup={handleSaveWhatsApp}
        onCompleteOnboarding={handleCompleteOnboarding}
      />
    );
  }

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: 'Home', icon: <Home className="h-5 w-5" /> },
    { id: 'inbox', label: 'Inbox', icon: <Inbox className="h-5 w-5" /> },
    { id: 'insights', label: 'AI Insights', icon: <Sparkles className="h-5 w-5" /> },
    { id: 'alerts', label: 'Alerts', icon: <Bell className="h-5 w-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-900 dark:bg-[#0B1120] dark:text-slate-100 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white px-4 py-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 px-2">
          <MailBridgeLogo size={36} />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            MailBridge AI
          </span>
        </div>

        <nav className="mt-8 flex-1 space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[44px] flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#174EA6] text-white dark:bg-[#00BCD4] dark:text-slate-950'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="px-2">
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
              {profile?.displayName || 'User'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {isDemoMode ? 'Sample Demo Mode' : profile?.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleToggleDarkMode(!darkMode)}
            className="mt-3 w-full min-h-[40px] flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{darkMode ? 'Switch to Light' : 'Switch to Dark'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 pb-20 lg:pb-10">
        {/* Compact Top Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 sm:px-8 h-14 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5 lg:hidden">
            <MailBridgeLogo size={28} />
            <span className="font-display text-base font-bold text-slate-900 dark:text-white whitespace-nowrap">
              MailBridge AI
            </span>
          </div>

          <div className="hidden lg:block text-sm font-semibold text-slate-800 dark:text-slate-200 capitalize">
            {activeTab === 'insights' ? 'AI Insights & Deadlines' : activeTab}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isDemoMode && (
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400 mr-2 whitespace-nowrap">
                Demo Data
              </span>
            )}
            <button
              type="button"
              onClick={() => (gmailToken || isDemoMode ? refreshGmailInbox() : handleConnectGmail())}
              disabled={loadingEmails}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#174EA6] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#133f87] disabled:opacity-60 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingEmails ? 'animate-spin' : ''}`} />
              {gmailToken || isDemoMode ? 'Sync Inbox' : 'Connect Gmail'}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 sm:px-8 py-6">
          {activeTab === 'home' && (
            <HomeDashboard
              displayName={profile?.displayName || 'there'}
              isDemoMode={isDemoMode}
              gmailConnected={Boolean(gmailToken)}
              aiConsentGranted={Boolean(profile?.aiConsentGranted)}
              emails={emails}
              insightsMap={insightsMap}
              alerts={alerts}
              analyzingBatch={analyzingBatch}
              onNavigate={setActiveTab}
              onSelectEmail={(msgId) => {
                setSelectedMessageId(msgId);
                setActiveTab('inbox');
              }}
              onAnalyzeUnprocessed={handleAnalyzeUnprocessed}
              onConnectGmail={handleConnectGmail}
            />
          )}

          {activeTab === 'inbox' && (
            <SmartInboxView
              isDemoMode={isDemoMode}
              gmailConnected={Boolean(gmailToken)}
              aiConsentGranted={Boolean(profile?.aiConsentGranted)}
              emails={emails}
              insightsMap={insightsMap}
              selectedMessageId={selectedMessageId}
              loadingEmails={loadingEmails}
              emailError={emailError}
              analyzingMessageId={analyzingMessageId}
              onSelectEmail={setSelectedMessageId}
              onRefreshInbox={() => refreshGmailInbox()}
              onConnectGmail={handleConnectGmail}
              onAnalyzeEmail={handleAnalyzeSingleEmail}
              onGrantConsent={handleGrantConsent}
            />
          )}

          {activeTab === 'insights' && (
            <AiInsightsView
              insights={insights}
              reminders={reminders}
              onToggleActionCompleted={async (messageId, completed) => {
                if (authUser && !isDemoMode) {
                  await toggleActionCompleted(authUser.uid, messageId, completed);
                } else {
                  setInsights((prev) =>
                    prev.map((i) =>
                      i.messageId === messageId ? { ...i, actionCompleted: completed } : i
                    )
                  );
                }
              }}
              onCreateReminder={async (input) => {
                if (authUser && !isDemoMode) {
                  await createDeadlineReminder(authUser.uid, input);
                } else {
                  setReminders((prev) => [
                    {
                      id: `demo_rem_${Date.now()}`,
                      uid: 'demo_user',
                      ...input,
                      completed: false,
                    },
                    ...prev,
                  ]);
                  setInsights((prev) =>
                    prev.map((i) =>
                      i.messageId === input.messageId ? { ...i, reminderCreated: true } : i
                    )
                  );
                }
              }}
              onToggleReminderCompleted={async (reminderId, completed) => {
                if (authUser && !isDemoMode) {
                  await toggleReminderCompleted(authUser.uid, reminderId, completed);
                } else {
                  setReminders((prev) =>
                    prev.map((r) => (r.id === reminderId ? { ...r, completed } : r))
                  );
                }
              }}
              onOpenEmail={(msgId) => {
                setSelectedMessageId(msgId);
                setActiveTab('inbox');
              }}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertsView
              backendHealth={backendHealth}
              whatsappConfig={whatsappConfig}
              preferences={preferences}
              alerts={alerts}
              onSaveWhatsApp={handleSaveWhatsApp}
              onTestPushNotification={async () => {
                const status = await triggerBrowserUrgentNotification(
                  'MailBridge AI — Urgent Alert Test',
                  'This simulates how urgent Gmail alerts surface immediately on your device.'
                );
                const logEntry: Omit<AlertLog, 'id' | 'uid' | 'createdAt'> = {
                  messageId: 'test_push_alert',
                  channel: 'push',
                  priority: 'urgent',
                  title: 'Test Urgent Mobile Push Notification',
                  body: 'Triggered manually from Alerts tab.',
                  status,
                  errorDetail:
                    status === 'failed'
                      ? 'Browser notification permission was denied or unsupported.'
                      : '',
                };
                if (authUser && !isDemoMode) {
                  await recordAlertLog(authUser.uid, logEntry);
                } else {
                  setAlerts((prev) => [
                    { ...logEntry, uid: 'demo_user', createdAtIso: new Date().toISOString() },
                    ...prev,
                  ]);
                }
              }}
              onSendTestWhatsApp={async () => {
                const res = await sendWhatsAppUrgentAlert({
                  phoneNumber: whatsappConfig?.phoneNumber || '',
                  senderName: 'MailBridge AI Verification',
                  subject: 'Urgent Alert Channel Test',
                  summary: 'Your WhatsApp urgent email alert channel is active.',
                  actionRequired: 'No action required — test notification.',
                  priority: 'urgent',
                });
                const logEntry: Omit<AlertLog, 'id' | 'uid' | 'createdAt'> = {
                  messageId: 'test_wa_alert',
                  channel: 'whatsapp',
                  priority: 'urgent',
                  title: 'Test WhatsApp Business Cloud API Alert',
                  body: 'Manual delivery test from Alerts screen.',
                  status: res.status,
                  errorDetail: res.error || '',
                };
                if (authUser && !isDemoMode) {
                  await recordAlertLog(authUser.uid, logEntry);
                } else {
                  setAlerts((prev) => [
                    { ...logEntry, uid: 'demo_user', createdAtIso: new Date().toISOString() },
                    ...prev,
                  ]);
                }
                return res;
              }}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              profile={profile}
              preferences={preferences}
              isDemoMode={isDemoMode}
              darkMode={darkMode}
              onToggleDarkMode={handleToggleDarkMode}
              onToggleAiConsent={async (granted) => {
                if (authUser && !isDemoMode) {
                  await updateUserProfileFields(authUser.uid, { aiConsentGranted: granted });
                }
                setProfile((prev) => (prev ? { ...prev, aiConsentGranted: granted } : prev));
              }}
              onSavePreferences={async (prefs) => {
                if (authUser && !isDemoMode) {
                  await saveUserPreferences(authUser.uid, prefs);
                }
                setPreferences({ uid: authUser?.uid || 'demo_user', ...prefs });
              }}
              onDisconnectGmail={async () => {
                if (authUser) {
                  await updateUserProfileFields(authUser.uid, { gmailConnected: false });
                }
                await signOutAccount();
                setGmailToken(null);
                setEmails([]);
              }}
              onDeleteAllData={async () => {
                if (authUser) {
                  await deleteAllUserStoredData(authUser.uid);
                }
                await signOutAccount();
                setGmailToken(null);
                setEmails([]);
                setInsights([]);
                setReminders([]);
                setAlerts([]);
              }}
              onExitDemoMode={() => {
                setIsDemoMode(false);
                setEmails([]);
                setInsights([]);
                setReminders([]);
                setAlerts([]);
                setProfile(null);
              }}
            />
          )}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation (5 Tabs: Home | Inbox | AI Insights | Alerts | Settings) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 h-16 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:hidden"
      >
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                active
                  ? 'text-[#174EA6] dark:text-[#00BCD4]'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {item.icon}
              <span className="truncate max-w-full px-1">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MailBridgeShell />
    </ErrorBoundary>
  );
}
