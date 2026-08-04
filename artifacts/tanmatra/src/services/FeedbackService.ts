export type FeedbackRating = "loved-it" | "it-was-okay" | "not-for-me";

export type FeedbackReason = 
  | "Taste" 
  | "Portion" 
  | "Spice" 
  | "Texture" 
  | "Too heavy" 
  | "Too light" 
  | "Ingredient" 
  | "Packaging";

export interface MealFeedback {
  feedbackId: string;
  mealId: string;
  rating: FeedbackRating;
  reasons: FeedbackReason[];
  comment?: string;
  submittedAt: string;
}

export class FeedbackService {
  private static feedbackStore: MealFeedback[] = [];

  static submitFeedback(mealId: string, rating: FeedbackRating, reasons: FeedbackReason[], comment?: string): MealFeedback {
    const feedback: MealFeedback = {
      feedbackId: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      mealId,
      rating,
      reasons,
      comment,
      submittedAt: new Date().toISOString(),
    };

    this.feedbackStore.push(feedback);
    return feedback;
  }

  static getFeedbackForMeal(mealId: string): MealFeedback | undefined {
    return this.feedbackStore.find(f => f.mealId === mealId);
  }

  /**
   * Rule 15: Single negative response ("not-for-me") deprioritizes frequency 
   * but MUST NOT automatically become a hard exclusion.
   */
  static isHardExclusion(mealId: string): boolean {
    return false; // Always false; requires explicit user exclusion in profile settings.
  }
}
