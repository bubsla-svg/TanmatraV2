import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Lock,
  Sparkles,
  Megaphone,
  Clock,
  CheckCircle2,
} from "lucide-react";

export interface DpdpaConsentState {
  purposeClinicalDelivery: boolean;
  purposeMarketing: boolean;
  purposeAiPersonalization: boolean;
  consentVersion: string;
  grantedAt: string;
}

export interface DpdpaConsentCaptureProps {
  initialState?: Partial<DpdpaConsentState>;
  onSubmit?: (state: DpdpaConsentState) => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  className?: string;
}

const CONSENT_VERSION = "2023_DPDPA_v1";

export default function DpdpaConsentCapture({
  initialState,
  onSubmit,
  onCancel,
  isLoading = false,
  className = "",
}: DpdpaConsentCaptureProps) {
  const [purposeMarketing, setPurposeMarketing] = useState<boolean>(
    initialState?.purposeMarketing ?? false,
  );
  const [purposeAiPersonalization, setPurposeAiPersonalization] =
    useState<boolean>(initialState?.purposeAiPersonalization ?? false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(
    initialState?.grantedAt ?? null,
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const currentTimestamp = submittedAt ?? new Date().toISOString();

  const handleSave = async () => {
    setIsSubmitting(true);
    const timestamp = new Date().toISOString();
    setSubmittedAt(timestamp);
    const payload: DpdpaConsentState = {
      purposeClinicalDelivery: true,
      purposeMarketing,
      purposeAiPersonalization,
      consentVersion: CONSENT_VERSION,
      grantedAt: timestamp,
    };
    try {
      await onSubmit?.(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="bg-clinical-surface border-clinical-border text-white shadow-lg">
        <CardHeader className="space-y-2 border-b border-clinical-border/50 pb-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-clinical-gold shrink-0" />
              <CardTitle className="font-serif text-xl text-white">
                DPDPA 2023 Consent & Privacy Preferences
              </CardTitle>
            </div>
            <Badge className="bg-clinical-gold/20 text-clinical-gold border border-clinical-gold/30 text-xs px-2.5 py-0.5">
              Version {CONSENT_VERSION}
            </Badge>
          </div>
          <CardDescription className="text-sm text-clinical-zinc">
            In accordance with India&apos;s Digital Personal Data Protection Act
            (DPDPA) 2023, please review and manage your explicit consent for how
            we process your personal and clinical dietary data.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 space-y-5">
          {/* Purpose 1: Clinical Delivery (Mandatory) */}
          <div className="p-4 rounded-xl bg-clinical-surface-elevated/80 border border-clinical-border/80 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-clinical-blue/10 text-clinical-blue shrink-0 mt-0.5">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-semibold text-white">
                      Clinical Delivery & Order Fulfillment
                    </h4>
                    <Badge className="bg-clinical-blue/20 text-clinical-blue border-0 text-[10px] uppercase font-bold tracking-wider">
                      Mandatory
                    </Badge>
                  </div>
                  <p className="text-sm text-clinical-zinc leading-relaxed">
                    Required to process personalized therapeutic meals, verify
                    dietary restrictions and allergen protocols, and coordinate
                    precise rider dispatches under DPDPA Section 6(1).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-1">
                <Switch checked={true} disabled={true} aria-readonly />
              </div>
            </div>
          </div>

          {/* Purpose 2: AI Personalization & Copilot (Optional) */}
          <div className="p-4 rounded-xl bg-clinical-surface-elevated/50 border border-clinical-border/50 space-y-3 transition-colors hover:border-clinical-border">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-clinical-sage/10 text-clinical-sage shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-semibold text-white">
                      AI Personalization & Nutrition Copilot
                    </h4>
                    <Badge className="bg-clinical-sage/20 text-clinical-sage border-0 text-[10px] uppercase tracking-wider">
                      Optional Toggle
                    </Badge>
                  </div>
                  <p className="text-sm text-clinical-zinc leading-relaxed">
                    Enables our Registered Dietitian AI Copilot and nutritional
                    models to analyze dietary logs and wearable health metrics
                    to generate adaptive meal suggestions.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-1">
                <Switch
                  checked={purposeAiPersonalization}
                  onCheckedChange={setPurposeAiPersonalization}
                  disabled={isLoading || isSubmitting}
                  aria-label="Toggle AI Personalization consent"
                />
              </div>
            </div>
          </div>

          {/* Purpose 3: Marketing & Offers (Optional) */}
          <div className="p-4 rounded-xl bg-clinical-surface-elevated/50 border border-clinical-border/50 space-y-3 transition-colors hover:border-clinical-border">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-semibold text-white">
                      Marketing, Offers & Community Challenges
                    </h4>
                    <Badge className="bg-purple-500/20 text-purple-300 border-0 text-[10px] uppercase tracking-wider">
                      Optional Toggle
                    </Badge>
                  </div>
                  <p className="text-sm text-clinical-zinc leading-relaxed">
                    Receive tailored updates, seasonal meal promotions, nutritional
                    challenge reminders, and wellness newsletters via SMS or
                    WhatsApp.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-1">
                <Switch
                  checked={purposeMarketing}
                  onCheckedChange={setPurposeMarketing}
                  disabled={isLoading || isSubmitting}
                  aria-label="Toggle Marketing and Offers consent"
                />
              </div>
            </div>
          </div>

          {/* Timestamp & Audit Footer Info */}
          <div className="p-3.5 rounded-lg bg-clinical-surface border border-clinical-border/60 flex items-center justify-between text-xs text-clinical-zinc flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-clinical-gold shrink-0" />
              <span>
                Consent Audit Timestamp:{" "}
                <strong className="text-white font-mono">
                  {currentTimestamp}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-clinical-sage">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>256-bit Envelope Encrypted Storage</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading || isSubmitting}
                className="border-clinical-border text-clinical-zinc hover:text-white"
              >
                Cancel
              </Button>
            )}
            <Button
              type="button"
              onClick={handleSave}
              disabled={isLoading || isSubmitting}
              className="bg-clinical-gold text-clinical-surface font-semibold hover:bg-clinical-gold/90 px-6"
            >
              {isSubmitting || isLoading ? "Saving Preferences..." : "Save Preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
