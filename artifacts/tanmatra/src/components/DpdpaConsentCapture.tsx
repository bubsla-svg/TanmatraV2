import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Lock,
  Sparkles,
  Megaphone,
  Clock,
  CheckCircle2,
  Heart,
} from "lucide-react";

export interface DpdpaConsentState {
  purposeClinicalDelivery: boolean;
  purposeMarketing: boolean;
  purposeAiPersonalization: boolean;
  purposeHealthDataProcessing: boolean;
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
  const [purposeHealthDataProcessing, setPurposeHealthDataProcessing] =
    useState<boolean>(initialState?.purposeHealthDataProcessing ?? false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(
    initialState?.grantedAt ?? null,
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (initialState) {
      if (initialState.purposeMarketing !== undefined) {
        setPurposeMarketing(initialState.purposeMarketing);
      }
      if (initialState.purposeAiPersonalization !== undefined) {
        setPurposeAiPersonalization(initialState.purposeAiPersonalization);
      }
      if (initialState.purposeHealthDataProcessing !== undefined) {
        setPurposeHealthDataProcessing(initialState.purposeHealthDataProcessing);
      }
      if (initialState.grantedAt !== undefined) {
        setSubmittedAt(initialState.grantedAt);
      }
    }
  }, [initialState]);

  const currentTimestamp = submittedAt ?? new Date().toISOString();

  const handleSave = async () => {
    setIsSubmitting(true);
    const timestamp = new Date().toISOString();
    setSubmittedAt(timestamp);
    const payload: DpdpaConsentState = {
      purposeClinicalDelivery: true,
      purposeMarketing,
      purposeAiPersonalization,
      purposeHealthDataProcessing,
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
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          className="space-y-2"
          style={{ padding: 16, borderBottom: "1px solid var(--ln)" }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 shrink-0" style={{ color: "var(--safb)" }} />
              <div className="h2" style={{ color: "var(--tx)" }}>
                DPDPA 2023 Consent & Privacy Preferences
              </div>
            </div>
            <span className="pill sg">Version {CONSENT_VERSION}</span>
          </div>
          <p className="fine">
            In accordance with India&apos;s Digital Personal Data Protection Act
            (DPDPA) 2023, please review and manage your explicit consent for how
            we process your personal and clinical dietary data.
          </p>
        </div>

        <div className="space-y-5" style={{ padding: 16 }}>
          {/* Purpose 1: Clinical Delivery (Mandatory) */}
          <div
            className="p-4 rounded-xl space-y-3"
            style={{ background: "var(--s2)", border: "1px solid var(--ln)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className="p-2 rounded-lg shrink-0 mt-0.5"
                  style={{ background: "var(--s3)", color: "var(--mut)" }}
                >
                  <Lock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-semibold" style={{ color: "var(--tx)" }}>
                      Clinical Delivery & Order Fulfillment
                    </h4>
                    <span className="pill" style={{ fontSize: 10, textTransform: "uppercase" }}>
                      Mandatory
                    </span>
                  </div>
                  <p className="fine leading-relaxed">
                    Required to process personalized therapeutic meals, verify
                    dietary restrictions and allergen protocols, and coordinate
                    precise rider dispatches under DPDPA Section 6(1).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={true}
                  aria-readonly
                  disabled
                  className="sw on"
                  style={{ opacity: 0.5, pointerEvents: "none" }}
                />
              </div>
            </div>
          </div>

          {/* Purpose 2: AI Personalization & Copilot (Optional) */}
          <div
            className="p-4 rounded-xl space-y-3"
            style={{ background: "var(--s1)", border: "1px solid var(--ln)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className="p-2 rounded-lg shrink-0 mt-0.5"
                  style={{ background: "var(--saged)", color: "var(--sage)" }}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-semibold" style={{ color: "var(--tx)" }}>
                      AI Personalization & Nutrition Copilot
                    </h4>
                    <span className="pill sg" style={{ fontSize: 10, textTransform: "uppercase" }}>
                      Optional Toggle
                    </span>
                  </div>
                  <p className="fine leading-relaxed">
                    Enables our Registered Dietitian AI Copilot and nutritional
                    models to analyze dietary logs and wearable health metrics
                    to generate adaptive meal suggestions.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={purposeAiPersonalization}
                  aria-label="Toggle AI Personalization consent"
                  disabled={isLoading || isSubmitting}
                  className={purposeAiPersonalization ? "sw on" : "sw"}
                  style={
                    isLoading || isSubmitting
                      ? { opacity: 0.5, pointerEvents: "none" }
                      : undefined
                  }
                  onClick={() =>
                    setPurposeAiPersonalization(!purposeAiPersonalization)
                  }
                />
              </div>
            </div>
          </div>

          {/* Purpose 4: Health & Clinical Data Processing (Optional) */}
          <div
            className="p-4 rounded-xl space-y-3"
            style={{ background: "var(--s1)", border: "1px solid var(--ln)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className="p-2 rounded-lg shrink-0 mt-0.5"
                  style={{ background: "var(--saged)", color: "var(--sage)" }}
                >
                  <Heart className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-semibold" style={{ color: "var(--tx)" }}>
                      Health & Clinical Data Processing
                    </h4>
                    <span className="pill sg" style={{ fontSize: 10, textTransform: "uppercase" }}>
                      Optional Toggle
                    </span>
                  </div>
                  <p className="fine leading-relaxed">
                    Allows storage and processing of clinical markers, physical attributes (height, weight, HbA1c, PCOS history), and medical conditions to calculate clinical diet targets.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={purposeHealthDataProcessing}
                  aria-label="Toggle Health Data Processing consent"
                  disabled={isLoading || isSubmitting}
                  className={purposeHealthDataProcessing ? "sw on" : "sw"}
                  style={
                    isLoading || isSubmitting
                      ? { opacity: 0.5, pointerEvents: "none" }
                      : undefined
                  }
                  onClick={() =>
                    setPurposeHealthDataProcessing(!purposeHealthDataProcessing)
                  }
                />
              </div>
            </div>
          </div>

          {/* Purpose 3: Marketing & Offers (Optional) */}
          <div
            className="p-4 rounded-xl space-y-3"
            style={{ background: "var(--s1)", border: "1px solid var(--ln)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className="p-2 rounded-lg shrink-0 mt-0.5"
                  style={{ background: "var(--s3)", color: "var(--mut)" }}
                >
                  <Megaphone className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-semibold" style={{ color: "var(--tx)" }}>
                      Marketing, Offers & Community Challenges
                    </h4>
                    <span className="pill" style={{ fontSize: 10, textTransform: "uppercase" }}>
                      Optional Toggle
                    </span>
                  </div>
                  <p className="fine leading-relaxed">
                    Receive tailored updates, seasonal meal promotions, nutritional
                    challenge reminders, and wellness newsletters via SMS or
                    WhatsApp.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={purposeMarketing}
                  aria-label="Toggle Marketing and Offers consent"
                  disabled={isLoading || isSubmitting}
                  className={purposeMarketing ? "sw on" : "sw"}
                  style={
                    isLoading || isSubmitting
                      ? { opacity: 0.5, pointerEvents: "none" }
                      : undefined
                  }
                  onClick={() => setPurposeMarketing(!purposeMarketing)}
                />
              </div>
            </div>
          </div>

          {/* Timestamp & Audit Footer Info */}
          <div
            className="p-3.5 rounded-lg flex items-center justify-between fine flex-wrap gap-2"
            style={{ background: "var(--s1)", border: "1px solid var(--ln)" }}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" style={{ color: "var(--safb)" }} />
              <span>
                Consent Audit Timestamp:{" "}
                <strong className="mono" style={{ color: "var(--tx)" }}>
                  {currentTimestamp}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: "var(--sage)" }}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>256-bit Envelope Encrypted Storage</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {onCancel && (
              <button
                type="button"
                className={`btn btn-g ${isLoading || isSubmitting ? "dis" : ""}`}
                onClick={onCancel}
                disabled={isLoading || isSubmitting}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              className={`btn btn-p ${isLoading || isSubmitting ? "dis" : ""}`}
              onClick={handleSave}
              disabled={isLoading || isSubmitting}
            >
              {isSubmitting || isLoading ? "Saving Preferences..." : "Save Preferences"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
