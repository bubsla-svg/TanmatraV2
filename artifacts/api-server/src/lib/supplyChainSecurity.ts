import { logger } from "./logger";

/**
 * 3-Tier Supply Chain Security & Prompt Inspection Engine
 * 
 * Tier 1: First-Party Code & AI Generation Safety Verification
 * Tier 2: Vetted Third-Party Package Lock & Dependency Audit
 * Tier 3: Unvetted Community Skill & System Prompt Injection Guard
 */

export interface SupplyChainAuditReport {
  tier1CodeAuditPassed: boolean;
  tier2PackageAuditPassed: boolean;
  tier3PromptAuditPassed: boolean;
  detectedThreats: string[];
  auditedAt: string;
}

const PROMPT_INJECTION_SIGNATURES = [
  /ignore\s+previous\s+instructions/i,
  /ignore\s+above\s+instructions/i,
  /print\s+process\.env/i,
  /exfiltrate/i,
  /dump\s+database/i,
  /reveal\s+secret\s+key/i,
  /system_prompt_override/i,
];

/**
 * Tier 1: Scans first-party code and AI-generated modules for hardcoded secrets & unsafe patterns.
 */
export function auditFirstPartyCode(codeContent: string): { isSafe: boolean; issues: string[] } {
  const issues: string[] = [];

  if (/sk_live_[0-9a-zA-Z]{24,}/.test(codeContent) || /bearer\s+eyJ[0-9a-zA-Z_-]+/i.test(codeContent)) {
    issues.push("Tier 1 Hardcoded Secret Violation: Found raw live API keys or JWT tokens in source");
  }
  if (/eval\(|exec\(/i.test(codeContent)) {
    issues.push("Tier 1 Unsafe Execution Violation: Detected arbitrary string eval/exec execution");
  }

  return { isSafe: issues.length === 0, issues };
}

/**
 * Tier 2: Verifies package lockfile integrity and dependency pinning.
 */
export function auditDependencyManifest(lockfilePresent: boolean, hasWildcardDeps: boolean): { isSafe: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!lockfilePresent) {
    issues.push("Tier 2 Manifest Risk: Lockfile missing, builds are vulnerable to unpinned upstream supply-chain mutations");
  }
  if (hasWildcardDeps) {
    issues.push("Tier 2 Version Risk: Wildcard dependencies found (* / latest), locking is incomplete");
  }

  return { isSafe: issues.length === 0, issues };
}

/**
 * Tier 3: Inspects unvetted community skill definitions (SKILL.md), system instructions, and external prompts for injection threats.
 */
export function auditCommunitySkillPrompt(promptText: string): { isSafe: boolean; threatDetected?: string } {
  for (const pattern of PROMPT_INJECTION_SIGNATURES) {
    if (pattern.test(promptText)) {
      const threat = `Tier 3 Prompt Injection Threat Detected: Pattern '${pattern.source}' matched in community resource!`;
      logger.fatal({ threat, promptPreview: promptText.substring(0, 100) }, "supply_chain.prompt_injection_blocked");
      return { isSafe: false, threatDetected: threat };
    }
  }

  return { isSafe: true };
}

/**
 * Executes full 3-Tier Supply Chain Security Scan
 */
export function executeSupplyChainAudit(params: {
  codeSnippet: string;
  lockfilePresent: boolean;
  hasWildcardDeps: boolean;
  promptText: string;
}): SupplyChainAuditReport {
  const t1 = auditFirstPartyCode(params.codeSnippet);
  const t2 = auditDependencyManifest(params.lockfilePresent, params.hasWildcardDeps);
  const t3 = auditCommunitySkillPrompt(params.promptText);

  const detectedThreats = [
    ...t1.issues,
    ...t2.issues,
    ...(t3.threatDetected ? [t3.threatDetected] : []),
  ];

  return {
    tier1CodeAuditPassed: t1.isSafe,
    tier2PackageAuditPassed: t2.isSafe,
    tier3PromptAuditPassed: t3.isSafe,
    detectedThreats,
    auditedAt: new Date().toISOString(),
  };
}
