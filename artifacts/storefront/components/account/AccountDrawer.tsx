"use client";

import React, { useState } from "react";

export function AccountDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  // Expose methods via imperative handle or context in a real app,
  // but for Phase 2 scaffolding this establishes the drawer shell.
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="relative w-[85vw] max-w-sm bg-neutral-900 h-full border-l border-white/5 p-6 animate-in slide-in-from-right">
        <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
          <h2 className="text-xl font-bold text-neutral-100">Account</h2>
          <button onClick={() => setIsOpen(false)} className="text-neutral-400 hover:text-neutral-100">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex flex-col gap-4">
          <a href="/account/subscriptions" className="text-neutral-100 font-medium hover:text-yellow-500">Active Subscriptions</a>
          <a href="/account/history" className="text-neutral-100 font-medium hover:text-yellow-500">Order History</a>
          <a href="/account/addresses" className="text-neutral-100 font-medium hover:text-yellow-500">Saved Addresses</a>
        </nav>
      </div>
    </div>
  );
}
