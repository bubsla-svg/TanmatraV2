export interface MealFeedback {
  mealId: string;
  rating: "loved-it" | "good" | "not-for-me";
  reasons: string[];
  submittedAt: string;
}

const feedbackLogs: MealFeedback[] = [];

export const FeedbackService = {
  submitFeedback(mealId: string, rating: "loved-it" | "good" | "not-for-me", reasons: string[] = []): MealFeedback {
    const feedback: MealFeedback = {
      mealId,
      rating,
      reasons,
      submittedAt: new Date().toISOString(),
    };
    feedbackLogs.push(feedback);
    return feedback;
  },

  // Rule 15: Single negative feedback MUST NOT automatically create hard permanent exclusion
  isHardExclusion(_mealId: string): boolean {
    return false;
  },

  getFeedbackHistory(): MealFeedback[] {
    return [...feedbackLogs];
  },
};
