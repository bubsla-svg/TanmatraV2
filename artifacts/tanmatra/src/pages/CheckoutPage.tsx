import React, { useState } from "react";
import { FocusLayout } from "../components/Layouts";
import { PrimaryCTA } from "../components/CTA";
import { PriceDisplay } from "../components/PriceDisplay";
import { ClinicalBadge } from "../components/Badges";
import { StickyLedger } from "../components/StickyLedger";
import { CheckoutService } from "../services/CheckoutService";
import { PricingService } from "../services/PricingService";
import { PlanGenerationService } from "../services/PlanGenerationService";

interface CheckoutPageProps {
  onNavigate: (route: string) => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ onNavigate }) => {
  const [phone, setPhone] = useState("+91 9876543210");
  const [address, setAddress] = useState("Flat 402, Green Acres, Koramangala 4th Block, Bengaluru 560034");
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "netbanking">("upi");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Generate sample valid quote
  const sampleDraft = PlanGenerationService.generateLineup({
    id: "chk_draft_1",
    version: 1,
    type: "recommended",
    currentStage: "checkout",
    servingCount: 1,
    mealSlots: ["lunch"],
    durationDays: 30,
    allergenExclusions: [],
    hardIngredientExclusions: [],
    dislikedIngredients: [],
    generatedMeals: [],
    lockedMealIds: [],
    manuallyReplacedMealIds: [],
    deliveryDates: [],
    entitlementIds: [],
    wearableInfluenceEnabled: false,
    validationErrors: [],
    unsavedChanges: false,
    serviceabilityStatus: "serviceable"
  }, 6);

  const activeQuote = PricingService.generateQuote(sampleDraft);

  const handlePlaceOrder = () => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      // 1. Create idempotent payment attempt
      const idempotencyKey = `tx_${activeQuote.quoteId}_${Date.now()}`;
      const attempt = CheckoutService.createPaymentAttempt(activeQuote, idempotencyKey);

      // 2. Confirm payment and create order
      const order = CheckoutService.confirmPaymentAndCreateOrder(attempt.paymentAttemptId);
      
      setIsProcessing(false);
      onNavigate(`/order/confirmed/${order.orderId}`);
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMsg(err.message || "Failed to process payment attempt.");
    }
  };

  return (
    <FocusLayout 
      title="Secure Subscription Checkout" 
      stepProgress="Final Payment" 
      onBack={() => onNavigate("/plans")}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form Details (Contact, Address, Payment Method) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Verification */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>1. Member Contact Verification</span>
              <ClinicalBadge label="Verified" variant="emerald" />
            </h3>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Delivery Address */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-slate-100">2. Delivery Address</h3>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Payment Method Selection */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-slate-100">3. Payment Gateway Selection</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "upi", label: "Instant UPI / GPay" },
                { id: "card", label: "Credit / Debit Card" },
                { id: "netbanking", label: "NetBanking" }
              ].map(pm => (
                <button
                  key={pm.id}
                  onClick={() => setPaymentMethod(pm.id as any)}
                  className={`p-4 rounded-2xl border text-xs font-bold text-center transition-all min-h-[44px] ${
                    paymentMethod === pm.id
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/40"
                      : "bg-slate-950 text-slate-400 border-slate-800"
                  }`}
                >
                  {pm.label}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
              ⚠️ {errorMsg}
            </div>
          )}
        </div>

        {/* Right Column: Server Quote Breakdown */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl h-fit space-y-4">
          <h3 className="text-base font-bold text-slate-100 border-b border-slate-800 pb-3">
            Authoritative Quote Snapshot
          </h3>

          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>Meal Subtotal ({activeQuote.mealSnapshot.length} slots)</span>
              <PriceDisplay pricePaise={activeQuote.priceBreakdown.mealSubtotalPaise} size="sm" />
            </div>
            <div className="flex justify-between text-emerald-400 font-medium">
              <span>30-Day Plan Discount (20%)</span>
              <span>- {Math.round(activeQuote.priceBreakdown.planDiscountPaise / 100).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span>Packaging & Thermal Insulation</span>
              <PriceDisplay pricePaise={activeQuote.priceBreakdown.packagingFeePaise} size="sm" />
            </div>
            <div className="flex justify-between">
              <span>5% GST (Tax)</span>
              <PriceDisplay pricePaise={activeQuote.priceBreakdown.taxPaise} size="sm" />
            </div>
            <div className="flex justify-between text-emerald-400">
              <span>Delivery Fee</span>
              <span>FREE</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-between items-baseline">
            <span className="text-sm font-bold text-slate-100">Payable Today</span>
            <PriceDisplay pricePaise={activeQuote.priceBreakdown.chargePaise} size="lg" />
          </div>

          <p className="text-[10px] text-slate-500 text-center">
            Idempotency Key Protected • 256-bit SSL Encrypted Payment
          </p>
        </div>
      </div>

      {/* Sticky Ledger */}
      <StickyLedger
        chargePaise={activeQuote.priceBreakdown.chargePaise}
        ctaText={isProcessing ? "Processing Security Payment..." : "Place Order & Activate Plan"}
        onCtaClick={handlePlaceOrder}
        disabled={isProcessing}
      />
    </FocusLayout>
  );
};
