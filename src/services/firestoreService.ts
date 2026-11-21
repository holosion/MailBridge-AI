import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  AlertLog,
  DeadlineReminder,
  EmailInsightRecord,
  UserPreferences,
  UserProfile,
  WhatsAppConfig,
} from '../types/mailbridge';

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || 'unknown_id';
}

function clampStr(val: string | null | undefined, max: number): string {
  return String(val ?? '').slice(0, max);
}

export async function ensureUserProfile(
  uid: string,
  email: string,
  displayName: string
): Promise<UserProfile> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    const initial: UserProfile = {
      uid,
      email: clampStr(email, 320),
      displayName: clampStr(displayName, 120),
      onboardingCompleted: false,
      gmailConnected: false,
      aiConsentGranted: false,
      darkMode: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, initial);
    return initial;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfileFields(
  uid: string,
  patch: Partial<
    Pick<
      UserProfile,
      'displayName' | 'onboardingCompleted' | 'gmailConnected' | 'aiConsentGranted' | 'darkMode'
    >
  >
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function ensureUserPreferences(uid: string): Promise<UserPreferences> {
  const path = `users/${uid}/preferences/settings`;
  const ref = doc(db, 'users', uid, 'preferences', 'settings');
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserPreferences;
    }
    const defaults: UserPreferences = {
      uid,
      focusCategories: ['university', 'jobs', 'work', 'security'],
      prioritySenders: [],
      sensitivity: 'balanced',
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      pushAlertsEnabled: true,
      whatsappAlertsEnabled: false,
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, defaults);
    return defaults;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveUserPreferences(
  uid: string,
  prefs: Omit<UserPreferences, 'uid' | 'updatedAt'>
): Promise<void> {
  const path = `users/${uid}/preferences/settings`;
  const ref = doc(db, 'users', uid, 'preferences', 'settings');
  const payload: UserPreferences = {
    uid,
    focusCategories: prefs.focusCategories.slice(0, 10).map((c) => clampStr(c, 64)),
    prioritySenders: prefs.prioritySenders.slice(0, 25).map((s) => clampStr(s, 320)),
    sensitivity: prefs.sensitivity,
    quietHoursEnabled: Boolean(prefs.quietHoursEnabled),
    quietHoursStart: /^\d{2}:\d{2}$/.test(prefs.quietHoursStart) ? prefs.quietHoursStart : '22:00',
    quietHoursEnd: /^\d{2}:\d{2}$/.test(prefs.quietHoursEnd) ? prefs.quietHoursEnd : '07:00',
    pushAlertsEnabled: Boolean(prefs.pushAlertsEnabled),
    whatsappAlertsEnabled: Boolean(prefs.whatsappAlertsEnabled),
    updatedAt: serverTimestamp(),
  };
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        focusCategories: payload.focusCategories,
        prioritySenders: payload.prioritySenders,
        sensitivity: payload.sensitivity,
        quietHoursEnabled: payload.quietHoursEnabled,
        quietHoursStart: payload.quietHoursStart,
        quietHoursEnd: payload.quietHoursEnd,
        pushAlertsEnabled: payload.pushAlertsEnabled,
        whatsappAlertsEnabled: payload.whatsappAlertsEnabled,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function ensureWhatsAppConfig(uid: string): Promise<WhatsAppConfig> {
  const path = `users/${uid}/whatsapp/config`;
  const ref = doc(db, 'users', uid, 'whatsapp', 'config');
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as WhatsAppConfig;
    }
    const defaults: WhatsAppConfig = {
      uid,
      phoneNumber: '',
      verified: false,
      verificationStatus: 'unconfigured',
      optInGranted: false,
      lastTestStatus: 'Not configured',
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, defaults);
    return defaults;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveWhatsAppConfig(
  uid: string,
  config: Omit<WhatsAppConfig, 'uid' | 'updatedAt'>
): Promise<void> {
  const path = `users/${uid}/whatsapp/config`;
  const ref = doc(db, 'users', uid, 'whatsapp', 'config');
  const payload: WhatsAppConfig = {
    uid,
    phoneNumber: clampStr(config.phoneNumber, 24),
    verified: Boolean(config.verified),
    verificationStatus: config.verificationStatus,
    optInGranted: Boolean(config.optInGranted),
    lastTestStatus: clampStr(config.lastTestStatus, 200),
    updatedAt: serverTimestamp(),
  };
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        phoneNumber: payload.phoneNumber,
        verified: payload.verified,
        verificationStatus: payload.verificationStatus,
        optInGranted: payload.optInGranted,
        lastTestStatus: payload.lastTestStatus,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertEmailInsight(
  uid: string,
  insight: Omit<EmailInsightRecord, 'uid' | 'analyzedAt' | 'updatedAt'>
): Promise<void> {
  const safeMsgId = sanitizeId(insight.messageId);
  const path = `users/${uid}/emailInsights/${safeMsgId}`;
  const ref = doc(db, 'users', uid, 'emailInsights', safeMsgId);

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        priority: insight.priority,
        summary: clampStr(insight.summary || 'Analyzed', 600),
        reason: clampStr(insight.reason || 'Evaluated by Gemini AI', 400),
        actionRequired: clampStr(insight.actionRequired, 400),
        deadline: clampStr(insight.deadline, 80),
        deadlineConfidence: insight.deadlineConfidence,
        suggestedAction: clampStr(insight.suggestedAction, 300),
        isUnread: Boolean(insight.isUnread),
        updatedAt: serverTimestamp(),
      });
    } else {
      const payload: EmailInsightRecord = {
        uid,
        messageId: safeMsgId,
        threadId: clampStr(insight.threadId || safeMsgId, 128),
        senderName: clampStr(insight.senderName, 160),
        senderEmail: clampStr(insight.senderEmail, 320),
        subject: clampStr(insight.subject, 300),
        snippet: clampStr(insight.snippet, 500),
        receivedAt: clampStr(insight.receivedAt || new Date().toISOString(), 64),
        isUnread: Boolean(insight.isUnread),
        isDemo: Boolean(insight.isDemo),
        priority: insight.priority,
        summary: clampStr(insight.summary || 'Analyzed', 600),
        reason: clampStr(insight.reason || 'Evaluated by Gemini AI', 400),
        actionRequired: clampStr(insight.actionRequired, 400),
        deadline: clampStr(insight.deadline, 80),
        deadlineConfidence: insight.deadlineConfidence,
        suggestedAction: clampStr(insight.suggestedAction, 300),
        actionCompleted: Boolean(insight.actionCompleted),
        reminderCreated: Boolean(insight.reminderCreated),
        analyzedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function toggleActionCompleted(
  uid: string,
  messageId: string,
  completed: boolean
): Promise<void> {
  const safeId = sanitizeId(messageId);
  const path = `users/${uid}/emailInsights/${safeId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'emailInsights', safeId), {
      actionCompleted: completed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createDeadlineReminder(
  uid: string,
  input: { messageId: string; title: string; dueDate: string; notes: string }
): Promise<string> {
  const safeMsgId = sanitizeId(input.messageId);
  const reminderId = sanitizeId(`rem_${safeMsgId}_${Date.now()}`);
  const path = `users/${uid}/reminders/${reminderId}`;

  try {
    const batch = writeBatch(db);
    const remRef = doc(db, 'users', uid, 'reminders', reminderId);
    batch.set(remRef, {
      uid,
      messageId: safeMsgId,
      title: clampStr(input.title, 200),
      dueDate: clampStr(input.dueDate, 80),
      notes: clampStr(input.notes, 400),
      completed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const insightRef = doc(db, 'users', uid, 'emailInsights', safeMsgId);
    const insightSnap = await getDoc(insightRef);
    if (insightSnap.exists()) {
      batch.update(insightRef, {
        reminderCreated: true,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    return reminderId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleReminderCompleted(
  uid: string,
  reminderId: string,
  completed: boolean
): Promise<void> {
  const safeId = sanitizeId(reminderId);
  const path = `users/${uid}/reminders/${safeId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'reminders', safeId), {
      completed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function recordAlertLog(
  uid: string,
  entry: Omit<AlertLog, 'id' | 'uid' | 'createdAt'>
): Promise<void> {
  const safeMsgId = sanitizeId(entry.messageId);
  const alertId = sanitizeId(`alt_${entry.channel}_${safeMsgId}_${Date.now()}`);
  const path = `users/${uid}/alerts/${alertId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'alerts', alertId), {
      uid,
      messageId: safeMsgId,
      channel: entry.channel,
      priority: entry.priority,
      title: clampStr(entry.title, 180),
      body: clampStr(entry.body, 700),
      status: entry.status,
      errorDetail: clampStr(entry.errorDetail, 300),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeUserInsights(
  uid: string,
  onData: (items: EmailInsightRecord[]) => void
) {
  const path = `users/${uid}/emailInsights`;
  const q = query(
    collection(db, 'users', uid, 'emailInsights'),
    where('uid', '==', uid),
    orderBy('analyzedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.data() as EmailInsightRecord));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeUserReminders(
  uid: string,
  onData: (items: DeadlineReminder[]) => void
) {
  const path = `users/${uid}/reminders`;
  const q = query(
    collection(db, 'users', uid, 'reminders'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onData(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as DeadlineReminder),
        }))
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeUserAlerts(uid: string, onData: (items: AlertLog[]) => void) {
  const path = `users/${uid}/alerts`;
  const q = query(
    collection(db, 'users', uid, 'alerts'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onData(
        snapshot.docs.map((d) => {
          const data = d.data() as AlertLog & { createdAt?: { toDate?: () => Date } };
          return {
            id: d.id,
            ...data,
            createdAtIso: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : '',
          };
        })
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function deleteAllUserStoredData(uid: string): Promise<void> {
  const subcollections = ['emailInsights', 'alerts', 'reminders', 'preferences', 'whatsapp'];
  try {
    for (const sub of subcollections) {
      const colRef = collection(db, 'users', uid, sub);
      const snap = await getDocs(query(colRef, where('uid', '==', uid)));
      for (const item of snap.docs) {
        await deleteDoc(item.ref);
      }
    }
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
  }
}
