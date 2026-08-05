"use client";

import React, { useEffect, useState } from "react";

/**
 * DraftRestorationBoundary
 * Recovers an unsaved plan draft (e.g. if the user dropped off before checkout)
 * and prompts them to restore or discard it.
 */
export function DraftRestorationBoundary({ children }: { children: React.ReactNode }) {
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    // Phase 2 check for local draft state
    const draft = localStorage.getItem("tnm_plan_draft");
    if (draft) {
      setHasDraft(true);
    }
  }, []);

  if (hasDraft) {
    return (
      <div className="relative">
        <div className="bg-[#171717] border-b border-white/5 p-4 flex justify-between items-center text-[#F5F5F4]">
          <span className="text-sm font-medium">You have an unsaved plan draft.</span>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                localStorage.removeItem("tnm_plan_draft");
                setHasDraft(false);
              }}
              className="text-sm text-[#A3A3A3] hover:text-[#F5F5F4]"
            >
              Discard
            </button>
            <button className="text-sm text-[#111318] bg-[#D4AF37] px-3 py-1.5 rounded-full font-bold">
              Restore
            </button>
          </div>
        </div>
        {children}
      </div>
    );
  }

  return <>{children}</>;
}
