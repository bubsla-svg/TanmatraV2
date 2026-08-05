"use client";

import React from 'react';
import Link from 'next/link';

export default function BillingClient() {
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
                        <div className="font-display text-5xl md:text-6xl text-[#d4af37] tabular-nums mb-6">₹340</div>
                        <p className="font-body-md text-[#5C6367] max-w-md mx-auto">
                            Applied automatically at checkout. Use the <Link href="/account/billing" className="text-[#d4af37] hover:underline underline-offset-4">wallet page</Link> to redeem a voucher.
                        </p>
                    </div>
                </section>

                {/* Credit Activity Section */}
                <section className="mb-16">
                    <h3 className="font-headline-md text-[#1A1C1E] mb-6">Credit activity</h3>
                    <div className="bg-white rounded-xl border border-[#E7E3DA] overflow-hidden">
                        
                        {/* Row 1 */}
                        <div className="flex items-center justify-between p-4 md:p-6 border-b border-[#E7E3DA] last:border-b-0 hover:bg-[#FBFAF7] transition-colors">
                            <div>
                                <div className="font-body-md text-[#1A1C1E] font-medium">Referral bonus</div>
                                <div className="font-label-caps text-[#5C6367] mt-1">Oct 24, 2023</div>
                            </div>
                            <div className="font-data-md text-[#7D9E7E] tabular-nums">+₹50</div>
                        </div>
                        
                        {/* Row 2 */}
                        <div className="flex items-center justify-between p-4 md:p-6 border-b border-[#E7E3DA] last:border-b-0 hover:bg-[#FBFAF7] transition-colors">
                            <div>
                                <div className="font-body-md text-[#1A1C1E] font-medium">Plan adjustment credit</div>
                                <div className="font-label-caps text-[#5C6367] mt-1">Oct 20, 2023</div>
                            </div>
                            <div className="font-data-md text-[#7D9E7E] tabular-nums">+₹50</div>
                        </div>

                        {/* Row 3 */}
                        <div className="flex items-center justify-between p-4 md:p-6 border-b border-[#E7E3DA] last:border-b-0 hover:bg-[#FBFAF7] transition-colors">
                            <div>
                                <div className="font-body-md text-[#1A1C1E] font-medium">Standard meal purchase</div>
                                <div className="font-label-caps text-[#5C6367] mt-1">Oct 18, 2023</div>
                            </div>
                            <div className="font-data-md text-[#5C6367] tabular-nums">−₹20</div>
                        </div>

                        {/* Row 4 */}
                        <div className="flex items-center justify-between p-4 md:p-6 border-b border-[#E7E3DA] last:border-b-0 hover:bg-[#FBFAF7] transition-colors">
                            <div>
                                <div className="font-body-md text-[#1A1C1E] font-medium">Beta tester reward</div>
                                <div className="font-label-caps text-[#5C6367] mt-1">Oct 15, 2023</div>
                            </div>
                            <div className="font-data-md text-[#7D9E7E] tabular-nums">+₹50</div>
                        </div>

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
