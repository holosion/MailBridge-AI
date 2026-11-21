export type EmailPriority = 'urgent' | 'important' | 'normal' | 'promotions';
export type DeadlineConfidence = 'explicit' | 'ambiguous' | 'none';
export type SensitivityMode = 'balanced' | 'strict' | 'high_recall';
export type NavTab = 'home' | 'inbox' | 'insights' | 'alerts' | 'settings';

export interface EmailMessage {
  messageId: string;
  threadId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  bodyText: string;
  receivedAt: string;
  isUnread: boolean;
  isDemo: boolean;
  labels: string[];
}

export interface EmailInsightRecord {
  uid: string;
  messageId: string;
  threadId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  isUnread: boolean;
  isDemo: boolean;
  priority: EmailPriority;
  summary: string;
  reason: string;
  actionRequired: string;
  deadline: string;
  deadlineConfidence: DeadlineConfidence;
  suggestedAction: string;
  actionCompleted: boolean;
  reminderCreated: boolean;
  analyzedAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  onboardingCompleted: boolean;
  gmailConnected: boolean;
  aiConsentGranted: boolean;
  darkMode: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserPreferences {
  uid: string;
  focusCategories: string[];
  prioritySenders: string[];
  sensitivity: SensitivityMode;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  pushAlertsEnabled: boolean;
  whatsappAlertsEnabled: boolean;
  updatedAt?: unknown;
}

export interface WhatsAppConfig {
  uid: string;
  phoneNumber: string;
  verified: boolean;
  verificationStatus: 'unconfigured' | 'pending_verification' | 'verified' | 'disabled';
  optInGranted: boolean;
  lastTestStatus: string;
  updatedAt?: unknown;
}

export interface AlertLog {
  id?: string;
  uid: string;
  messageId: string;
  channel: 'push' | 'whatsapp';
  priority: 'urgent' | 'important';
  title: string;
  body: string;
  status: 'queued' | 'sent' | 'failed' | 'skipped_quiet_hours' | 'unconfigured';
  errorDetail: string;
  createdAt?: unknown;
  createdAtIso?: string;
}

export interface DeadlineReminder {
  id?: string;
  uid: string;
  messageId: string;
  title: string;
  dueDate: string;
  notes: string;
  completed: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BackendHealth {
  ok: boolean;
  service: string;
  geminiConfigured: boolean;
  whatsappConfigured: boolean;
  whatsappTemplateName: string;
  timestamp: string;
}

export const FOCUS_CATEGORY_OPTIONS = [
  { id: 'university', label: 'University and education' },
  { id: 'jobs', label: 'Job opportunities' },
  { id: 'work', label: 'Work and business' },
  { id: 'financial', label: 'Financial notices' },
  { id: 'personal', label: 'Personal communications' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'security', label: 'Security notifications' },
] as const;
