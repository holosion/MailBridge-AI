import React from 'react';
import {
  AlertOctagon,
  ArrowRight,
  Bell,
  CalendarClock,
  Inbox,
  MailCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { PriorityIndicator } from './PriorityBadge';
import type {
  AlertLog,
  EmailInsightRecord,
  EmailMessage,
  NavTab,
} from '../types/mailbridge';

interface HomeDashboardProps {
  displayName: string;
  isDemoMode: boolean;
  gmailConnected: boolean;
  aiConsentGranted: boolean;
  emails: EmailMessage[];
  insightsMap: Record<string, EmailInsightRecord>;
  alerts: AlertLog[];
  analyzingBatch: boolean;
  onNavigate: (tab: NavTab) => void;
  onSelectEmail: (messageId: string) => void;
  onAnalyzeUnprocessed: () => void;
  onConnectGmail: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  displayName,
  isDemoMode,
  gmailConnected,
  aiConsentGranted,
  emails,
  insightsMap,
  alerts,
  analyzingBatch,
  onNavigate,
  onSelectEmail,
  onAnalyzeUnprocessed,
  onConnectGmail,
}) => {
  const insightsList = Object.values(insightsMap);
  const unreadCount = emails.filter((e) => e.isUnread).length;
  const urgentInsights = insightsList.filter((i) => i.priority === 'urgent');
  const importantInsights = insightsList.filter((i) => i.priority === 'important');
  const upcomingDeadlines = insightsList.filter(
    (i) => i.deadline && i.deadline.trim().length > 0 && !i.actionCompleted
  );
  const unprocessedCount = emails.filter((e) => !insightsMap[e.messageId]).length;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = displayName ? displayName.split(' ')[0] : 'there';

  return (
    <div className="space-y-6">
      {/* Header Welcome Strip */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-xs font-medium text-[#174EA6] dark:text-[#00BCD4]">
            {isDemoMode
              ? 'Demo Mode · Sample Inbox'
              : gmailConnected
                ? 'Gmail Connected · Read-Only Sync'
                : 'Gmail Not Connected'}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {emails.length > 0
              ? `Monitoring ${emails.length} recent messages with ${urgentInsights.length} urgent and ${upcomingDeadlines.length} active deadlines.`
              : 'Connect your Gmail account to begin analyzing incoming messages with Gemini AI.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {!isDemoMode && !gmailConnected ? (
            <button
              type="button"
              onClick={onConnectGmail}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#174EA6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#133f87] whitespace-nowrap"
            >
              <Inbox className="h-4 w-4" />
              Connect Gmail
            </button>
          ) : (
            <>
              {unprocessedCount > 0 && aiConsentGranted && (
                <button
                  type="button"
                  onClick={onAnalyzeUnprocessed}
                  disabled={analyzingBatch}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#174EA6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#133f87] disabled:opacity-60 whitespace-nowrap"
                >
                  {analyzingBatch ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {analyzingBatch
                    ? 'Analyzing...'
                    : `Analyze ${Math.min(unprocessedCount, 5)} New`}
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigate('inbox')}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                Open Inbox
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </section>

      {/* 4 KPI Summary Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">Unread Emails</span>
            <MailCheck className="h-4 w-4" />
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {unreadCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-red-600 dark:text-red-400">
            <span className="text-xs font-medium">Urgent Emails</span>
            <AlertOctagon className="h-4 w-4" />
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {urgentInsights.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[#174EA6] dark:text-[#00BCD4]">
            <span className="text-xs font-medium">Important Emails</span>
            <Inbox className="h-4 w-4" />
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {importantInsights.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-medium">Upcoming Deadlines</span>
            <CalendarClock className="h-4 w-4" />
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {upcomingDeadlines.length}
          </p>
        </div>
      </section>

      {/* Main Content Split: Recent AI Summaries + Upcoming Deadlines & Latest Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Recent AI Summaries
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('inbox')}
              className="text-xs font-medium text-[#174EA6] hover:underline dark:text-[#00BCD4]"
            >
              View all in Inbox
            </button>
          </div>

          {insightsList.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                No emails have been analyzed yet.
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Open your Inbox and click “Analyze with AI” on any message or run a batch scan.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {insightsList.slice(0, 5).map((item) => (
                <button
                  key={item.messageId}
                  type="button"
                  onClick={() => onSelectEmail(item.messageId)}
                  className="w-full py-4 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 rounded-lg px-2 -mx-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <PriorityIndicator priority={item.priority} />
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {new Date(item.receivedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                    {item.subject}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {item.summary}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="truncate max-w-[180px]">{item.senderName}</span>
                    {item.deadline && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-amber-700 dark:text-amber-400">
                          Due: {item.deadline}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Upcoming Deadlines
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('insights')}
                className="text-xs font-medium text-[#174EA6] hover:underline dark:text-[#00BCD4]"
              >
                AI Insights
              </button>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <p className="py-6 text-xs text-slate-500 dark:text-slate-400">
                No explicit deadlines extracted yet. Deadlines only appear when stated directly in
                an email.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {upcomingDeadlines.slice(0, 4).map((item) => (
                  <button
                    key={item.messageId}
                    type="button"
                    onClick={() => onSelectEmail(item.messageId)}
                    className="w-full py-3 text-left hover:opacity-80"
                  >
                    <p className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-400">
                      {item.deadline}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white line-clamp-1">
                      {item.actionRequired || item.subject}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                      {item.senderName}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Latest Important Alerts
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('alerts')}
                className="text-xs font-medium text-[#174EA6] hover:underline dark:text-[#00BCD4]"
              >
                Manage Alerts
              </button>
            </div>

            {alerts.length === 0 ? (
              <div className="py-6 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <Bell className="h-4 w-4 shrink-0" />
                <span>Urgent notification dispatches will appear here.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {alerts.slice(0, 3).map((alert) => (
                  <div key={alert.id || `${alert.messageId}_${alert.channel}`} className="py-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">
                        {alert.channel} · {alert.status.replace(/_/g, ' ')}
                      </span>
                      <span className="font-mono text-slate-400 tabular-nums">
                        {alert.createdAtIso
                          ? new Date(alert.createdAtIso).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Just now'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                      {alert.title}
                    </p>
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
