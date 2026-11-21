import type {
  BackendHealth,
  DeadlineConfidence,
  EmailMessage,
  EmailPriority,
  SensitivityMode,
  UserPreferences,
} from '../types/mailbridge';

export interface AnalyzedEmailResponse {
  priority: EmailPriority;
  summary: string;
  reason: string;
  action_required: string;
  deadline: string | null;
  deadline_confidence: DeadlineConfidence;
  suggested_action: string;
}

export async function fetchBackendHealth(): Promise<BackendHealth> {
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error('Unable to reach MailBridge AI backend.');
  }
  return (await res.json()) as BackendHealth;
}

export async function analyzeEmailWithGemini(
  email: EmailMessage,
  preferences?: Pick<UserPreferences, 'focusCategories' | 'prioritySenders' | 'sensitivity'>
): Promise<AnalyzedEmailResponse> {
  const res = await fetch('/api/ai/analyze-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messageId: email.messageId,
      senderName: email.senderName,
      senderEmail: email.senderEmail,
      subject: email.subject,
      bodyText: email.bodyText,
      receivedAt: email.receivedAt,
      userPreferences: {
        focusCategories: preferences?.focusCategories ?? [],
        prioritySenders: preferences?.prioritySenders ?? [],
        sensitivity: (preferences?.sensitivity ?? 'balanced') as SensitivityMode,
      },
    }),
  });

  const data = (await res.json()) as { analysis?: AnalyzedEmailResponse; error?: string };
  if (!res.ok || !data.analysis) {
    throw new Error(data.error || 'Gemini email analysis failed.');
  }
  return data.analysis;
}

export async function verifyWhatsAppRecipient(phoneNumber: string): Promise<{
  configured: boolean;
  status: 'verified' | 'unconfigured' | 'failed';
  error?: string;
}> {
  const res = await fetch('/api/notifications/whatsapp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber }),
  });
  const data = await res.json();
  return {
    configured: Boolean(data.configured),
    status: data.status || (res.ok ? 'verified' : 'failed'),
    error: data.error,
  };
}

export async function sendWhatsAppUrgentAlert(payload: {
  phoneNumber: string;
  senderName: string;
  subject: string;
  summary: string;
  actionRequired: string;
  priority: 'urgent' | 'important';
}): Promise<{
  configured: boolean;
  status: 'sent' | 'unconfigured' | 'failed';
  error?: string;
}> {
  const res = await fetch('/api/notifications/whatsapp/send-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return {
    configured: Boolean(data.configured),
    status: data.status || (res.ok ? 'sent' : 'failed'),
    error: data.error,
  };
}

export function isWithinQuietHours(prefs: Pick<UserPreferences, 'quietHoursEnabled' | 'quietHoursStart' | 'quietHoursEnd'>): boolean {
  if (!prefs.quietHoursEnabled) return false;
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const [sh, sm] = prefs.quietHoursStart.split(':').map(Number);
  const [eh, em] = prefs.quietHoursEnd.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;

  if (startMins <= endMins) {
    return currentMins >= startMins && currentMins < endMins;
  }
  // Overnight quiet hours e.g. 22:00 to 07:00
  return currentMins >= startMins || currentMins < endMins;
}

export async function triggerBrowserUrgentNotification(
  title: string,
  body: string
): Promise<'sent' | 'failed'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'failed';
  }
  try {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
      return 'sent';
    }
    return 'failed';
  } catch {
    return 'failed';
  }
}
