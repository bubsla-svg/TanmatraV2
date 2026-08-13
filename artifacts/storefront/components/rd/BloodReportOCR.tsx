"use client";
import React, { useState, useEffect } from 'react';
import { UploadCloud, FileText, AlertTriangle, CheckCircle2, Sparkles, Activity, RefreshCw } from 'lucide-react';
import { uploadBloodReportOcr, getPatientBiomarkers, type PatientBiomarkerRecord } from '@/lib/rdBookingApi';

export const BloodReportOCR: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [records, setRecords] = useState<PatientBiomarkerRecord[]>([]);
  const [activeRecord, setActiveRecord] = useState<PatientBiomarkerRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPatientBiomarkers().then((res) => {
      setRecords(res);
      if (res.length > 0) {
        setActiveRecord(res[0]!);
      }
    });
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setScanning(true);
    setError(null);

    try {
      const text = await selectedFile.text().catch(() => "");
      const res = await uploadBloodReportOcr(selectedFile.name, text);
      if (res.biomarkerRecord) {
        setRecords((prev) => [res.biomarkerRecord, ...prev]);
        setActiveRecord(res.biomarkerRecord);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to extract biomarkers from blood report. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Box */}
      <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-line shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <div className="w-10 h-10 rounded-2xl bg-gold/10 text-[var(--gold-text)] flex items-center justify-center font-bold">
            <Activity className="w-5 h-5 text-[var(--danger)]" />
          </div>
          <div>
            <h3 className="text-lg font-black text-ink font-heading">Blood Report Biomarker AI OCR</h3>
            <p className="text-xs text-ink-muted font-medium">
              Upload lab reports (PDF/Image) before your RD consultation for instant AI biomarker parsing.
            </p>
          </div>
        </div>

        <label className="border-2 border-dashed border-line-strong hover:border-[var(--gold)] rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-surface-subtle">
          <UploadCloud className="w-10 h-10 text-[var(--gold-text)] mb-2" />
          <span className="text-xs font-bold text-ink">
            {file ? file.name : "Click or drag blood report PDF / Image to scan"}
          </span>
          <span className="text-3xs text-ink-faint font-medium mt-1">Supports CBC, HbA1c, Lipid Profile, Vitamin D, TSH</span>
          <input type="file" accept="image/*,.pdf,.txt" onChange={handleFileUpload} className="hidden" />
        </label>

        {scanning && (
          <div className="p-4 rounded-2xl bg-gold/10 border border-[var(--gold)]/20 text-[var(--gold-text)] text-xs font-bold flex items-center justify-center gap-3 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-[var(--gold-text)]" />
            <span>AI Multimodal Vision Engine Parsing Biomarkers & Reference Ranges...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-xs font-bold">
            {error}
          </div>
        )}
      </div>

      {/* Extracted Biomarker Report View */}
      {activeRecord && (
        <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-line shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <span className="text-3xs font-black uppercase tracking-wider text-ink-faint">Parsed Medical Report</span>
              <h4 className="text-xl font-black text-ink font-heading">{activeRecord.reportName}</h4>
            </div>

            {activeRecord.flaggedCount > 0 ? (
              <span className="px-3.5 py-1.5 rounded-full bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20 text-xs font-extrabold flex items-center gap-1.5 self-start">
                <AlertTriangle className="w-4 h-4" /> {activeRecord.flaggedCount} Flagged Abnormalities
              </span>
            ) : (
              <span className="px-3.5 py-1.5 rounded-full bg-sage/10 text-sage-text border border-[var(--sage)]/20 text-xs font-extrabold flex items-center gap-1.5 self-start">
                <CheckCircle2 className="w-4 h-4" /> All Normal
              </span>
            )}
          </div>

          {/* AI Clinical Summary */}
          <div className="bg-surface-subtle rounded-2xl p-4 border border-line space-y-1.5">
            <span className="text-xs font-bold text-[var(--gold-text)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--gold-text)]" /> RD Pre-Consult Clinical Summary
            </span>
            <p className="text-xs text-ink-muted font-medium leading-relaxed">
              {activeRecord.summary}
            </p>
          </div>

          {/* Biomarkers Table */}
          <div className="space-y-3">
            <h5 className="text-xs font-black uppercase text-ink-faint tracking-wider">Extracted Biomarker Metrics</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeRecord.biomarkers.map((b, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition-all ${
                    b.isAbnormal
                      ? "bg-[var(--danger)]/5 border-[var(--danger)]/30"
                      : "bg-surface-subtle border-line"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-ink">{b.name}</span>
                    {b.category && (
                      <span className="text-3xs font-extrabold px-2 py-0.5 rounded-md bg-surface-raised text-ink-muted">
                        {b.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <strong
                      className={`text-lg font-black ${
                        b.isAbnormal ? "text-[var(--danger)]" : "text-ink"
                      }`}
                    >
                      {b.value} <span className="text-xs font-normal text-ink-muted">{b.unit}</span>
                    </strong>
                    {b.referenceRange && (
                      <span className="text-3xs font-medium text-ink-faint">Ref: {b.referenceRange}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
