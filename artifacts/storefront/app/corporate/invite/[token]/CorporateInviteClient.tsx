"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CorporateInviteClientProps {
    token: string;
}

export default function CorporateInviteClient({ token }: CorporateInviteClientProps) {
    const router = useRouter();
    const [email, setEmail] = useState('employee@company.com');
    const [isAccepted, setIsAccepted] = useState(false);

    // Benefit resolution
    const isGoogle = token === 'token_corp_google' || token.includes('google');
    const companyName = isGoogle ? 'Google Corporate Wellness' : 'Verified Enterprise Partner';
    const discount = isGoogle ? 50 : 20;

    const handleAccept = () => {
        setIsAccepted(true);
        setTimeout(() => {
            router.push(`/custom-build?partner=${encodeURIComponent(companyName)}&discount=${discount}`);
        }, 800);
    };

    return (
        <div className="bg-[#FBFAF7] min-h-screen flex items-center justify-center p-4 md:p-8 antialiased selection:bg-[#D4AF37] selection:text-[#1A1C1E]">
            <main className="w-full max-w-[440px] flex flex-col items-center">
                {/* Brand / Partner Icon */}
                <div className="mb-6 flex items-center justify-center w-16 h-16 rounded-full bg-white border border-[#E7E3DA] shadow-sm text-[#D4AF37]">
                    <span className="material-symbols-outlined text-3xl">corporate_fare</span>
                </div>

                {/* Header */}
                <div className="text-center mb-6 w-full space-y-1">
                    <span className="font-label-caps text-[10px] text-[#D4AF37] uppercase tracking-widest font-bold">
                        CORPORATE ENTITLEMENT
                    </span>
                    <h1 className="font-headline-md text-2xl md:text-3xl font-bold text-[#1A1C1E]">
                        {companyName}
                    </h1>
                    <p className="font-body-sm text-sm text-[#5C6367]">
                        You&apos;ve been invited to access subsidized metabolic nutrition.
                    </p>
                </div>

                {/* Entitlement Benefit Card */}
                <div className="w-full bg-white border border-[#E7E3DA] rounded-2xl p-5 mb-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-[#E7E3DA] pb-3">
                        <span className="font-body-sm text-xs text-[#5C6367]">Corporate Subsidy</span>
                        <span className="font-data-md text-sm font-bold text-[#4F6B50] bg-[#EBF2EB] px-2.5 py-0.5 rounded-full">
                            {discount}% Employer Sponsored
                        </span>
                    </div>

                    <div className="space-y-1">
                        <label className="font-body-sm text-xs text-[#5C6367] block">Work Email</label>
                        <input 
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E3DA] text-sm text-[#1A1C1E] bg-[#FBFAF7] focus:outline-none focus:border-[#D4AF37]"
                            placeholder="you@company.com"
                        />
                    </div>

                    <div className="bg-[#FBFAF7] p-3 rounded-xl border border-[#E7E3DA] text-xs text-[#5C6367] space-y-1">
                        <span className="font-bold text-[#1A1C1E] block">Program Entitlements:</span>
                        <p>• Daily executive lunch &amp; recovery bowls</p>
                        <p>• On-site kitchen express delivery</p>
                        <p>• 1-on-1 Sports Dietitian review included</p>
                    </div>
                </div>

                {/* Primary Action Button */}
                <button 
                    onClick={handleAccept}
                    disabled={isAccepted}
                    className="w-full bg-[#D4AF37] text-[#1A1C1E] font-label-caps text-xs font-bold py-4 px-6 rounded-full transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                    {isAccepted ? (
                        <>
                            <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                            Activating Subsidy...
                        </>
                    ) : (
                        'Accept & Configure Plan'
                    )}
                </button>

                <p className="font-body-sm text-[11px] text-[#8B9194] text-center mt-4">
                    Authorized token: <span className="font-data-md text-[#1A1C1E]">{token}</span>
                </p>
            </main>
        </div>
    );
}
