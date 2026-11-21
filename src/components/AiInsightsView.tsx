import React, { useMemo, useState } from 'react';
import {
  BellPlus,
  CalendarClock,
  CheckCircle2,
  Circle,
  ExternalLink,
  Sparkles,
  X,
} from 'lucide-react';
import { PriorityIndicator } from './PriorityBadge';
import type { DeadlineReminder, EmailInsightRecord } from '../types/mailbridge';

type InsightSegment =
  | 'actions'
  | 'deadlines'
  | 'opportunities'
  | 'high_unread'
  | 'completed';

interface AiInsightsViewProps {
  insights: EmailInsightRecord[];
  reminders: DeadlineReminder[];
  onToggleActionCompleted: (messageId: string, completed: boolean) => Promise<void>;
  onCreateReminder: (input: {
    messageId: string;
    title: string;
    dueDate: string;
    notes: string;
  }) => Promise<void>;
  onToggleReminderCompleted: (reminderId: string, completed: boolean) => Promise<void>;
  onOpenEmail: (messageId: string) => void;
}

export const AiInsightsView: React.FC<AiInsightsViewProps> = ({
  insights,
  reminders,
  onToggleActionCompleted,
  onCreateReminder,
  onToggleReminderCompleted,
  onOpenEmail,
}) => {
  const [segment, setSegment] = useState<InsightSegment>('actions');
  const [draftReminder, setDraftReminder] = useState<{
    messageId: string;
    title: string;
    dueDate: string;
    notes: string;
  } | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);

  const filtered = useMemo(() => {
    switch (segment) {
      case 'actions':
        return insights.filter(
          (i) =>
            !i.actionCompleted &&
            i.actionRequired &&
            !i.actionRequired.toLowerCase().includes('no action') &&
            !i.actionRequired.toLowerCase().includes('no immediate action')
        );
      case 'deadlines':
        return insights.filter((i) => i.deadline && i.deadline.trim().length > 0 && !i.actionCompleted);
      case 'opportunities':
        return insights.filter(
          (i) =>
            !i.actionCompleted &&
            (i.priority === 'important' || i.priority === 'urgent') &&
            /interview|offer|scholarship|fellowship|grant|invitation|opportunity/i.test(
              `${i.subject} ${i.summary} ${i.reason}`
            )
        );
      case 'high_unread':
        return insights.filter(
          (i) => i.isUnread && (i.priority === 'urgent' || i.priority === 'important')
        );
      case 'completed':
        return insights.filter((i) => i.actionCompleted);
    }
  }, [insights, segment]);

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftReminder) return;
    setSavingReminder(true);
    try {
      await onCreateReminder(draftReminder);
      setDraftReminder(null);
    } finally {
      setSavingReminder(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Segmented Navigation */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              AI Insights & Deadlines
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Actionable items, explicit deadlines, and opportunities extracted from your inbox.
            </p>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {(
              [
                { id: 'actions', label: 'Action Required' },
                { id: 'deadlines', label: 'Upcoming Deadlines' },
                { id: 'opportunities', label: 'Opportunities' },
                { id: 'high_unread', label: 'High-Priority Unread' },
                { id: 'completed', label: 'Completed' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSegment(tab.id)}
                className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  segment === tab.id
                    ? 'bg-[#174EA6] text-white dark:bg-[#00BCD4] dark:text-slate-950'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Extracted Email Actions */}
        <section className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white border-b border-slate-100 pb-4 dark:border-slate-800">
            Extracted Email Actions ({filtered.length})
          </h2>

          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                Nothing in this view yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Analyze emails in your Inbox to populate deadlines, opportunities, and action items.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((item) => (
                <div key={item.messageId} className="py-5 flex items-start gap-3.5">
                  <button
                    type="button"
                    onClick={() => onToggleActionCompleted(item.messageId, !item.actionCompleted)}
                    aria-label={
                      item.actionCompleted ? 'Mark action as incomplete' : 'Mark action as completed'
                    }
                    className="mt-0.5 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#174EA6] dark:text-slate-400 dark:hover:text-[#00BCD4]"
                  >
                    {item.actionCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <PriorityIndicator priority={item.priority} />
                      {item.deadline && (
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-amber-700 dark:text-amber-400">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {item.deadline} · {item.deadlineConfidence}
                        </span>
                      )}
                    </div>

                    <p
                      className={`mt-1.5 text-sm font-semibold ${
                        item.actionCompleted
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {item.actionRequired || item.subject}
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{item.summary}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                        {item.senderName}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenEmail(item.messageId)}
                        className="font-medium text-[#174EA6] hover:underline dark:text-[#00BCD4] inline-flex items-center gap-1"
                      >
                        View Email
                        <ExternalLink className="h-3 w-3" />
                      </button>

                      {item.deadline && !item.reminderCreated && !item.actionCompleted && (
                        <button
                          type="button"
                          onClick={() =>
                            setDraftReminder({
                              messageId: item.messageId,
                              title: item.actionRequired || item.subject,
                              dueDate: item.deadline,
                              notes: `From ${item.senderName}: ${item.subject}`,
                            })
                          }
                          className="inline-flex items-center gap-1.5 font-medium text-amber-700 hover:underline dark:text-amber-400"
                        >
                          <BellPlus className="h-3.5 w-3.5" />
                          Create Reminder
                        </button>
                      )}
                      {item.reminderCreated && (
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                          Reminder saved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Saved Reminders */}
        <section className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white border-b border-slate-100 pb-4 dark:border-slate-800">
            Deadline Reminders ({reminders.length})
          </h2>

          {reminders.length === 0 ? (
            <p className="py-8 text-xs text-slate-500 dark:text-slate-400">
              Review any extracted deadline and click “Create Reminder” to track it here.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {reminders.map((rem) => (
                <div key={rem.id} className="py-4 flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => rem.id && onToggleReminderCompleted(rem.id, !rem.completed)}
                    aria-label="Toggle reminder completion"
                    className="mt-0.5 text-slate-500 hover:text-[#174EA6] dark:text-slate-400"
                  >
                    {rem.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${
                        rem.completed
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {rem.title}
                    </p>
                    <p className="mt-1 font-mono text-xs text-amber-700 dark:text-amber-400">
                      Due: {rem.dueDate}
                    </p>
                    {rem.notes && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {rem.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Review & Confirm Reminder Modal */}
      {draftReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveReminder}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Review & Create Reminder
              </h3>
              <button
                type="button"
                onClick={() => setDraftReminder(null)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Reminder title
                </label>
                <input
                  type="text"
                  required
                  value={draftReminder.title}
                  onChange={(e) =>
                    setDraftReminder({ ...draftReminder, title: e.target.value })
                  }
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-[#174EA6] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Extracted due date / deadline
                </label>
                <input
                  type="text"
                  required
                  value={draftReminder.dueDate}
                  onChange={(e) =>
                    setDraftReminder({ ...draftReminder, dueDate: e.target.value })
                  }
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 outline-none focus:border-[#174EA6] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={draftReminder.notes}
                  onChange={(e) =>
                    setDraftReminder({ ...draftReminder, notes: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-[#174EA6] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDraftReminder(null)}
                className="min-h-[42px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingReminder}
                className="min-h-[42px] rounded-xl bg-[#174EA6] px-5 py-2 text-sm font-semibold text-white hover:bg-[#133f87] disabled:opacity-60"
              >
                {savingReminder ? 'Saving...' : 'Save Reminder'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
