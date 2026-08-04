import React, { useState, useEffect } from "react";
import { B2BLayout } from "../components/Layouts";
import { ClinicalBadge } from "../components/Badges";
import { PrimaryCTA } from "../components/CTA";
import { PartnerVerificationService, PartnerBenefit } from "../services/PartnerVerificationService";

interface CorporateInvitePageProps {
  token?: string;
  onNavigate: (route: string) => void;
}

export const CorporateInvitePage: React.FC<CorporateInvitePageProps> = ({
  token = "token_corp_google",
  onNavigate,
}) => {
  const [benefit, setBenefit] = useState<PartnerBenefit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const res = PartnerVerificationService.verifyToken(token);
    if (res.isValid && res.benefit) {
      setBenefit(res.benefit);
    } else {
      setError("Invalid or expired corporate invitation token.");
    }
  }, [token]);

  const handleClaimBenefit = () => {
    onNavigate("/plans");
  };

  return (
    <B2BLayout companyName={benefit ? benefit.partnerName : "Corporate Care"}>
      <div className="max-w-2xl mx-auto py-8 text-center space-y-6">
        {error ? (
          <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-semibold">
            ⚠️ {error}
          </div>
        ) : benefit && (
          <>
            <ClinicalBadge label="Verified Employee Entitlement" variant="emerald" />
            <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
              Exclusive {benefit.partnerName} Benefit
            </h1>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Your employer sponsors {benefit.discountValue}% co-pay on all Tanmatra therapeutic meal plans.
            </p>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-left space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">Benefit Terms</h3>
              <ul className="text-xs text-slate-300 space-y-2">
                <li>• Applies automatically during checkout</li>
                <li>• Covers 30-day therapeutic meal reset plans</li>
                <li>• Includes free daily morning delivery to office or home</li>
              </ul>
            </div>

            <PrimaryCTA onClick={handleClaimBenefit} className="w-full">
              Claim Benefit & Select Meal Plan
            </PrimaryCTA>
          </>
        )}
      </div>
    </B2BLayout>
  );
};
