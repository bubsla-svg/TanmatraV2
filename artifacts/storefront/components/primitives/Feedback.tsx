import React from "react";
import { PrimaryCTA } from "./CTA";

interface InlineErrorProps {
  message: string;
  className?: string;
}

export const InlineError: React.FC<InlineErrorProps> = ({ message, className = "" }) => {
  if (!message) return null;
  return (
    <div className={`flex items-start gap-2 text-[var(--danger)] bg-[var(--danger)]/10 p-3 rounded-lg border border-[var(--danger)]/20 ${className}`}>
      <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  imageUrl?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  imageUrl,
  className = "",
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto ${className}`}>
      {imageUrl && (
        <div className="w-48 h-48 mb-6 rounded-full overflow-hidden bg-surface border border-white/5 relative">
          <img src={imageUrl} alt="" className="w-full h-full object-cover opacity-80" />
        </div>
      )}
      <h3 className="text-xl font-bold text-ink mb-2">{title}</h3>
      <p className="text-ink-muted mb-8 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <PrimaryCTA onClick={onAction}>{actionLabel}</PrimaryCTA>
      )}
    </div>
  );
};
