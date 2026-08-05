"use client";

import React, { useState } from "react";

interface AccordionItemProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({
  title,
  subtitle,
  children,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-line last:border-b-0 py-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left group py-2 focus:outline-none min-h-[44px]"
      >
        <div>
          <h4 className="text-sm font-semibold text-ink-primary group-hover:text-primary transition-colors">
            {title}
          </h4>
          {subtitle && (
            <p className="text-xs text-ink-secondary mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className={`p-2 rounded-lg bg-surface-raised text-ink-muted group-hover:text-primary transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="mt-3 text-xs text-ink-secondary leading-relaxed bg-surface p-4 rounded-xl border border-line">
          {children}
        </div>
      )}
    </div>
  );
};
