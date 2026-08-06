"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ChallengeDetailClientProps {
    slug: string;
}

export default function ChallengeDetailClient({ slug }: ChallengeDetailClientProps) {
    const router = useRouter();
    const [isEnrolled, setIsEnrolled] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [feedPosts, setFeedPosts] = useState([
        {
            id: '1',
            author: 'Alex Rivers',
            avatar: 'AR',
            time: '3h ago',
            content: 'Day 3 and feeling much lighter. The wild salmon reset bowl with cold-pressed olive dressing is a metabolic game changer!'
        },
        {
            id: '2',
            author: 'Maria Ross',
            avatar: 'MR',
            time: '1d ago',
            content: 'Prebiotic fiber intake hit 32g today without any afternoon bloat or brain fog. Excited for the live dietitian session on Friday!'
        }
    ]);

    // Format title from slug
    const formattedTitle = slug
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    const handleEnroll = () => {
        setIsEnrolled(true);
        setTimeout(() => {
            router.push(`/plans?challenge=${encodeURIComponent(slug)}`);
        }, 600);
    };

    const handleAddPost = (e: React.FormEvent) => {
        e.preventDefault();
        if (commentText.trim()) {
            setFeedPosts(prev => [
                {
                    id: Date.now().toString(),
                    author: 'You (Cohort Member)',
                    avatar: 'YO',
                    time: 'Just now',
                    content: commentText.trim()
                },
                ...prev
            ]);
            setCommentText('');
        }
    };

    return (
        <div className="bg-gray-50 text-gray-900 min-h-screen pb-32">
            {/* Header */}
            <header className="w-full sticky top-0 bg-gray-50 z-40 border-b border-gray-200 px-4 h-16 flex items-center justify-between max-w-[1200px] mx-auto">
                <Link href="/challenges" className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900">
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    All Challenges
                </Link>
                <div className="flex items-center gap-3">
                    <span className="bg-green-50 text-green-800 text-[10px] font-label-caps font-bold px-2.5 py-1 rounded-full uppercase">
                        218 Cohort Members
                    </span>
                </div>
            </header>

            <main className="max-w-[800px] mx-auto px-4 py-8 space-y-10">
                {/* Hero Banner */}
                <section className="space-y-6">
                    <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-gray-200 shadow-sm bg-gray-200">
                        <img
                            src="https://lh3.googleusercontent.com/aida/AP1WRLumTq0n6IWkUuPlhpimbhO_npxhG-p5Fe_MLMqGImMj2Jz901wzGHzpihSWuno0n_THUTmsSp2ua1pU0Qb-HFNrQkXa_tjE1_eE_f_hTT1lBA8ov_gtWyzzX10tPDfsOBM7OyYELS4m_NN48vJjrOjmgFAww0aQe6FS7Hw9QR0q9IB8cwe17_EHqzUYa7dlK30PtZn9JcSuTmTr6U0VEB_71BgHTc_Rmf6ODAnku0RnRDrpmdwW-cb7baA"
                            alt={formattedTitle}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-label-caps text-yellow-500 font-bold border border-gray-200">
                            COHORT PROTOCOL
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="bg-green-50 text-green-800 px-3 py-1 rounded-full font-label-caps text-xs font-bold">
                                Active Cohort · Starts Monday
                            </span>
                        </div>
                        <h1 className="font-headline-md text-3xl md:text-4xl font-bold text-gray-900">
                            {formattedTitle || '14-Day Fibre & Glycemic Reset'}
                        </h1>
                        <p className="font-body-md text-sm md:text-base text-gray-500 leading-relaxed">
                            A two-week guided protocol designed to systematically reintroduce diverse prebiotic fibers and zero-seed-oil metabolic meals.
                            Curated daily meal kits, weekly live RD Q&amp;A sessions, and cohort accountability.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                        <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-500">Gut Microbiome</span>
                        <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-500">High Prebiotic Fiber</span>
                        <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-500">RD-Guided</span>
                    </div>

                    {/* Enrollment Card */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <span className="font-label-caps text-[10px] text-yellow-500 uppercase tracking-widest font-bold block">JOIN THE COHORT</span>
                            <h3 className="font-headline-md text-base font-bold text-gray-900">Full 14-Day Challenge Kit</h3>
                            <p className="font-body-sm text-xs text-gray-500">Includes 14 daily metabolic meals + 2 live RD sessions</p>
                        </div>
                        <button
                            onClick={handleEnroll}
                            disabled={isEnrolled}
                            className="w-full sm:w-auto bg-yellow-500 text-gray-900 font-label-caps text-xs font-bold px-8 py-3.5 rounded-full hover:opacity-90 active:scale-[0.98] transition-all shadow-sm shrink-0 cursor-pointer"
                        >
                            {isEnrolled ? 'Enrolling & Customizing Plan...' : 'Enroll in Challenge'}
                        </button>
                    </div>
                </section>

                {/* Upcoming Live Sessions */}
                <section className="space-y-4">
                    <h2 className="font-headline-md text-xl font-bold text-gray-900">Upcoming Live RD Check-ins</h2>
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                        <div className="space-y-1">
                            <span className="font-label-caps text-[10px] text-green-800 uppercase font-bold bg-green-50 px-2.5 py-0.5 rounded-full">
                                Video Stream
                            </span>
                            <h3 className="font-headline-md text-base font-bold text-gray-900">Live Q&amp;A — Blunting Postprandial Glucose Spikes</h3>
                            <p className="font-data-md text-xs text-gray-500">Friday, 5:00 PM IST · Host: Dr. Ananya Sharma, RD</p>
                        </div>
                        <Link
                            href="/account/appointments"
                            className="bg-gray-50 border border-gray-200 text-gray-900 font-label-caps text-xs font-bold px-5 py-2.5 rounded-full hover:bg-white transition-colors self-start sm:self-auto"
                        >
                            RSVP Free
                        </Link>
                    </div>
                </section>

                {/* Community Feed */}
                <section className="space-y-6">
                    <h2 className="font-headline-md text-xl font-bold text-gray-900">Cohort Community Feed</h2>

                    {/* Composer */}
                    <form onSubmit={handleAddPost} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
                        <textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Share your daily meal log or ask a question to the cohort..."
                            rows={3}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:border-yellow-500 resize-none"
                        />
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                className="bg-yellow-500 text-gray-900 font-label-caps text-xs font-bold px-5 py-2 rounded-full hover:opacity-90 transition-opacity"
                            >
                                Share Update
                            </button>
                        </div>
                    </form>

                    {/* Feed Posts */}
                    <div className="space-y-4">
                        {feedPosts.map(post => (
                            <div key={post.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center font-bold text-xs text-yellow-500">
                                        {post.avatar}
                                    </div>
                                    <div>
                                        <h4 className="font-headline-md text-xs font-bold text-gray-900">{post.author}</h4>
                                        <span className="font-data-md text-[10px] text-gray-400">{post.time}</span>
                                    </div>
                                </div>
                                <p className="font-body-sm text-xs text-gray-500 leading-relaxed">
                                    {post.content}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
