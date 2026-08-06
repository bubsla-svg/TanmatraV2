"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCreditLedger, creditLabel, type CreditLedger } from '@/lib/billingApi';
import { formatPaise } from '@/lib/format';
import { ApiError } from '@/lib/apiClient';
import { PhoneAuth } from '@/components/checkout/PhoneAuth';

/** The wallet is the server's ledger or nothing at all. This surface used to
 *  print a hardcoded "₹340" balance over four invented transactions (dated
 *  Oct 2023) — figures no spine amount produces, shown to the customer as
 *  their real credit. pricingInvariants.test.ts pinned the balance; the rows
 *  were the same lie one level down. One fetch now drives both.
 *  Auth-gated the island way: try the call, render PhoneAuth on 401, never
 *  redirect to /login. */
function useCreditLedger() {
    const [ledger, setLedger] = useState<CreditLedger | null>(null);
    const [needsAuth, setNeedsAuth] = useState(false);
    const [failed, setFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setFailed(false);
        getCreditLedger()
            .then((l) => { if (!cancelled) { setLedger(l); setNeedsAuth(false); } })
            .catch((err: unknown) => {
                if (cancelled) return;
                if (err instanceof ApiError && err.status === 401) setNeedsAuth(true);
                else setFailed(true);
            });
        return () => { cancelled = true; };
    }, [reloadKey]);

    const reload = () => setReloadKey((k) => k + 1);
    return { ledger, needsAuth, failed, reload };
}

const ENTRY_DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function CreditActivity({ ledger }: { ledger: CreditLedger | null }) {
    if (!ledger) return <div className="p-4 md:p-6 font-body-md text-[#5C6367]">Loading activity…</div>;
    if (ledger.entries.length === 0) {
        return <div className="p-4 md:p-6 font-body-md text-[#5C6367]">No credit activity yet.</div>;
    }
    return (
        <>
            {ledger.entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-4 md:p-6 border-b border-[#E7E3DA] last:border-b-0 hover:bg-[#FBFAF7] transition-colors">
                    <div>
                        <div className="font-body-md text-[#1A1C1E] font-medium">{creditLabel(e)}</div>
                        <div className="font-label-caps text-[#5C6367] mt-1">{ENTRY_DATE.format(new Date(e.createdAt))}</div>
                    </div>
                    <div className={`font-data-md tabular-nums ${e.deltaPaise >= 0 ? "text-[#7D9E7E]" : "text-[#5C6367]"}`}>
                        {e.deltaPaise >= 0 ? "+" : "−"}{formatPaise(Math.abs(e.deltaPaise))}
                    </div>
                </div>
            ))}
        </>
    );
}

export default function BillingClient() {
    const { ledger, needsAuth, failed, reload } = useCreditLedger();
    return (
        <div className="bg-[#FBFAF7] text-[#1A1C1E] antialiased min-h-screen pb-32">
            {/* Top Navigation Tabs */}
            <div className="sticky top-0 z-10 bg-[#FBFAF7] border-b border-[#E7E3DA]">
                <nav className="flex overflow-x-auto hide-scrollbar px-4">
                    <ul className="flex items-center space-x-6 whitespace-nowrap h-12">
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/subscriptions">Plans</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/orders">Orders</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/appointments">Consults</Link></li>
                        <li className="relative">
                            <Link className="font-body-md text-[#1A1C1E] font-semibold py-3 block" href="/account/billing">Billing</Link>
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#d4af37]"></div>
                        </li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/addresses">Addresses</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/preferences">Preferences</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/wellness">Health</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/loyalty">Rewards</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/symptoms">Symptoms</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/history">History</Link></li>
                    </ul>
                </nav>
            </div>

            {/* Main Content Canvas */}
            <main className="max-w-[800px] mx-auto px-4 md:px-6 pt-10 md:pt-16">
                
                {/* Hero Wallet Card */}
                <section className="mb-10">
                    <div className="bg-white rounded-xl border border-[#E7E3DA] p-6 md:p-10 text-center flex flex-col items-center justify-center min-h-[240px]">
                        <h2 className="font-label-caps text-[#5C6367] tracking-widest mb-4">WALLET BALANCE</h2>
                        {needsAuth ? (
                            <PhoneAuth startExpanded onVerified={reload} />
                        ) : failed ? (
                            <p className="font-body-md text-[#5C6367] mb-6">
                                Balance unavailable right now.{" "}
                                <button type="button" className="underline underline-offset-4" onClick={reload}>Retry</button>
                            </p>
                        ) : (
                            <div className="font-display text-5xl md:text-6xl text-[#d4af37] tabular-nums mb-6">
                                {ledger === null ? "—" : formatPaise(ledger.balancePaise)}
                            </div>
                        )}
                        <p className="font-body-md text-[#5C6367] max-w-md mx-auto">
                            Applied automatically at checkout. Use the <Link href="/account/billing" className="text-[#d4af37] hover:underline underline-offset-4">wallet page</Link> to redeem a voucher.
                        </p>
                    </div>
                </section>

                {/* Credit Activity Section */}
                <section className="mb-16">
                    <h3 className="font-headline-md text-[#1A1C1E] mb-6">Credit activity</h3>
                    <div className="bg-white rounded-xl border border-[#E7E3DA] overflow-hidden">
                        <CreditActivity ledger={needsAuth || failed ? { entries: [], balancePaise: 0 } : ledger} />
                    </div>
                </section>

                {/* Footnote */}
                <footer className="text-center">
                    <p className="font-label-caps text-[#8B9194]">
                        Looking for receipts or plan billing? Visit <Link className="text-[#d4af37] hover:underline underline-offset-2" href="/account/orders">orders</Link> or <Link className="text-[#d4af37] hover:underline underline-offset-2" href="/account/subscriptions">plans</Link>.
                    </p>
                </footer>
            </main>
        </div>
    );
}
