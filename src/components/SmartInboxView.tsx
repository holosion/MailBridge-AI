import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Mail,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { PriorityIndicator } from './PriorityBadge';
import type { EmailInsightRecord, EmailMessage, EmailPriority } from '../types/mailbridge';

type InboxFilter = 'all' | 'unread' | EmailPriority;

interface SmartInboxViewProps {
  isDemoMode: boolean;
  gmailConnected: boolean;
  aiConsentGranted: boolean;
  emails: EmailMessage[];
  insightsMap: Record<string, EmailInsightRecord>;
  selectedMessageId: string | null;
  loadingEmails: boolean;
  emailError: string | null;
  analyzingMessageId: string | null;
  onSelectEmail: (messageId: string | null) => void;
  onRefreshInbox: () => void;
  onConnectGmail: () => void;
  onAnalyzeEmail: (email: EmailMessage) => Promise<void>;
  onGrantConsent: () => Promise<void>;
}

export const SmartInboxView: React.FC<SmartInboxViewProps> = ({
  isDemoMode,
  gmailConnected,
  aiConsentGranted,
  emails,
  insightsMap,
  selectedMessageId,
  loadingEmails,
  emailError,
  analyzingMessageId,
  onSelectEmail,
  onRefreshInbox,
  onConnectGmail,
  onAnalyzeEmail,
  onGrantConsent,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');

  const filteredEmails = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return emails.filter((email) => {
      const insight = insightsMap[email.messageId];
      if (filter === 'unread' && !email.isUnread) return false;
      if (
        (filter === 'urgent' ||
          filter === 'important' ||
          filter === 'normal' ||
          filter === 'promotions') &&
        insight?.priority !== filter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        email.subject.toLowerCase().includes(q) ||
        email.senderName.toLowerCase().includes(q) ||
        email.senderEmail.toLowerCase().includes(q) ||
        email.snippet.toLowerCase().includes(q) ||
        (insight?.summary ?? '').toLowerCase().includes(q)
      );
    });
  }, [emails, insightsMap, filter, searchQuery]);

  const selectedEmail =
    emails.find((e) => e.messageId === selectedMessageId) ?? filteredEmails[0] ?? null;
  const selectedInsight = selectedEmail ? insightsMap[selectedEmail.messageId] : undefined;

  if (!isDemoMode && !gmailConnected) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <Mail className="mx-auto h-10 w-10 text-[#174EA6] dark:text-[#00BCD4]" />
        <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          Connect your Gmail inbox
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
          Authorize read-only Gmail access to retrieve your real messages. MailBridge AI never
          simulates Gmail data or modifies your mailbox.
        </p>
        <button
          type="button"
          onClick={onConnectGmail}
          className="mt-6 min-h-[46px] inline-flex items-center gap-2 rounded-xl bg-[#174EA6] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#133f87]"
        >
          Authorize Read-Only Gmail
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Filter Controls */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sender, subject, or AI summary..."
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-[#174EA6] focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={onRefreshInbox}
            disabled={loadingEmails}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <RefreshCw className={`h-4 w-4 ${loadingEmails ? 'animate-spin' : ''}`} />
            {loadingEmails ? 'Syncing...' : 'Refresh Inbox'}
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread' },
              { id: 'urgent', label: 'Urgent' },
              { id: 'important', label: 'Important' },
              { id: 'normal', label: 'Normal' },
              { id: 'promotions', label: 'Promotions' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filter === tab.id
                  ? 'bg-[#174EA6] text-white dark:bg-[#00BCD4] dark:text-slate-950'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {emailError && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <span>{emailError}</span>
          {!isDemoMode && (
            <button
              type="button"
              onClick={onConnectGmail}
              className="min-h-[40px] rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 whitespace-nowrap"
            >
              Reconnect Gmail
            </button>
          )}
        </div>
      )}

      {/* Master-Detail Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Email List Pane */}
        <section
          className={`lg:col-span-5 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden ${
            selectedMessageId ? 'hidden lg:block' : 'block'
          }`}
        >
          {loadingEmails && emails.length === 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 p-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="py-4 animate-pulse space-y-2">
                  <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800/60" />
                </div>
              ))}
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                No matching messages
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Try clearing your search query or switching priority filters.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[72vh] overflow-y-auto">
              {filteredEmails.map((email) => {
                const insight = insightsMap[email.messageId];
                const isSelected = selectedEmail?.messageId === email.messageId;
                return (
                  <button
                    key={email.messageId}
                    type="button"
                    onClick={() => onSelectEmail(email.messageId)}
                    className={`w-full p-4 text-left transition-colors ${
                      isSelected
                        ? 'bg-[#174EA6]/6 dark:bg-[#00BCD4]/10'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {email.isUnread && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-[#174EA6] dark:bg-[#00BCD4]"
                            title="Unread"
                          />
                        )}
                        <span
                          className={`text-xs truncate ${
                            email.isUnread
                              ? 'font-bold text-slate-900 dark:text-white'
                              : 'font-medium text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {email.senderName}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0 tabular-nums">
                        {new Date(email.receivedAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <p
                      className={`mt-1 text-sm line-clamp-1 ${
                        email.isUnread
                          ? 'font-semibold text-slate-900 dark:text-white'
                          : 'font-medium text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {email.subject}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {insight ? insight.summary : email.snippet}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between">
                      <PriorityIndicator priority={insight?.priority} />
                      {insight?.deadline && (
                        <span className="font-mono text-[11px] text-amber-700 dark:text-amber-400">
                          {insight.deadline}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Email Detail + Gemini Intelligence Pane */}
        <section
          className={`lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 ${
            selectedMessageId ? 'block' : 'hidden lg:block'
          }`}
        >
          {!selectedEmail ? (
            <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
              Select a message to read its full content and Gemini AI breakdown.
            </div>
          ) : (
            <div>
              {/* Mobile back button */}
              <button
                type="button"
                onClick={() => onSelectEmail(null)}
                className="mb-4 inline-flex min-h-[40px] items-center gap-1.5 text-xs font-medium text-[#174EA6] dark:text-[#00BCD4] lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Inbox
              </button>

              {/* Email Header */}
              <div className="border-b border-slate-100 pb-5 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <PriorityIndicator priority={selectedInsight?.priority} />
                  <div className="flex items-center gap-2">
                    {!selectedEmail.isDemo && (
                      <a
                        href={`https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(
                          selectedEmail.threadId
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        Open in Gmail
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={analyzingMessageId === selectedEmail.messageId}
                      onClick={() =>
                        aiConsentGranted ? onAnalyzeEmail(selectedEmail) : onGrantConsent()
                      }
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#174EA6] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#133f87] disabled:opacity-60 whitespace-nowrap"
                    >
                      {analyzingMessageId === selectedEmail.messageId ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {analyzingMessageId === selectedEmail.messageId
                        ? 'Analyzing...'
                        : !aiConsentGranted
                          ? 'Consent & Analyze'
                          : selectedInsight
                            ? 'Re-analyze with AI'
                            : 'Analyze with AI'}
                    </button>
                  </div>
                </div>

                <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {selectedEmail.subject}
                </h2>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedEmail.senderName}
                  </span>
                  <span>&lt;{selectedEmail.senderEmail}&gt;</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {new Date(selectedEmail.receivedAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Gemini AI Structured Analysis Section */}
              {selectedInsight && (
                <div className="mt-5 rounded-2xl bg-[#F5F7FB] p-5 dark:bg-slate-950/70">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#174EA6] dark:text-[#00BCD4]">
                      Gemini AI Intelligence
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      ID: <span className="font-mono">{selectedInsight.messageId.slice(0, 12)}</span>
                    </span>
                  </div>

                  <p className="mt-2.5 text-sm leading-relaxed text-slate-900 dark:text-slate-100">
                    {selectedInsight.summary}
                  </p>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200/80 pt-4 text-xs dark:border-slate-800">
                    <div>
                      <p className="font-medium text-slate-500 dark:text-slate-400">
                        Reason for Classification
                      </p>
                      <p className="mt-1 text-slate-800 dark:text-slate-200">
                        {selectedInsight.reason}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-500 dark:text-slate-400">
                        Action Required
                      </p>
                      <p className="mt-1 text-slate-800 dark:text-slate-200">
                        {selectedInsight.actionRequired || 'No immediate action required.'}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-500 dark:text-slate-400">
                        Extracted Deadline
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 font-mono text-slate-800 dark:text-slate-200">
                        <CalendarClock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        {selectedInsight.deadline
                          ? `${selectedInsight.deadline} (${selectedInsight.deadlineConfidence})`
                          : 'No deadline mentioned'}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-500 dark:text-slate-400">
                        Suggested Next Step
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{selectedInsight.suggestedAction}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Full Email Body (Untrusted Plaintext Rendering) */}
              <div className="mt-6">
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  Original Message Content
                </p>
                <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {selectedEmail.bodyText || selectedEmail.snippet}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
