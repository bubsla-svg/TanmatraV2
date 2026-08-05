"use client";

import React, { useState } from 'react';

export type RatingValue = 'loved-it' | 'good' | 'not-for-me';

export interface FeedbackSubmission {
    mealId: string;
    rating: RatingValue;
    reasons: string[];
    comments?: string;
    isPermanentExclusion: boolean;
}

interface MealFeedbackProps {
    mealId: string;
    mealName: string;
    isOpen: boolean;
    onClose: () => void;
    onSubmit?: (feedback: FeedbackSubmission) => void;
}

const FEEDBACK_REASONS = [
    'Taste',
    'Portion',
    'Spice',
    'Texture',
    'Too heavy',
    'Too light',
    'Ingredient',
    'Packaging'
];

export default function MealFeedback({
    mealId,
    mealName,
    isOpen,
    onClose,
    onSubmit
}: MealFeedbackProps) {
    const [rating, setRating] = useState<RatingValue | null>(null);
    const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
    const [comments, setComments] = useState('');
    const [submitted, setSubmitted] = useState(false);

    if (!isOpen) return null;

    const toggleReason = (reason: string) => {
        setSelectedReasons(prev => 
            prev.includes(reason) 
                ? prev.filter(r => r !== reason)
                : [...prev, reason]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!rating) return;

        // Rule 15: A single negative response must not automatically become a permanent exclusion
        const feedbackPayload: FeedbackSubmission = {
            mealId,
            rating,
            reasons: selectedReasons,
            comments,
            isPermanentExclusion: false // Strictly non-permanent exclusion per Rule 15
        };

        if (onSubmit) {
            onSubmit(feedbackPayload);
        }

        setSubmitted(true);
        setTimeout(() => {
            setSubmitted(false);
            setRating(null);
            setSelectedReasons([]);
            setComments('');
            onClose();
        }, 1500);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#171717] border border-[rgba(255,255,255,0.06)] rounded-3xl p-6 max-w-md w-full text-[#e5e2e1] shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
                <button 
                    onClick={onClose}
                    className="absolute top-5 right-5 text-[#A3A3A3] hover:text-[#e5e2e1] transition-colors"
                >
                    <span className="material-symbols-outlined text-xl">close</span>
                </button>

                {submitted ? (
                    <div className="py-8 text-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-[#7D9E7E]/10 border border-[#7D9E7E]/30 text-[#7D9E7E] flex items-center justify-center mx-auto">
                            <span className="material-symbols-outlined text-2xl">check</span>
                        </div>
                        <h3 className="font-headline-md text-xl font-bold text-[#e5e2e1]">Thank you for your feedback!</h3>
                        <p className="font-body-sm text-xs text-[#A3A3A3]">Your telemetry helps calibrate your metabolic nutrition plan.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <span className="font-label-caps text-xs text-[#f2ca50] uppercase tracking-widest font-bold">MEAL FEEDBACK</span>
                            <h2 className="font-headline-md text-xl font-bold text-[#e5e2e1] mt-1">{mealName}</h2>
                            <p className="font-body-sm text-xs text-[#A3A3A3] mt-1">How was this meal in your dietary protocol?</p>
                        </div>

                        {/* Rating Options */}
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setRating('loved-it')}
                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${rating === 'loved-it' ? 'border-[#f2ca50] bg-[#f2ca50]/10 text-[#f2ca50]' : 'border-[rgba(255,255,255,0.06)] bg-[#201f1f] text-[#A3A3A3] hover:text-[#e5e2e1]'}`}
                            >
                                <span className="material-symbols-outlined text-2xl mb-1" style={{ fontVariationSettings: rating === 'loved-it' ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
                                <span className="font-body-sm text-xs font-medium">Loved it</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setRating('good')}
                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${rating === 'good' ? 'border-[#f2ca50] bg-[#f2ca50]/10 text-[#f2ca50]' : 'border-[rgba(255,255,255,0.06)] bg-[#201f1f] text-[#A3A3A3] hover:text-[#e5e2e1]'}`}
                            >
                                <span className="material-symbols-outlined text-2xl mb-1">thumb_up</span>
                                <span className="font-body-sm text-xs font-medium">It was okay</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setRating('not-for-me')}
                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${rating === 'not-for-me' ? 'border-[#B0655A] bg-[#B0655A]/10 text-[#B0655A]' : 'border-[rgba(255,255,255,0.06)] bg-[#201f1f] text-[#A3A3A3] hover:text-[#e5e2e1]'}`}
                            >
                                <span className="material-symbols-outlined text-2xl mb-1">thumb_down</span>
                                <span className="font-body-sm text-xs font-medium">Not for me</span>
                            </button>
                        </div>

                        {/* Structured Reasons (if selected) */}
                        {rating && (
                            <div className="space-y-2 animate-in fade-in duration-200">
                                <label className="font-label-caps text-xs text-[#A3A3A3] uppercase tracking-wider block">
                                    {rating === 'loved-it' ? 'What stood out?' : 'What could be improved?'}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {FEEDBACK_REASONS.map(reason => {
                                        const active = selectedReasons.includes(reason);
                                        return (
                                            <button
                                                key={reason}
                                                type="button"
                                                onClick={() => toggleReason(reason)}
                                                className={`px-3 py-1.5 rounded-full font-body-sm text-xs transition-all border ${active ? 'border-[#f2ca50] bg-[#f2ca50] text-[#111318] font-semibold' : 'border-[rgba(255,255,255,0.06)] bg-[#201f1f] text-[#e5e2e1] hover:bg-[#2a2a2a]'}`}
                                            >
                                                {reason}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Additional Notes */}
                        {rating && (
                            <div className="space-y-2">
                                <label className="font-label-caps text-xs text-[#A3A3A3] uppercase tracking-wider block">
                                    Additional details (Optional)
                                </label>
                                <textarea
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                    placeholder="Add any specific culinary or clinical notes..."
                                    rows={2}
                                    className="w-full bg-[#0e0e0e] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-xs text-[#e5e2e1] placeholder-[#A3A3A3] focus:outline-none focus:border-[#f2ca50] transition-colors resize-none"
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!rating}
                            className="w-full bg-[#d4af37] text-[#111318] font-label-caps text-xs uppercase tracking-widest font-bold py-3.5 rounded-full hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Submit Feedback
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
