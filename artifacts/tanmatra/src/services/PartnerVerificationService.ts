import { AcquisitionContext } from "../domain/types";

export interface PartnerBenefit {
  benefitId: string;
  partnerName: string;
  discountType: "fully-sponsored" | "co-pay-percentage" | "fixed-discount";
  discountValue: number;
  eligiblePlanIds: string[];
}

export class PartnerVerificationService {
  private static validTokens: Record<string, PartnerBenefit> = {
    "token_corp_google": {
      benefitId: "benefit_google_wellness",
      partnerName: "Google Corporate Wellness",
      discountType: "co-pay-percentage",
      discountValue: 50, // 50% co-pay
      eligiblePlanIds: ["glycemic-reset", "cellular-recovery", "microbiome-diversity"],
    },
    "token_gym_cult": {
      benefitId: "benefit_cult_fit",
      partnerName: "Cult.fit Fitness Club",
      discountType: "fixed-discount",
      discountValue: 50000, // Rs 500 off
      eligiblePlanIds: ["glycemic-reset"],
    }
  };

  static verifyToken(token: string): { isValid: boolean; context?: AcquisitionContext; benefit?: PartnerBenefit } {
    const benefit = this.validTokens[token];
    if (!benefit) {
      return { isValid: false };
    }

    const context: AcquisitionContext = {
      sourceType: benefit.partnerName.includes("Corporate") ? "corporate" : "gym",
      sourceId: token,
      verificationStatus: "verified",
      eligibleBenefitIds: [benefit.benefitId],
      returnRoute: "/plans",
    };

    return { isValid: true, context, benefit };
  }
}
