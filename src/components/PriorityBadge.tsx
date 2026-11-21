import React from 'react';
import { AlertOctagon, BookmarkCheck, Inbox, Megaphone, Sparkles } from 'lucide-react';
import type { EmailPriority } from '../types/mailbridge';

interface PriorityIndicatorProps {
  priority?: EmailPriority;
}

export const PriorityIndicator: React.FC<PriorityIndicatorProps> = ({ priority }) => {
  if (!priority) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        <span>Not analyzed</span>
      </span>
    );
  }

  switch (priority) {
    case 'urgent':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
          <AlertOctagon className="h-3.5 w-3.5 shrink-0" />
          <span>Urgent</span>
        </span>
      );
    case 'important':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#174EA6] dark:text-[#00BCD4] whitespace-nowrap">
          <BookmarkCheck className="h-3.5 w-3.5 shrink-0" />
          <span>Important</span>
        </span>
      );
    case 'promotions':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
          <Megaphone className="h-3.5 w-3.5 shrink-0" />
          <span>Promotions</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
          <Inbox className="h-3.5 w-3.5 shrink-0" />
          <span>Normal</span>
        </span>
      );
  }
};
