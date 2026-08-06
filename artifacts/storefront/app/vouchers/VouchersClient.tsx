"use client";

import React, { useState } from 'react';
import Link from 'next/link';

interface VoucherItem {
    id: string;
    code: string;
    status: string;
    statusColor: string;
    amount: number;
}

export default function VouchersClient() {
    const [balance, setBalance] = useState(150);
    const [code, setCode] = useState('');
    const [redeemedVouchers, setRedeemedVouchers] = useState<VoucherItem[]>([
        { id: '1', code: 'SAVE50', status: 'Redeemed', statusColor: 'text-neutral-400', amount: 50 },
        { id: '2', code: 'WELCOME100', status: 'Redeemed', statusColor: 'text-neutral-400', amount: 100 },
        { id: '3', code: 'NEWYEAR150', status: 'Just added', statusColor: 'text-green-400', amount: 150 },
    ]);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleRedeem = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = code.trim().toUpperCase();
        if (!trimmed) return;

        if (redeemedVouchers.some(v => v.code === trimmed)) {
            setErrorMessage(`Voucher ${trimmed} has already been redeemed.`);
            setSuccessMessage(null);
            return;
        }

        const bonus = 100;
        setBalance(prev => prev + bonus);
        setRedeemedVouchers(prev => [
            { id: Date.now().toString(), code: trimmed, status: 'Just added', statusColor: 'text-green-400', amount: bonus },
            ...prev
        ]);
        setSuccessMessage(`₹${bonus} added to your wallet!`);
        setErrorMessage(null);
        setCode('');
    };

    return (
        <div className="bg-neutral-950 text-stone-200 min-h-screen selection:bg-yellow-400 selection:text-slate-900 flex flex-col pt-8 pb-32">
            <div className="max-w-md mx-auto w-full px-4 space-y-6">
                {/* Header Section */}
                <header className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Link href="/account" className="text-neutral-400 hover:text-stone-200 transition-colors">
                            <span className="material-symbols-outlined text-sm">arrow_back</span>
                        </Link>
                        <h2 className="text-yellow-400 font-label-caps text-xs uppercase tracking-widest font-bold">Wallet</h2>
                    </div>
                    <h1 className="text-stone-200 font-headline-md text-2xl font-semibold tracking-tight">Redeem a voucher</h1>
                    <p className="text-neutral-400 font-body-sm text-sm">Enter your promo code to credit your account wallet.</p>
                </header>

                <main className="space-y-6">
                    {/* Wallet Balance Card */}
                    <section className="bg-neutral-900 border border-white/10 rounded-2xl p-6 flex flex-col gap-2">
                        <span className="text-neutral-400 font-label-caps text-xs uppercase tracking-widest font-bold">Wallet balance</span>
                        <div className="text-stone-200 font-clinical-data text-4xl leading-none tracking-tight font-semibold tabular-nums">
                            ₹{balance}
                        </div>
                    </section>

                    {/* Redeem Card */}
                    <section className="bg-neutral-900 border border-white/10 rounded-2xl p-6 space-y-4">
                        <form onSubmit={handleRedeem} className="space-y-4">
                            <div className="relative">
                                <label className="sr-only" htmlFor="promo-code">Voucher Code</label>
                                <input
                                    className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-stone-200 font-clinical-data uppercase tracking-widest placeholder-neutral-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-colors outline-none text-sm"
                                    id="promo-code"
                                    placeholder="ENTER CODE"
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-yellow-500 text-slate-900 rounded-full py-3.5 font-label-caps text-xs uppercase tracking-widest font-bold hover:opacity-90 active:scale-[0.98] transition-all"
                            >
                                Redeem
                            </button>
                        </form>

                        {/* Success State Indicator */}
                        {successMessage && (
                            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                                <span className="material-symbols-outlined text-green-400 text-lg">check_circle</span>
                                <span className="text-green-400 font-body-sm text-sm">{successMessage}</span>
                            </div>
                        )}

                        {/* Error Indicator */}
                        {errorMessage && (
                            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                                <span className="material-symbols-outlined text-red-600 text-lg">error</span>
                                <span className="text-red-600 font-body-sm text-sm">{errorMessage}</span>
                            </div>
                        )}
                    </section>

                    {/* Vouchers List */}
                    <section className="space-y-3 pt-2">
                        <h3 className="text-neutral-400 font-label-caps text-xs uppercase tracking-widest px-2 font-bold">Your vouchers</h3>
                        <div className="bg-neutral-900 border border-white/10 rounded-2xl divide-y divide-white/10 overflow-hidden">
                            {redeemedVouchers.map((voucher) => (
                                <div key={voucher.id} className="p-4 flex items-center justify-between hover:bg-neutral-800 transition-colors">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-stone-200 font-clinical-data text-sm tracking-wide">{voucher.code}</span>
                                        <span className={`font-body-sm text-xs ${voucher.statusColor}`}>{voucher.status}</span>
                                    </div>
                                    <div className="text-stone-200 font-clinical-data text-sm tabular-nums font-semibold">
                                        ₹{voucher.amount}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
