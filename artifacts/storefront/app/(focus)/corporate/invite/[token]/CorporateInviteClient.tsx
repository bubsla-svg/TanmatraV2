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
        <div className="bg-bg min-h-screen flex items-center justify-center p-4 md:p-8 antialiased selection:bg-gold selection:text-ink">
            <main className="w-full max-w-[440px] flex flex-col items-center">
                {/* Brand / Partner Icon */}
                <div className="mb-6 flex items-center justify-center w-16 h-16 rounded-full bg-white border border-line shadow-sm text-gold">
                    <span className="material-symbols-outlined text-3xl">corporate_fare</span>
                </div>

                {/* Header */}
                <div className="text-center mb-6 w-full space-y-1">
                    <span className="font-label-caps text-[10px] text-gold uppercase tracking-widest font-bold">
                        CORPORATE ENTITLEMENT
                    </span>
                    <h1 className="font-headline-md text-2xl md:text-3xl font-bold text-ink">
                        {companyName}
                    </h1>
                    <p className="font-body-sm text-sm text-ink-muted">
                        You&apos;ve been invited to access subsidized metabolic nutrition.
                    </p>
                </div>

                {/* Entitlement Benefit Card */}
                <div className="w-full bg-white border border-line rounded-2xl p-5 mb-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                        <span className="font-body-sm text-xs text-ink-muted">Corporate Subsidy</span>
                        <span className="font-data-md text-sm font-bold text-sage-text bg-sage-soft px-2.5 py-0.5 rounded-full">
                            {discount}% Employer Sponsored
                        </span>
                    </div>

                    <div className="space-y-1">
                        <label className="font-body-sm text-xs text-ink-muted block">Work Email</label>
                        <input 
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-line text-sm text-ink bg-bg focus:outline-none focus:border-gold"
                            placeholder="you@company.com"
                        />
                    </div>

                    <div className="bg-bg p-3 rounded-xl border border-line text-xs text-ink-muted space-y-1">
                        <span className="font-bold text-ink block">Program Entitlements:</span>
                        <p>• Daily executive lunch &amp; recovery bowls</p>
                        <p>• On-site kitchen express delivery</p>
                        <p>• 1-on-1 Sports Dietitian review included</p>
                    </div>
                </div>

                {/* Primary Action Button */}
                <button 
                    onClick={handleAccept}
                    disabled={isAccepted}
                    className="w-full bg-gold text-ink font-label-caps text-xs font-bold py-4 px-6 rounded-full transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
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

                <p className="font-body-sm text-[11px] text-ink-muted text-center mt-4">
                    Authorized token: <span className="font-data-md text-ink">{token}</span>
                </p>
            </main>
        </div>
    );
}
