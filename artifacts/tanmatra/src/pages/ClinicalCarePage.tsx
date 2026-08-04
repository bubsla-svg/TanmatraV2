import React from "react";
import { GlobalLayout } from "../components/Layouts";
import { ClinicalBadge } from "../components/Badges";
import { PrimaryCTA } from "../components/CTA";
import { AccordionItem } from "../components/Accordion";

interface ClinicalCarePageProps {
  onNavigate: (route: string) => void;
}

export const ClinicalCarePage: React.FC<ClinicalCarePageProps> = ({ onNavigate }) => {
  return (
    <GlobalLayout activeTab="plan" currentRoute="/clinical" onNavigate={onNavigate}>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <ClinicalBadge label="Clinical Care & RD Board" variant="emerald" />
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight mt-2">
            Registered Dietitian & Metabolic Care
          </h1>
          <p className="text-xs text-slate-400 mt-1">Outcome-first therapeutic nutrition backed by medical evidence</p>
        </div>

        {/* Outcome First Section */}
        <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl space-y-4">
          <h2 className="text-xl font-bold text-slate-100">Human-Readable Clinical Outcomes</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <span className="text-2xl font-black text-amber-400 block mb-1">HbA1c -0.8%</span>
              <h3 className="text-xs font-bold text-slate-200">Glycemic Stabilization</h3>
              <p className="text-[10px] text-slate-400 mt-1">Average reduction over 60-day therapeutic food protocol</p>
            </div>

            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <span className="text-2xl font-black text-emerald-400 block mb-1">hs-CRP -35%</span>
              <h3 className="text-xs font-bold text-slate-200">Inflammation Reduction</h3>
              <p className="text-[10px] text-slate-400 mt-1">Cellular recovery via polyphenol and omega-3 dense meals</p>
            </div>

            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <span className="text-2xl font-black text-amber-400 block mb-1">98.4%</span>
              <h3 className="text-xs font-bold text-slate-200">Gut Microbiome Safety</h3>
              <p className="text-[10px] text-slate-400 mt-1">Zero allergen cross-contamination compliance</p>
            </div>
          </div>
        </div>

        {/* Progressive Clinical Disclosure Accordions */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-3">
          <h3 className="text-base font-bold text-slate-100 mb-2">Deep Clinical Documentation</h3>
          
          <AccordionItem title="Clinical Evidence & Research References" subtitle="Tap to view medical citations">
            <p className="text-xs text-slate-300 leading-relaxed">
              1. Grounded in ADA 2026 Standards of Medical Care for Glycemic Index Management.<br />
              2. Clinical lipid panel improvement protocol reviewed by Tanmatra Medical Board.
            </p>
          </AccordionItem>

          <AccordionItem title="PHI Privacy & Data Security Assurance" subtitle="HIPAA & DPDPA Compliance">
            <p className="text-xs text-slate-300 leading-relaxed">
              All clinical notes, RD consultation logs, and health connection data are encrypted at rest using AES-256 and strictly isolated from general marketing analytics.
            </p>
          </AccordionItem>
        </div>

        {/* Book RD Consultation CTA */}
        <div className="bg-gradient-to-r from-amber-950/40 to-slate-900 border border-amber-500/30 p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-100">Schedule 1-on-1 Clinical RD Consultation</h3>
            <p className="text-xs text-slate-400 mt-0.5">30-minute video session with a licensed metabolic dietitian</p>
          </div>
          <PrimaryCTA onClick={() => onNavigate("/plans")} className="!px-6 !py-3 text-xs">
            Book Consultation
          </PrimaryCTA>
        </div>
      </div>
    </GlobalLayout>
  );
};
