"use client";

import React from 'react';
import Link from 'next/link';

export default function AppointmentsClient() {
    return (
        <div className="bg-[#FBFAF7] text-[#1A1C1E] antialiased min-h-screen pb-32">
            {/* Top Navigation Tabs */}
            <div className="sticky top-0 z-10 bg-[#FBFAF7] border-b border-[#E7E3DA]">
                <nav className="flex overflow-x-auto hide-scrollbar px-4">
                    <ul className="flex items-center space-x-6 whitespace-nowrap h-12">
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/subscriptions">Plans</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/orders">Orders</Link></li>
                        <li className="relative">
                            <Link className="font-body-md text-[#1A1C1E] font-semibold py-3 block" href="/account/appointments">Consults</Link>
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#d4af37]"></div>
                        </li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/billing">Billing</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/addresses">Addresses</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/preferences">Preferences</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/wellness">Health</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/loyalty">Rewards</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/symptoms">Symptoms</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/history">History</Link></li>
                    </ul>
                </nav>
            </div>

            {/* Main Content List */}
            <main className="p-4 space-y-4 max-w-md mx-auto pt-6">
                {/* Card 1 */}
                <article className="bg-white rounded-2xl border border-[#E7E3DA] p-4">
                    <header className="flex justify-between items-center mb-3">
                        <span className="font-label-caps text-[#5C6367]">VIDEO CONSULT</span>
                        <span className="bg-[#7D9E7E1F] text-[#7D9E7E] font-label-caps px-3 py-1 rounded-full">Confirmed</span>
                    </header>
                    <div className="mb-4">
                        <p className="font-data-md text-[#1A1C1E] tabular-nums">Thu, 6 Aug, 4:00 PM — 4:30 PM</p>
                    </div>
                    <hr className="border-[#E7E3DA] mb-3" />
                    <footer className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <img alt="Profile photo" className="w-8 h-8 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCK1MiBe2AR6-Z-52nEj3TeL7rLlK6N2REq6O6yOgu_j2DQF4pfyJNM7ZG1obD_IvaFmcRrTyny4CIQz6-l4kYpW6Pb-nUQfkSU42KhHYjZ9yArOA5jnypJTysXey-2LZcHpAXEK4zsO9mzsoi4jdywBEhLSSCtJCAIaWYcfxb4p5iG6TgTzhMsA4UOaVUR4fZx0xBHVLxMY9TJ0ch80aJDX-AL0aUBN5s9z84bKMSDgEmgARQG3h1gPIXT09PSdH7hTJecp2WwfMw" />
                            <span className="font-body-md text-[#5C6367]">Dietitian Specialist: Aanya Kapoor</span>
                        </div>
                        <span className="font-data-md text-[#1A1C1E]">₹499</span>
                    </footer>
                </article>

                {/* Card 2 */}
                <article className="bg-white rounded-2xl border border-[#E7E3DA] p-4">
                    <header className="flex justify-between items-center mb-3">
                        <span className="font-label-caps text-[#5C6367]">VIDEO CONSULT</span>
                        <span className="bg-[#7D9E7E1F] text-[#7D9E7E] font-label-caps px-3 py-1 rounded-full">Confirmed</span>
                    </header>
                    <div className="mb-4">
                        <p className="font-data-md text-[#1A1C1E] tabular-nums">Mon, 10 Aug, 10:00 AM — 10:30 AM</p>
                    </div>
                    <hr className="border-[#E7E3DA] mb-3" />
                    <footer className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <img alt="Profile photo" className="w-8 h-8 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCRqnTAw8s6OrkqGcQgUoyJK99IZePyhSBPfR9H3wkAHpvkeFRx0RjF3rCB6lLiz85VXLK-be2YS2VEw482cz00i0CsS7Zyd-gJmx4G6bIQn0I9ht45CB0qKZf5jsgT3qp5znTwfAyBdhiAEu0VhFGUj5w1qnSktk_MEk9QwzOCALOqBfJ8Fikn_eKkb-G5Pku-iHfnNSEuwbRKKG5frKChokOapUIDKche5G6mpQ16-5uBS0c6cvzXsLzQtdXIKxcysL_IzGbFWX8" />
                            <span className="font-body-md text-[#5C6367]">Metabolic Expert: Dr. Aris Thorne</span>
                        </div>
                        <span className="font-data-md text-[#1A1C1E]">₹499</span>
                    </footer>
                </article>

                {/* Card 3 */}
                <article className="bg-white rounded-2xl border border-[#E7E3DA] p-4">
                    <header className="flex justify-between items-center mb-3">
                        <span className="font-label-caps text-[#5C6367]">VIDEO CONSULT</span>
                        <span className="bg-[#7D9E7E1F] text-[#7D9E7E] font-label-caps px-3 py-1 rounded-full">Confirmed</span>
                    </header>
                    <div className="mb-4">
                        <p className="font-data-md text-[#1A1C1E] tabular-nums">Fri, 14 Aug, 2:00 PM — 2:15 PM</p>
                    </div>
                    <hr className="border-[#E7E3DA] mb-3" />
                    <footer className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <img alt="Profile photo" className="w-8 h-8 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB7FBLWcA3b3XuN8zdXUIddzBuEcNytML6EJdBHqYVNl-Z9N0lBi2aMLXnSoSLqZbUryXcdTYnumy9OG_L88uZO6ZCF_SZOy8ffmMQwc5O0i7Tvjf5YlS7gmlWScMANiC9iayZ-sIgLQneabRILidhSBzeZ9yNGKnU2u6TcqWC13FrFBdbjDlYPnSSSIDqlRSAvczReUjOLDrYTW7RvaSC_r7GnL-Owstj-Z8urVb6oBJ_ffzkGXHymPiE3s5RcnVxVlQvxVyXEboo" />
                            <span className="font-body-md text-[#5C6367]">Intake Specialist: Dr. Sarah Chen</span>
                        </div>
                        <div className="flex items-center space-x-1 border border-[#d4af37] px-2 py-1 rounded-md bg-[#fbf3e5]">
                            <span className="material-symbols-outlined text-[#d4af37] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                            <span className="font-label-caps text-[#d4af37]">Free Intro</span>
                        </div>
                    </footer>
                </article>
            </main>
        </div>
    );
}
