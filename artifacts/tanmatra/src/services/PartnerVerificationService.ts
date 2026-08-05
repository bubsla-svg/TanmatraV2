export interface PartnerBenefit {
  partnerName: string;
  discountValue: number;
  subsidyType: "percentage" | "fixed_inr";
  benefitCode: string;
}

export interface VerificationResult {
  isValid: boolean;
  benefit?: PartnerBenefit;
  errorMessage?: string;
}

export const PartnerVerificationService = {
  verifyToken(token: string): VerificationResult {
    if (!token || typeof token !== "string") {
      return { isValid: false, errorMessage: "Missing token" };
    }

    const normalized = token.trim();
    if (normalized === "token_corp_google") {
      return {
        isValid: true,
        benefit: {
          partnerName: "Google Corporate Wellness",
          discountValue: 50,
          subsidyType: "percentage",
          benefitCode: "BEN_GOOG_50",
        },
      };
    }

    if (normalized.startsWith("token_corp_") || normalized.startsWith("token_gym_")) {
      return {
        isValid: true,
        benefit: {
          partnerName: "Verified Partner Program",
          discountValue: 20,
          subsidyType: "percentage",
          benefitCode: "BEN_PARTNER_20",
        },
      };
    }

    return {
      isValid: false,
      errorMessage: "Invalid or expired partner authorization token",
    };
  },
};
