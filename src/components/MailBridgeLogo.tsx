import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Original MailBridge AI emblem combining:
 * 1. An envelope flap & silhouette
 * 2. A structural bridge arch spanning across
 * 3. A subtle AI diamond node at the apex
 */
export const MailBridgeLogo: React.FC<LogoProps> = ({ size = 40, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="MailBridge AI logo"
    >
      <rect width="64" height="64" rx="16" fill="#174EA6" />
      {/* Envelope frame */}
      <rect
        x="12"
        y="19"
        width="40"
        height="27"
        rx="5"
        stroke="#FFFFFF"
        strokeWidth="2.75"
      />
      {/* Envelope flap */}
      <path
        d="M13.5 21.5L32 34.5L50.5 21.5"
        stroke="#FFFFFF"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bridge arch spanning over inbox */}
      <path
        d="M16 44C20 33 44 33 48 44"
        stroke="#00BCD4"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* AI precision apex diamond */}
      <path
        d="M32 10L34.9 14.1L39 17L34.9 19.9L32 24L29.1 19.9L25 17L29.1 14.1L32 10Z"
        fill="#00BCD4"
      />
    </svg>
  );
};

interface GoogleSignInButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onClick,
  disabled = false,
  label = 'Continue with Google',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full min-h-[48px] flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-xs transition-colors hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
    >
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
      <span>{label}</span>
    </button>
  );
};
