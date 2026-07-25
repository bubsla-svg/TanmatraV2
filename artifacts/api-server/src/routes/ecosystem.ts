import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuthUser as requireAuth } from "../middlewares/requireAuth";
import {
  encryptClinicalAttribute,
  decryptClinicalAttribute,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  symptomLogsTable,
  communityQaThreadsTable,
  nutritionLogsTable,
  dailyTargetsTable,
  challengesTable,
  challengeMembersTable,
  challengeCheckInsTable,
  usersTable,
} from "@workspace/db";

const router: IRouter = Router();

const SymptomLogSchema = z.object({
  loggedDate: z.string().trim().max(32),
  symptomType: z.string().trim().min(1).max(64),
  severity: z.number().int().min(1).max(5).default(1),
  notes: z.string().max(1000).optional().default(""),
  relatedDishSlug: z.string().max(128).optional().default(""),
});

const QaThreadSchema = z.object({
  questionTitle: z.string().trim().min(5).max(256),
  questionBody: z.string().trim().min(5).max(4000),
  category: z.string().trim().max(64).optional().default("general"),
});

// Feature #10: Symptom Tracker
router.get("/symptom-logs", async (req: Request, res: Response) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  try {
    const rows = await db
      .select()
      .from(symptomLogsTable)
      .where(eq(symptomLogsTable.userId, userId))
      .orderBy(desc(symptomLogsTable.loggedDate));
    // notes is a clinical free-text field, encrypted at rest with the same
    // AES-256-GCM envelope the preferences row uses (CLINICAL_KMS_MASTER_KEY).
    // Decrypt for the owner; tolerate legacy/plaintext rows by passing them
    // through unchanged.
    res.json(
      rows.map((r) => {
        if (!r.notes) return r;
        try {
          return { ...r, notes: decryptClinicalAttribute(r.notes) };
        } catch {
          return r;
        }
      }),
    );
  } catch (e) {
    console.error("Failed to fetch symptom logs:", e);
    res.status(500).json({ error: "Failed to fetch symptom logs" });
  }
});

router.post("/symptom-logs", async (req: Request, res: Response) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const parsed = SymptomLogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Malformed symptom log request body" });
    return;
  }

  const { loggedDate, symptomType, severity, notes, relatedDishSlug } = parsed.data;

  try {
    const [inserted] = await db
      .insert(symptomLogsTable)
      .values({
        userId,
        loggedDate,
        symptomType,
        severity,
        // Free-text symptom notes are patient-authored clinical data — the
        // highest-sensitivity field on this row. Encrypted at rest like every
        // other clinical field in this codebase. (symptom_type remains
        // plaintext: it is a bounded vocabulary in a varchar(64), and moving
        // it under the envelope needs a column-type migration — recorded as a
        // known residual, not silently accepted.)
        notes: notes ? JSON.stringify(encryptClinicalAttribute(notes)) : "",
        relatedDishSlug,
      })
      .returning();
    res.status(201).json({ ...inserted, notes });
  } catch (e) {
    console.error("Failed to insert symptom log:", e);
    res.status(500).json({ error: "Failed to log symptom" });
  }
});

// Feature #5: Community Q&A Threads
router.get("/community/qa", async (_req: Request, res: Response) => {
  try {
    // Public read. Every column EXCEPT user_id — the author's internal user
    // id is not part of a public forum's contract, and select() would ship it
    // to anyone with curl.
    const threads = await db
      .select({
        id: communityQaThreadsTable.id,
        authorName: communityQaThreadsTable.authorName,
        questionTitle: communityQaThreadsTable.questionTitle,
        questionBody: communityQaThreadsTable.questionBody,
        category: communityQaThreadsTable.category,
        rdAnswer: communityQaThreadsTable.rdAnswer,
        rdAnsweredBy: communityQaThreadsTable.rdAnsweredBy,
        upvotes: communityQaThreadsTable.upvotes,
        createdAt: communityQaThreadsTable.createdAt,
      })
      .from(communityQaThreadsTable)
      .orderBy(desc(communityQaThreadsTable.createdAt))
      .limit(50);
    res.json(threads);
  } catch (e) {
    console.error("Failed to fetch community Q&A threads:", e);
    res.status(500).json({ error: "Failed to fetch community Q&A threads" });
  }
});

router.post("/community/qa", async (req: Request, res: Response) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const parsed = QaThreadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Malformed Q&A thread request body" });
    return;
  }

  const { questionTitle, questionBody, category } = parsed.data;

  try {
    const userRows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const authorName = userRows.length > 0 ? "Verified Member" : "Community Member";

    const [inserted] = await db
      .insert(communityQaThreadsTable)
      .values({
        userId,
        authorName,
        questionTitle,
        questionBody,
        category,
      })
      .returning();
    res.status(201).json(inserted);
  } catch (e) {
    console.error("Failed to create Q&A thread:", e);
    res.status(500).json({ error: "Failed to create question thread" });
  }
});

// Feature #7: Meal History & Nutrition Aggregation
router.get("/nutrition-history", async (req: Request, res: Response) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  try {
    const logs = await db
      .select()
      .from(nutritionLogsTable)
      .where(eq(nutritionLogsTable.userId, userId))
      .orderBy(desc(nutritionLogsTable.loggedFor))
      .limit(30);

    const targetRows = await db
      .select()
      .from(dailyTargetsTable)
      .where(eq(dailyTargetsTable.userId, userId))
      .limit(1);

    res.json({
      logs,
      targets: targetRows[0] ?? {
        calorieTarget: 2000,
        proteinTargetGrams: 80,
        fiberTargetGrams: 28,
        waterTargetMl: 2500,
      },
    });
  } catch (e) {
    console.error("Failed to fetch nutrition history:", e);
    res.status(500).json({ error: "Failed to fetch nutrition history" });
  }
});

// Feature #4: Dietary Challenge Tracker
router.get("/challenge-tracker", async (req: Request, res: Response) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  try {
    const activeChallenges = await db.select().from(challengesTable).limit(10);
    const myMemberships = await db
      .select()
      .from(challengeMembersTable)
      .where(eq(challengeMembersTable.userId, userId));
    const upcomingCheckIns = await db.select().from(challengeCheckInsTable).limit(10);

    res.json({
      challenges: activeChallenges,
      memberships: myMemberships,
      checkIns: upcomingCheckIns,
    });
  } catch (e) {
    console.error("Failed to fetch challenge tracker data:", e);
    res.status(500).json({ error: "Failed to fetch challenge tracker data" });
  }
});

export default router;
