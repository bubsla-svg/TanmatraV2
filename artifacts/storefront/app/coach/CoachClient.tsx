"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { formatPaise } from '@/lib/format';

interface Message {
    id: string;
    sender: 'user' | 'coach';
    text: string;
    actionCard?: {
        title: string;
        description: string;
        price?: string;
        actionLabel: string;
        actionType: 'consult' | 'suggestion';
    };
}

export default function CoachClient() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            sender: 'coach',
            text: 'Hello! I am your Tanmatra Metabolic Coach. I can help explain dish macros, suggest high-protein swaps, or tune your upcoming meal preferences based on your workout telemetry.'
        },
        {
            id: '2',
            sender: 'user',
            text: 'I ran 10km this morning. What should I eat for lunch to maximize recovery?'
        },
        {
            id: '3',
            sender: 'coach',
            text: 'For a 10km endurance run, prioritizing lean protein with complex prebiotic fiber will replenish glycogen without insulin volatility. I suggest our Wild Salmon Reset Bowl (42g protein, 14g fiber).'
        },
        {
            id: '4',
            sender: 'coach',
            text: 'Here is a suggested meal adjustment for your next scheduled order:',
            actionCard: {
                title: 'Wild Salmon Reset Bowl',
                description: '42g Protein · Cold-Pressed EVOO · Steamed Asparagus',
                price: formatPaise(75000),
                actionLabel: 'Confirm & Apply to Next Week',
                actionType: 'suggestion'
            }
        }
    ]);

    const [input, setInput] = useState('');
    const [confirmedSuggestions, setConfirmedSuggestions] = useState<string[]>([]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            sender: 'user',
            text: input.trim()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');

        // Simulated intelligent coach reply with safeguard
        setTimeout(() => {
            const coachReply: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'coach',
                text: 'Got it. To keep your glucose curve smooth, I recommend increasing daily fiber to 35g. Would you like to review this with an RD or adjust your plan next week?',
                actionCard: {
                    title: '1-on-1 Clinical Dietitian Review',
                    description: 'Have Dr. Ananya Sharma review your macro thresholds.',
                    actionLabel: 'Book 15m Video Session',
                    actionType: 'consult'
                }
            };
            setMessages(prev => [...prev, coachReply]);
        }, 700);
    };

    const handleActionClick = (title: string, actionType: string) => {
        if (actionType === 'suggestion') {
            setConfirmedSuggestions(prev => [...prev, title]);
        }
    };

    return (
        <div className="bg-stone-50 text-neutral-900 h-screen flex flex-col font-body-md overflow-hidden selection:bg-yellow-600 selection:text-neutral-900">
            {/* Header */}
            <header className="w-full bg-stone-50 py-3 px-4 border-b border-stone-200 sticky top-0 z-10 flex items-center justify-between shrink-0 max-w-4xl mx-auto">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-700 animate-pulse"></span>
                        <h1 className="text-lg font-bold text-neutral-900">Metabolic Coach AI</h1>
                    </div>
                    <p className="text-[11px] text-neutral-500">
                        Coach suggestions require your explicit confirmation and never directly modify active orders.
                    </p>
                </div>
                <Link href="/rd" className="text-xs font-bold text-yellow-600 hover:underline shrink-0">
                    Talk to an RD →
                </Link>
            </header>

            {/* Message Thread */}
            <main className="flex-1 overflow-y-auto px-4 py-6 flex flex-col space-y-4 pb-28 w-full max-w-4xl mx-auto">
                {messages.map(msg => (
                    <div
                        key={msg.id}
                        className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} w-full space-y-2`}
                    >
                        <div
                            className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm leading-relaxed ${
                                msg.sender === 'user'
                                    ? 'bg-yellow-600 text-neutral-900 rounded-br-none font-medium shadow-sm'
                                    : 'bg-white border border-stone-200 text-neutral-900 rounded-bl-none shadow-sm'
                            }`}
                        >
                            {msg.text}
                        </div>

                        {/* Interactive Suggestion / Action Card */}
                        {msg.actionCard && (
                            <div className="w-full max-w-[85%] bg-white border border-stone-200 rounded-2xl p-4 shadow-sm space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-headline-md text-sm font-bold text-neutral-900">{msg.actionCard.title}</h4>
                                        <p className="font-body-sm text-xs text-neutral-500 mt-0.5">{msg.actionCard.description}</p>
                                    </div>
                                    {msg.actionCard.price && (
                                        <span className="font-data-md text-sm font-bold text-neutral-900">{msg.actionCard.price}</span>
                                    )}
                                </div>

                                {msg.actionCard.actionType === 'consult' ? (
                                    <Link
                                        href="/account/appointments"
                                        className="inline-flex items-center gap-1 bg-yellow-600 text-neutral-900 font-label-caps text-xs font-bold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
                                    >
                                        {msg.actionCard.actionLabel}
                                        <span className="material-symbols-outlined text-xs">arrow_forward</span>
                                    </Link>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        {confirmedSuggestions.includes(msg.actionCard.title) ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-800 bg-green-50 px-3 py-1.5 rounded-xl">
                                                <span className="material-symbols-outlined text-xs">check_circle</span>
                                                Confirmed for next delivery
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleActionClick(msg.actionCard!.title, msg.actionCard!.actionType)}
                                                className="bg-yellow-600 text-neutral-900 font-label-caps text-xs font-bold px-4 py-2 rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                                            >
                                                {msg.actionCard.actionLabel}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </main>

            {/* Bottom Composer */}
            <footer className="fixed bottom-0 w-full bg-white border-t border-stone-200 px-4 py-3 z-20">
                <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-2 w-full">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask your metabolic coach (e.g. suggest a high-protein dinner swap)..."
                        className="flex-1 bg-stone-50 border border-stone-200 rounded-full py-3 px-5 text-sm text-neutral-900 focus:outline-none focus:border-yellow-600 placeholder:text-neutral-400"
                    />
                    <button
                        type="submit"
                        className="bg-yellow-600 text-neutral-900 font-label-caps text-xs font-bold px-6 h-11 rounded-full hover:opacity-90 active:scale-95 transition-all shrink-0 cursor-pointer"
                    >
                        Send
                    </button>
                </form>
            </footer>
        </div>
    );
}
