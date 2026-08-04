import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBloodReportOcr } from "./bloodReportOcr";

test("parseBloodReportOcr extracts biomarkers and highlights abnormal values", async () => {
  const sampleReportText = `
    Patient: John Doe
    HbA1c: 6.5 % (High)
    Fasting Blood Glucose: 115 mg/dL
    Total Cholesterol: 180 mg/dL
    Vitamin D: 18.2 ng/mL
    TSH: 2.1 mIU/L
  `;

  const result = await parseBloodReportOcr("annual_blood_checkup.pdf", sampleReportText);

  assert.equal(result.reportName, "annual_blood_checkup.pdf");
  assert.ok(result.extractedBiomarkers.length > 0);
  assert.ok(result.flaggedCount > 0);
  assert.ok(result.clinicalSummary.includes("abnormal metrics"));

  const hba1c = result.extractedBiomarkers.find((b) => b.name === "HbA1c");
  assert.ok(hba1c);
  assert.equal(hba1c.value, 6.5);
  assert.equal(hba1c.isAbnormal, true);
});
