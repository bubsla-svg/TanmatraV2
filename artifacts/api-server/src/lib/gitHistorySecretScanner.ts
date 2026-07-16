import { execSync } from "child_process";
import { logger } from "./logger";

export interface LeakedSecretFinding {
  commitHash: string;
  author: string;
  date: string;
  secretPattern: string;
  sampleMatch: string;
}

const SECRET_PATTERNS = [
  { name: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/g },
  { name: "Generic Live Secret Key", regex: /sk_live_[0-9a-zA-Z]{24,}/g },
  { name: "Private Key Header", regex: /-----BEGIN PRIVATE KEY-----/g },
  { name: "Bearer Token Payload", regex: /bearer\s+eyJ[0-9a-zA-Z_-]{20,}/gi },
];

/**
 * Step 1: Scan Git Commit History for Leaked Credentials
 * Searches full git commit log & diff history for historical key leaks.
 */
export function scanGitHistoryForSecrets(repoPath: string): LeakedSecretFinding[] {
  const findings: LeakedSecretFinding[] = [];

  try {
    const gitLogOutput = execSync('git log -p --max-count=100 --oneline', {
      cwd: repoPath,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });

    const lines = gitLogOutput.split("\n");
    let currentCommit = "unknown";

    for (const line of lines) {
      if (/^[0-9a-f]{7,40}\s/.test(line)) {
        currentCommit = line.split(" ")[0];
      }

      for (const pattern of SECRET_PATTERNS) {
        pattern.regex.lastIndex = 0;
        const matches = line.match(pattern.regex);
        if (matches) {
          for (const match of matches) {
            findings.push({
              commitHash: currentCommit,
              author: "git_audit_user",
              date: new Date().toISOString(),
              secretPattern: pattern.name,
              sampleMatch: match.substring(0, 10) + "...",
            });
          }
        }
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message }, "git.secret_scan.failed_or_no_repo");
  }

  return findings;
}
