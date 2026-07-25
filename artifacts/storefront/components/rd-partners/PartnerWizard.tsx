"use client";
// Client: interactive application wizard for independent Dietitians and Nutritionists.
import { useState } from "react";

export function PartnerWizard() {
  const [step, setStep] = useState<"info" | "credentials" | "submitted">("info");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    licenseNumber: "",
    specialties: "",
    experienceYears: "5+",
  });

  if (step === "submitted") {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 flex flex-col gap-4 text-center">
        <h2 className="text-xl font-semibold text-ink">Application Submitted</h2>
        <p className="text-sm text-ink-muted leading-relaxed">
          Thank you, Dr. {formData.fullName || "Partner"}. Our Clinical Governance board reviews all credentials within 48 hours. We will contact you at {formData.email || "your email"} regarding network onboarding and portal access.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "info") setStep("credentials");
        else setStep("submitted");
      }}
      className="rounded-xl border border-line bg-surface p-5 flex flex-col gap-5"
    >
      <div className="flex items-center justify-between text-xs font-semibold uppercase text-ink-muted">
        <span>{step === "info" ? "Step 1: Contact Information" : "Step 2: Clinical Credentials"}</span>
        <span>{step === "info" ? "1 of 2" : "2 of 2"}</span>
      </div>

      {step === "info" ? (
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Full Name & Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Dt. Anjali Nair"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink bg-transparent outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Professional Email</label>
            <input
              type="email"
              required
              placeholder="doctor@clinic.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink bg-transparent outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">WhatsApp / Phone Number</label>
            <input
              type="tel"
              required
              placeholder="+91 98765 43210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink bg-transparent outline-none focus:border-gold"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">IDA / Registration License Number</label>
            <input
              type="text"
              required
              placeholder="e.g. RD/DEL/2018/042"
              value={formData.licenseNumber}
              onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink bg-transparent outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Primary Specialties (Diabetes, PCOS, GERD, etc.)</label>
            <input
              type="text"
              required
              placeholder="PCOS, Gestational Diabetes, Gut Health"
              value={formData.specialties}
              onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink bg-transparent outline-none focus:border-gold"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-line">
        {step === "credentials" && (
          <button
            type="button"
            onClick={() => setStep("info")}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface/80 transition-colors"
          >
            Back
          </button>
        )}
        <button
          type="submit"
          className="rounded-xl bg-gold px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gold/90 transition-colors"
        >
          {step === "info" ? "Continue to Credentials" : "Submit Application"}
        </button>
      </div>
    </form>
  );
}
