import React from "react";

// For production, this would integrate with Radix Dialog or Vaul.
// This is the semantic primitive contract.
interface OverlayProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<OverlayProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Sheet Content */}
      <div className="relative bg-[#171717] w-full rounded-t-3xl border-t border-white/10 shadow-2xl pb-safe flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom">
        <div className="flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 bg-white/10 rounded-full" />
        </div>
        <div className="px-6 pb-4 pt-2 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#F5F5F4] tracking-tight">{title}</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-[#A3A3A3] hover:text-[#F5F5F4] active:scale-95 transition-all">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export const Modal: React.FC<OverlayProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-[#171717] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#F5F5F4] tracking-tight">{title}</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-[#A3A3A3] hover:text-[#F5F5F4] active:scale-95 transition-all">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};
