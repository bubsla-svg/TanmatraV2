"use client";

import React, { useState } from 'react';
import Link from 'next/link';

export default function LoyaltyClient() {
    const [copied, setCopied] = useState(false);
    const [friendCode, setFriendCode] = useState('');
    const [codeApplied, setCodeApplied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText('TANM4X92');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleApply = (e: React.FormEvent) => {
        e.preventDefault();
        if (friendCode.trim()) {
            setCodeApplied(true);
        }
    };

    return (
        <div className="bg-[#FBFAF7] text-[#1A1C1E] min-h-screen pb-32">
            {/* Top App Bar & Tab Strip */}
            <header className="w-full sticky top-0 bg-[#FBFAF7] z-40 border-b border-[#E7E3DA] pt-4">
                <div className="max-w-[1200px] mx-auto px-4">
                    <div className="flex overflow-x-auto hide-scrollbar w-full whitespace-nowrap space-x-6 h-12 items-center">
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/subscriptions">Plans</Link>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/orders">Orders</Link>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/appointments">Consults</Link>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/billing">Billing</Link>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/addresses">Addresses</Link>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/preferences">Preferences</Link>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/wellness">Health</Link>
                        <li className="relative list-none h-full flex items-center">
                            <Link className="text-sm font-medium text-[#1A1C1E] font-bold" href="/account/loyalty">Rewards</Link>
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#D4AF37]"></div>
                        </li>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/symptoms">Symptoms</Link>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/history">History</Link>
                    </div>
                </div>
            </header>

            <main className="max-w-[600px] mx-auto px-4 mt-8 space-y-8">
                {/* Referral Card */}
                <section className="bg-white rounded-2xl border border-[#E7E3DA] p-6 shadow-sm">
                    <div className="mb-5">
                        <h2 className="font-headline-md text-xl font-bold text-[#1A1C1E] mb-1">Give ₹100, get ₹150</h2>
                        <p className="font-body-md text-[#5C6367]">Invite friends to start their metabolic journey.</p>
                    </div>
                    <div className="flex items-center justify-between bg-[#FBFAF7] rounded-xl border border-[#E7E3DA] p-3 mb-6">
                        <span className="font-data-lg text-lg tracking-[0.2em] text-[#1A1C1E] ml-2 font-medium">TANM4X92</span>
                        <button 
                            onClick={handleCopy}
                            className="bg-[#D4AF37] text-[#1A1C1E] font-body-md text-sm font-bold py-2 px-6 rounded-full hover:opacity-90 transition-opacity"
                        >
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <hr className="border-[#E7E3DA] mb-6"/>
                    <form onSubmit={handleApply} className="mb-6">
                        <label className="block font-body-md text-sm text-[#1A1C1E] font-medium mb-2">Got a friend&apos;s code?</label>
                        <div className="flex space-x-3">
                            <input 
                                className="flex-grow border border-[#E7E3DA] rounded-lg px-4 py-2 font-data-md text-sm focus:outline-none focus:border-[#D4AF37] bg-white text-[#1A1C1E]" 
                                placeholder="Enter code" 
                                type="text"
                                value={friendCode}
                                onChange={(e) => setFriendCode(e.target.value)}
                            />
                            <button type="submit" className="border border-[#E7E3DA] text-[#1A1C1E] font-body-md text-sm font-medium py-2 px-6 rounded-lg hover:bg-[#FBFAF7] transition-colors">Apply</button>
                        </div>
                        {codeApplied && (
                            <p className="text-xs text-[#4F6B50] mt-2 flex items-center gap-1 font-medium">
                                <span className="material-symbols-outlined text-sm">check_circle</span> Code {friendCode} applied successfully!
                            </p>
                        )}
                    </form>
                    <div>
                        <h3 className="font-body-md text-sm text-[#1A1C1E] mb-3 font-semibold">Friends you&apos;ve referred</h3>
                        <div className="space-y-0">
                            <div className="flex justify-between items-center py-3 border-b border-[#E7E3DA]">
                                <span className="font-data-md text-sm text-[#1A1C1E] tabular-nums">Oct 24, 2023</span>
                                <span className="font-body-md text-sm text-[#4F6B50] font-medium">You earned ₹150</span>
                            </div>
                            <div className="flex justify-between items-center py-3">
                                <span className="font-data-md text-sm text-[#1A1C1E] tabular-nums">Oct 18, 2023</span>
                                <span className="font-body-md text-sm text-[#5C6367]">Pending first order</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Plan Rewards Section */}
                <section>
                    <h2 className="font-label-caps text-xs text-[#5C6367] uppercase tracking-wider mb-3 font-bold">PLAN REWARDS</h2>
                    <div className="bg-white rounded-xl border border-[#E7E3DA] p-6 shadow-sm">
                        <h3 className="font-body-lg text-base text-[#1A1C1E] font-semibold mb-2">Weekly · 5 meals / delivery</h3>
                        <div className="font-data-md text-sm text-[#1A1C1E] mb-1 tabular-nums font-medium">12 delivered</div>
                        <p className="font-body-md text-sm text-[#5C6367] mb-4">8 more for a free delivery (₹189)</p>
                        <div className="inline-flex items-center space-x-2 bg-[rgba(125,158,126,0.12)] px-3 py-1.5 rounded-full">
                            <span className="material-symbols-outlined text-[#4F6B50] text-[16px]">check_circle</span>
                            <span className="font-body-md text-xs text-[#4F6B50] font-medium">One-time loyalty bonus earned</span>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
