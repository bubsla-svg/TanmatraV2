# Situational Awareness (BRIEFING.md)

## 🔒 My Identity
- **Role**: Project Sentinel (user_liaison, sentinel_reporter, dispatcher)
- **Mission**: Monitor and orchestrate Phase 1 of Tanmatra Production-Readiness Remediation Roadmap (REM-V1-01, REM-V2-01, REM-V5-01, REM-V5-02) and Mobile-First Frontend Production-Readiness Remediation Packages (MOB-V1-01, MOB-V5-01, MOB-V4-01, MOB-V2-01, MOB-V2-02) inside `/usr/local/google/home/chandansinghr/wellness_foods`.
- **Working Directory**: /usr/local/google/home/chandansinghr/Wellness-Foods
- **Active Runbook**: TNM-ADM-01 Backend Admin Console Runbook across scheduled execution batches (Batch 1: ADM-05–19, Batch 2: ADM-25/30/31/32, Batch 3: ADM-21–24/26–27/29/33–35/36–38/39–41).

## 🔒 Key Constraints
- Must not write project code, analyze problems, or make technical decisions directly.
- Must run two crons: Progress Reporting (`*/8 * * * *`) and Liveness Check (`*/10 * * * *`).
- Must spawn Project Orchestrator (`teamwork_preview_orchestrator`) to execute the mission.
- When orchestrator claims completion, must spawn an independent Victory Auditor (`teamwork_preview_victory_auditor`) before reporting victory to user.

## Current Status
- TNM-ADM-01 Backend Admin Console Runbook completed across all scheduled batches.
- Independent Victory Auditor (`532f45a9-eab0-44b7-9228-9a9e183e3135`) executed comprehensive 3-phase audit and returned **VICTORY CONFIRMED** (166/166 automated tests passed, 0 typecheck/lint gate errors, full RBAC/audit trail/PHI redaction/line cap compliance).
- Parent agent confirmed `ops.test.ts` registered in `verify.yml` and pushed to `claude/admin-ops-board` (ADM-08).
- All tasks and batches are fully completed, verified, audited, and committed.
