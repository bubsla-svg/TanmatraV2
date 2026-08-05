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
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-sky-900/10 text-sky-900 dark:text-cyan-400 flex items-center justify-center font-bold">
            <Activity className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white font-heading">Blood Report Biomarker AI OCR</h3>
            <p className="text-xs text-slate-500 font-medium">
              Upload lab reports (PDF/Image) before your RD consultation for instant AI biomarker parsing.
            </p>
          </div>
        </div>

        <label className="border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-sky-900 dark:hover:border-cyan-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-950/50">
          <UploadCloud className="w-10 h-10 text-sky-900 dark:text-cyan-400 mb-2" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {file ? file.name : "Click or drag blood report PDF / Image to scan"}
          </span>
          <span className="text-[10px] text-slate-400 font-medium mt-1">Supports CBC, HbA1c, Lipid Profile, Vitamin D, TSH</span>
          <input type="file" accept="image/*,.pdf,.txt" onChange={handleFileUpload} className="hidden" />
        </label>

        {scanning && (
          <div className="p-4 rounded-2xl bg-sky-900/10 border border-sky-900/20 text-sky-900 dark:text-cyan-400 text-xs font-bold flex items-center justify-center gap-3 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
            <span>AI Multimodal Vision Engine Parsing Biomarkers & Reference Ranges...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold">
            {error}
          </div>
        )}
      </div>

      {/* Extracted Biomarker Report View */}
      {activeRecord && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Parsed Medical Report</span>
              <h4 className="text-xl font-black text-slate-900 dark:text-white font-heading">{activeRecord.reportName}</h4>
            </div>

            {activeRecord.flaggedCount > 0 ? (
              <span className="px-3.5 py-1.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-extrabold flex items-center gap-1.5 self-start">
                <AlertTriangle className="w-4 h-4" /> {activeRecord.flaggedCount} Flagged Abnormalities
              </span>
            ) : (
              <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-extrabold flex items-center gap-1.5 self-start">
                <CheckCircle2 className="w-4 h-4" /> All Normal
              </span>
            )}
          </div>

          {/* AI Clinical Summary */}
          <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <span className="text-xs font-bold text-sky-900 dark:text-cyan-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> RD Pre-Consult Clinical Summary
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
              {activeRecord.summary}
            </p>
          </div>

          {/* Biomarkers Table */}
          <div className="space-y-3">
            <h5 className="text-xs font-black uppercase text-slate-400 tracking-wider">Extracted Biomarker Metrics</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeRecord.biomarkers.map((b, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition-all ${
                    b.isAbnormal
                      ? "bg-rose-500/5 border-rose-500/30"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{b.name}</span>
                    {b.category && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {b.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <strong
                      className={`text-lg font-black ${
                        b.isAbnormal ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {b.value} <span className="text-xs font-normal text-slate-500">{b.unit}</span>
                    </strong>
                    {b.referenceRange && (
                      <span className="text-[10px] font-medium text-slate-400">Ref: {b.referenceRange}</span>
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
