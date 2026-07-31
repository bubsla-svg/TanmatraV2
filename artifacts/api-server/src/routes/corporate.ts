import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  companiesTable,
  companyBudgetUsageTable,
  companyMembersTable,
  db,
  officeOrdersTable,
  vouchersTable,
  type CompanyMember,
  type OfficeOrderPick,
} from "@workspace/db";
import { makeBatchDishResolver } from "../lib/menuResolver";
import { requireAuthUser } from "../middlewares/requireAuth";
import { quoteSubsidyPaise } from "../lib/corporateSubsidy";
import { corporateInquiryRateLimit } from "../middlewares/rateLimitMiddleware";
import {
  razorpayBasicAuth,
  razorpayCredentials,
} from "../lib/razorpayRecurring";
import { sendMail } from "../lib/mail";
import { logger } from "../lib/logger";
import { computeCorporateTeamsQuote, type DietTrack } from "@workspace/subscription-rules";

const router: IRouter = Router();


function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function generateToken(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

function generateCode(prefix: string, bytes = 4): string {
  return `${prefix}-${randomBytes(bytes).toString("hex").toUpperCase()}`;
}

async function loadMembership(
  companyId: number,
  userId: string,
): Promise<CompanyMember | undefined> {
  const [m] = await db
    .select()
    .from(companyMembersTable)
    .where(
      and(
        eq(companyMembersTable.companyId, companyId),
        eq(companyMembersTable.userId, userId),
      ),
    );
  return m;
}

async function loadCompanyBySlug(slug: string) {
  const [c] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.slug, slug));
  return c;
}

// ---------- Companies ----------

const createCompanySchema = z.object({
  name: z.string().min(2).max(128),
  perEmployeeMonthlyBudgetPaise: z
    .number()
    .int()
    .min(0)
    .max(10_000_000)
    .default(0),
});

router.post("/companies", async (req: Request, res: Response) => {
  const userId = requireAuthUser(req, res);
  if (!userId) return;
  const u = req.user as { id: string; email?: string | null; firstName?: string | null };
  const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
  if (!auth) return;
  const parsed = createCompanySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const baseSlug = slugify(parsed.data.name) || "company";
  let slug = baseSlug;
  let attempt = 0;
  let inserted: typeof companiesTable.$inferSelect | undefined;
  while (attempt < 8 && !inserted) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${randomBytes(2).toString("hex")}`;
    const rows = await db
      .insert(companiesTable)
      .values({
        slug: candidate,
        name: parsed.data.name,
        ownerUserId: auth.id,
        perEmployeeMonthlyBudgetPaise: parsed.data.perEmployeeMonthlyBudgetPaise,
      })
      .onConflictDoNothing({ target: companiesTable.slug })
      .returning();
    if (rows[0]) {
      inserted = rows[0];
      slug = candidate;
    }
    attempt++;
  }
  if (!inserted) {
    res.status(500).json({ error: "could not allocate slug" });
    return;
  }
  // Owner becomes admin member automatically.
  if (auth.email) {
    await db
      .insert(companyMembersTable)
      .values({
        companyId: inserted.id,
        userId: auth.id,
        email: auth.email,
        role: "admin",
        status: "active",
        joinedAt: new Date(),
      })
      .onConflictDoNothing();
  }
  res.json({ company: inserted });
});

router.get("/companies/mine", async (req: Request, res: Response) => {
  const userId = requireAuthUser(req, res);
  if (!userId) return;
  const u = req.user as { id: string; email?: string | null; firstName?: string | null };
  const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
  if (!auth) return;
  const rows = await db
    .select({
      company: companiesTable,
      role: companyMembersTable.role,
      status: companyMembersTable.status,
    })
    .from(companyMembersTable)
    .innerJoin(
      companiesTable,
      eq(companyMembersTable.companyId, companiesTable.id),
    )
    .where(
      and(
        eq(companyMembersTable.userId, auth.id),
        eq(companyMembersTable.status, "active"),
      ),
    );
  res.json({ companies: rows });
});

router.get("/companies/:slug", async (req: Request, res: Response) => {
  const userId = requireAuthUser(req, res);
  if (!userId) return;
  const u = req.user as { id: string; email?: string | null; firstName?: string | null };
  const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
  if (!auth) return;
  const slug = String(req.params.slug ?? "");
  const company = await loadCompanyBySlug(slug);
  if (!company) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const membership = await loadMembership(company.id, auth.id);
  if (!membership || membership.status !== "active") {
    res.status(403).json({ error: "not a member" });
    return;
  }
  const members = await db
    .select()
    .from(companyMembersTable)
    .where(eq(companyMembersTable.companyId, company.id))
    .orderBy(desc(companyMembersTable.invitedAt));
  const period = currentMonth();
  const usage = await db
    .select()
    .from(companyBudgetUsageTable)
    .where(
      and(
        eq(companyBudgetUsageTable.companyId, company.id),
        eq(companyBudgetUsageTable.periodMonth, period),
      ),
    );
  const usageByUser = new Map(usage.map((u) => [u.userId, u.spentPaise]));
  res.json({
    company,
    membership,
    members: members.map((m) => ({
      ...m,
      spentThisMonthPaise: m.userId ? usageByUser.get(m.userId) ?? 0 : 0,
    })),
    period,
  });
});

const budgetSchema = z.object({
  perEmployeeMonthlyBudgetPaise: z.number().int().min(0).max(10_000_000),
});

router.put("/companies/:slug/budget", async (req: Request, res: Response) => {
  const userId = requireAuthUser(req, res);
  if (!userId) return;
  const u = req.user as { id: string; email?: string | null; firstName?: string | null };
  const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
  if (!auth) return;
  const slug = String(req.params.slug ?? "");
  const company = await loadCompanyBySlug(slug);
  if (!company) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const m = await loadMembership(company.id, auth.id);
  if (!m || m.role !== "admin" || m.status !== "active") {
    res.status(403).json({ error: "admin only" });
    return;
  }
  const parsed = budgetSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const [updated] = await db
    .update(companiesTable)
    .set({
      perEmployeeMonthlyBudgetPaise: parsed.data.perEmployeeMonthlyBudgetPaise,
    })
    .where(eq(companiesTable.id, company.id))
    .returning();
  res.json({ company: updated });
});

// ---------- Invites ----------

const inviteSchema = z.object({
  email: z.string().email().max(256),
  role: z.enum(["admin", "member"]).default("member"),
});

router.post("/companies/:slug/invite", async (req: Request, res: Response) => {
  const userId = requireAuthUser(req, res);
  if (!userId) return;
  const u = req.user as { id: string; email?: string | null; firstName?: string | null };
  const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
  if (!auth) return;
  const slug = String(req.params.slug ?? "");
  const company = await loadCompanyBySlug(slug);
  if (!company) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const m = await loadMembership(company.id, auth.id);
  if (!m || m.role !== "admin" || m.status !== "active") {
    res.status(403).json({ error: "admin only" });
    return;
  }
  const parsed = inviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const token = generateToken(16);
  const [row] = await db
    .insert(companyMembersTable)
    .values({
      companyId: company.id,
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      status: "invited",
      inviteToken: token,
    })
    .onConflictDoUpdate({
      target: [companyMembersTable.companyId, companyMembersTable.email],
      set: {
        role: parsed.data.role,
        status: sql`case when ${companyMembersTable.status} = 'active' then 'active' else 'invited' end`,
        inviteToken: sql`case when ${companyMembersTable.status} = 'active' then ${companyMembersTable.inviteToken} else ${token} end`,
      },
    })
    .returning();
  res.json({ member: row, inviteUrl: `/corporate/invite/${row.inviteToken ?? token}` });
});

router.get(
  "/companies/invites/:token",
  async (req: Request, res: Response) => {
    const token = String(req.params.token ?? "");
    if (!token) {
      res.status(400).json({ error: "invalid token" });
      return;
    }
    const [m] = await db
      .select()
      .from(companyMembersTable)
      .where(eq(companyMembersTable.inviteToken, token));
    if (!m) {
      res.status(404).json({ error: "invite not found" });
      return;
    }
    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, m.companyId));
    res.json({ invite: m, company });
  },
);

router.post(
  "/companies/invites/:token/accept",
  async (req: Request, res: Response) => {
    const userId = requireAuthUser(req, res);
    if (!userId) return;
    const u = req.user as { id: string; email?: string | null; firstName?: string | null };
    const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
    if (!auth) return;
    const token = String(req.params.token ?? "");
    const [m] = await db
      .select()
      .from(companyMembersTable)
      .where(eq(companyMembersTable.inviteToken, token));
    if (!m) {
      res.status(404).json({ error: "invite not found" });
      return;
    }
    if (m.status === "active") {
      res.json({ ok: true, already: true });
      return;
    }
    // Authorization: the authenticated user's email must match the invited
    // email. Prevents anyone with the token from claiming a membership.
    const authEmail = (auth.email ?? "").trim().toLowerCase();
    const invitedEmail = (m.email ?? "").trim().toLowerCase();
    if (!authEmail || !invitedEmail || authEmail !== invitedEmail) {
      res.status(403).json({ error: "email mismatch" });
      return;
    }
    const [updated] = await db
      .update(companyMembersTable)
      .set({
        userId: auth.id,
        status: "active",
        joinedAt: new Date(),
        inviteToken: null,
      })
      .where(eq(companyMembersTable.id, m.id))
      .returning();
    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, m.companyId));
    res.json({ member: updated, company });
  },
);

router.post(
  "/companies/:slug/members/:memberId/remove",
  async (req: Request, res: Response) => {
    const userId = requireAuthUser(req, res);
    if (!userId) return;
    const u = req.user as { id: string; email?: string | null; firstName?: string | null };
    const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
    if (!auth) return;
    const slug = String(req.params.slug ?? "");
    const memberId = Number(req.params.memberId);
    if (!Number.isFinite(memberId) || memberId <= 0) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const company = await loadCompanyBySlug(slug);
    if (!company) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const m = await loadMembership(company.id, auth.id);
    if (!m || m.role !== "admin" || m.status !== "active") {
      res.status(403).json({ error: "admin only" });
      return;
    }
    const [target] = await db
      .select()
      .from(companyMembersTable)
      .where(eq(companyMembersTable.id, memberId));
    if (!target || target.companyId !== company.id) {
      res.status(404).json({ error: "member not found" });
      return;
    }
    if (target.userId === company.ownerUserId) {
      res.status(409).json({ error: "cannot remove owner" });
      return;
    }
    await db
      .update(companyMembersTable)
      .set({ status: "removed", inviteToken: null })
      .where(eq(companyMembersTable.id, memberId));
    res.json({ ok: true });
  },
);

// ---------- Subsidy at checkout ----------

/**
 * The subsidy the caller would get on an order of `subtotal` right now.
 *
 * An ESTIMATE for the UI, and labelled as one: the authoritative number is the
 * one reserved under a lock when the order is priced. The client must never
 * bill from this — it does not send an amount at all any more.
 *
 * `remainingPaise` nets out reservations held by the caller's other in-flight
 * orders, not just committed spend, so two checkouts open at once cannot both
 * be quoted the same money.
 */
router.get("/me/company-subsidy", async (req: Request, res: Response) => {
  const userId = requireAuthUser(req, res);
  if (!userId) return;
  const u = req.user as { id: string; email?: string | null; firstName?: string | null };
  const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
  if (!auth) return;
  const subtotal = Math.max(0, Number(req.query.subtotal ?? 0));
  const quote = await quoteSubsidyPaise(auth.id, subtotal);
  if (!quote.active || quote.companyId === null) {
    res.json({ active: false });
    return;
  }
  const [company] = await db
    .select({
      id: companiesTable.id,
      slug: companiesTable.slug,
      name: companiesTable.name,
    })
    .from(companiesTable)
    .where(eq(companiesTable.id, quote.companyId));
  res.json({
    active: true,
    company,
    monthlyBudgetPaise: quote.monthlyBudgetPaise,
    spentThisMonthPaise: quote.committedPaise,
    // Held by this employee's other priced-but-unpaid orders. Surfaced so a
    // "why is my budget lower than I expect" question has an answer.
    reservedThisMonthPaise: quote.reservedPaise,
    remainingPaise: quote.remainingPaise,
    subsidyPaise: quote.subsidyPaise,
  });
});

/**
 * POST /me/company-subsidy/charge — GONE (410).
 *
 * This let a signed-in member tell the server how much to bill their own
 * company, tied to no order, bounded only by the monthly budget. The checkout
 * called it after payment, best-effort, which is how the company's share came
 * to be collected IN ADDITION to a card charge that was never reduced: the UI
 * showed a net total, the gateway billed gross from orders.charge_paise, and
 * then this endpoint billed the company on top.
 *
 * The subsidy is now part of the order's own price — reserved inside the
 * pricing transaction and committed when the payment is captured. There is no
 * client-callable way to spend a company's budget, and there should not be.
 *
 * Kept as an explicit 410 rather than deleted: a browser running a cached
 * pre-fix bundle will still call this after paying, and that call must be an
 * inert no-op instead of a second charge. The old client treats a failure here
 * as non-fatal (a toast), so a 410 degrades exactly as intended.
 */
router.post(
  "/me/company-subsidy/charge",
  async (req: Request, res: Response) => {
    req.log.warn(
      { userId: req.user?.id ?? null },
      "deprecated /me/company-subsidy/charge called — subsidy is now billed server-side at order pricing; ignoring",
    );
    res.status(410).json({
      error: "gone",
      detail:
        "corporate subsidy is applied server-side when the order is priced; this endpoint no longer bills anything",
    });
  },
);

// ---------- Office orders ----------

const createOfficeOrderSchema = z.object({
  companySlug: z.string().min(1),
  title: z.string().min(2).max(128),
  scheduledFor: z.string().datetime(),
  windowClosesAt: z.string().datetime(),
  perEmployeeBudgetPaise: z.number().int().min(0).max(10_000_000),
  address: z.object({
    label: z.string().max(64).optional(),
    line: z.string().min(2).max(256),
    city: z.string().min(1).max(64),
    pincode: z.string().min(3).max(16),
    phone: z.string().max(32).optional(),
  }),
});

router.post("/office-orders", async (req: Request, res: Response) => {
  const userId = requireAuthUser(req, res);
  if (!userId) return;
  const u = req.user as { id: string; email?: string | null; firstName?: string | null };
  const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
  if (!auth) return;
  const parsed = createOfficeOrderSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const company = await loadCompanyBySlug(parsed.data.companySlug);
  if (!company) {
    res.status(404).json({ error: "company not found" });
    return;
  }
  const m = await loadMembership(company.id, auth.id);
  if (!m || m.role !== "admin" || m.status !== "active") {
    res.status(403).json({ error: "admin only" });
    return;
  }
  const [row] = await db
    .insert(officeOrdersTable)
    .values({
      companyId: company.id,
      createdByUserId: auth.id,
      title: parsed.data.title,
      address: parsed.data.address,
      perEmployeeBudgetPaise: parsed.data.perEmployeeBudgetPaise,
      scheduledFor: new Date(parsed.data.scheduledFor),
      windowClosesAt: new Date(parsed.data.windowClosesAt),
      status: "open",
      picks: [],
    })
    .returning();
  res.json({ officeOrder: row });
});

router.get(
  "/companies/:slug/office-orders",
  async (req: Request, res: Response) => {
    const userId = requireAuthUser(req, res);
    if (!userId) return;
    const u = req.user as { id: string; email?: string | null; firstName?: string | null };
    const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
    if (!auth) return;
    const company = await loadCompanyBySlug(String(req.params.slug ?? ""));
    if (!company) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const m = await loadMembership(company.id, auth.id);
    if (!m || m.status !== "active") {
      res.status(403).json({ error: "not a member" });
      return;
    }
    const rows = await db
      .select()
      .from(officeOrdersTable)
      .where(eq(officeOrdersTable.companyId, company.id))
      .orderBy(desc(officeOrdersTable.createdAt))
      .limit(100);
    res.json({ officeOrders: rows });
  },
);

router.get("/office-orders/:id", async (req: Request, res: Response) => {
  const userId = requireAuthUser(req, res);
  if (!userId) return;
  const u = req.user as { id: string; email?: string | null; firstName?: string | null };
  const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
  if (!auth) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const [row] = await db
    .select()
    .from(officeOrdersTable)
    .where(eq(officeOrdersTable.id, id));
  if (!row) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const m = await loadMembership(row.companyId, auth.id);
  if (!m || m.status !== "active") {
    res.status(403).json({ error: "not a member" });
    return;
  }
  res.json({ officeOrder: row, membership: m });
});

const pickSchema = z.object({
  items: z
    .array(
      z.object({
        dishId: z.number().int().positive(),
        quantity: z.number().int().positive().max(10),
      }),
    )
    .min(1)
    .max(20),
});

router.post(
  "/office-orders/:id/pick",
  async (req: Request, res: Response) => {
    const userId = requireAuthUser(req, res);
    if (!userId) return;
    const u = req.user as { id: string; email?: string | null; firstName?: string | null };
    const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
    if (!auth) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const parsed = pickSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }
    // Resolve dish prices server-side. Use the batch resolver so we hit the
    // catalog once even when the office order has many line items (was N+1
    // round-trips per pick).
    const catalog = await makeBatchDishResolver();
    const resolvedItems: OfficeOrderPick["items"] = [];
    let total = 0;
    for (const it of parsed.data.items) {
      const dish = catalog.byId(it.dishId);
      if (!dish || !dish.isAvailable) {
        res.status(404).json({ error: `dish ${it.dishId} unavailable` });
        return;
      }
      const lineTotal = dish.price * it.quantity;
      total += lineTotal;
      resolvedItems.push({
        dishId: dish.id,
        name: dish.name,
        image: dish.image,
        unitPrice: dish.price,
        quantity: it.quantity,
      });
    }
    try {
      const out = await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${"office:" + id}, 0))`,
        );
        const [existing] = await tx
          .select()
          .from(officeOrdersTable)
          .where(eq(officeOrdersTable.id, id));
        if (!existing) return { error: "not_found" as const };
        const m = await tx
          .select()
          .from(companyMembersTable)
          .where(
            and(
              eq(companyMembersTable.companyId, existing.companyId),
              eq(companyMembersTable.userId, auth.id),
              eq(companyMembersTable.status, "active"),
            ),
          );
        if (!m[0]) return { error: "forbidden" as const };
        if (existing.status !== "open") {
          return { error: "closed" as const };
        }
        if (new Date(existing.windowClosesAt).getTime() < Date.now()) {
          return { error: "window_closed" as const };
        }
        if (total > existing.perEmployeeBudgetPaise) {
          return { error: "over_budget" as const, total, budget: existing.perEmployeeBudgetPaise };
        }
        const userName = auth.firstName || (auth.email ? auth.email.split("@")[0]! : "Employee");
        const picks = (existing.picks ?? []).filter((p) => p.userId !== auth.id);
        const newPick: OfficeOrderPick = {
          userId: auth.id,
          userName,
          pickedAt: new Date().toISOString(),
          items: resolvedItems,
          totalPaise: total,
        };
        picks.push(newPick);
        const newTotal = picks.reduce((s, p) => s + p.totalPaise, 0);
        const [updated] = await tx
          .update(officeOrdersTable)
          .set({ picks, totalPaise: newTotal })
          .where(eq(officeOrdersTable.id, id))
          .returning();
        return { officeOrder: updated };
      });
      if ("error" in out) {
        const code =
          out.error === "not_found"
            ? 404
            : out.error === "forbidden"
              ? 403
              : out.error === "over_budget"
                ? 422
                : 409;
        res.status(code).json({ error: out.error });
        return;
      }
      res.json({ officeOrder: out.officeOrder });
    } catch (err) {
      req.log.error({ err }, "office pick failed");
      res.status(500).json({ error: "pick failed" });
    }
  },
);

router.post(
  "/office-orders/:id/close",
  async (req: Request, res: Response) => {
    const userId = requireAuthUser(req, res);
    if (!userId) return;
    const u = req.user as { id: string; email?: string | null; firstName?: string | null };
    const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
    if (!auth) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const [existing] = await db
      .select()
      .from(officeOrdersTable)
      .where(eq(officeOrdersTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const m = await loadMembership(existing.companyId, auth.id);
    if (!m || m.role !== "admin" || m.status !== "active") {
      res.status(403).json({ error: "admin only" });
      return;
    }
    if (existing.status === "closed" || existing.status === "delivered") {
      res.json({ officeOrder: existing });
      return;
    }
    const [updated] = await db
      .update(officeOrdersTable)
      .set({ status: "closed", closedAt: new Date() })
      .where(eq(officeOrdersTable.id, id))
      .returning();
    res.json({ officeOrder: updated });
  },
);

// ---------- Vouchers ----------
//
// A voucher is bearer money: redeeming one writes `amountPaise` straight into
// credit_ledger, which checkout spends like cash. So the ONLY way a voucher may
// reach `active` is a Razorpay capture whose signature verifies server-side.
//
// The buyer picks the denomination — that part is legitimate for a gift card;
// what is not legitimate is honouring the denomination without charging for it.
// So the amount the client asks for is not trusted as *value*, it is trusted
// only as the amount to OPEN A GATEWAY ORDER FOR. The row is born
// `pending_payment` (the column default, so a forgetful future insert lands on
// the worthless value), carries the gateway order id, and is flipped to
// `active` by exactly one guarded UPDATE in POST /vouchers/verify.
//
// The `code` is allocated at insert time because the unique-index retry loop
// needs it, but it is deliberately withheld from every response until that
// capture is verified — handing the buyer a code before payment would hand
// them a string that LOOKS spendable.

const purchaseVoucherSchema = z.object({
  amountPaise: z.number().int().min(10_000).max(5_000_000),
  recipientEmail: z.string().email().max(256).optional(),
  recipientName: z.string().max(128).optional(),
  message: z.string().max(512).optional(),
});

/**
 * Opens checkout for a NEW voucher. Unlike premium (where a user has at most
 * one membership, so the pending row is reused), every voucher is a distinct
 * gift with its own recipient and message — reusing an abandoned pending row
 * would silently retarget an earlier gift at a new recipient. So each checkout
 * mints its own row; abandoned ones stay `pending_payment` forever, invisible
 * and worthless.
 */
router.post("/vouchers", async (req: Request, res: Response) => {
  const userId = requireAuthUser(req, res);
  if (!userId) return;
  const u = req.user as { id: string; email?: string | null; firstName?: string | null };
  const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
  if (!auth) return;
  const parsed = purchaseVoucherSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const creds = razorpayCredentials();
  if (!creds) {
    // No silent free voucher when the gateway is unconfigured — refuse.
    res.status(503).json({ error: "payment gateway not configured" });
    return;
  }
  const [keyId, keySecret] = creds;

  let attempt = 0;
  let inserted: typeof vouchersTable.$inferSelect | undefined;
  while (attempt < 5 && !inserted) {
    const code = generateCode("TM", 5);
    const rows = await db
      .insert(vouchersTable)
      .values({
        code,
        amountPaise: parsed.data.amountPaise,
        purchasedByUserId: auth.id,
        recipientEmail: parsed.data.recipientEmail?.toLowerCase(),
        recipientName: parsed.data.recipientName,
        message: parsed.data.message,
        status: "pending_payment",
      })
      .onConflictDoNothing({ target: vouchersTable.code })
      .returning();
    if (rows[0]) inserted = rows[0];
    attempt++;
  }
  if (!inserted) {
    res.status(500).json({ error: "could not allocate code" });
    return;
  }

  const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: inserted.amountPaise,
      currency: "INR",
      receipt: `voucher-${inserted.id}`,
      payment_capture: 1,
    }),
  });
  if (!rpRes.ok) {
    let body: unknown;
    try {
      body = await rpRes.json();
    } catch {
      body = await rpRes.text();
    }
    req.log.error(
      { status: rpRes.status, body, voucherId: inserted.id },
      "Razorpay voucher order creation failed",
    );
    res.status(502).json({ error: "payment gateway error" });
    return;
  }
  const rp = (await rpRes.json()) as {
    id: string;
    amount: number;
    currency: string;
  };
  await db
    .update(vouchersTable)
    .set({ razorpayOrderId: rp.id })
    .where(eq(vouchersTable.id, inserted.id));

  // No `code` in this response, and no voucher row either — both would leak
  // the code. The client gets back only what it needs to open the modal.
  res.json({
    voucherId: inserted.id,
    razorpayOrderId: rp.id,
    amount: rp.amount,
    currency: rp.currency,
    keyId,
  });
});

const voucherVerifySchema = z.object({
  razorpayPaymentId: z.string().min(1).max(64),
  razorpayOrderId: z.string().min(1).max(64),
  razorpaySignature: z.string().min(1).max(256),
});

/**
 * Verifies a captured payment and funds the voucher. The guarded UPDATE binds
 * THIS payment to the `pending_payment` row whose stored `razorpayOrderId`
 * matches AND whose purchaser is the caller — replaying another order's valid
 * signature, or re-posting a signature for an already-funded voucher, updates
 * zero rows (→ 409). This is the only code path in the app allowed to write
 * `status: "active"` onto a voucher.
 */
router.post("/vouchers/verify", async (req: Request, res: Response) => {
  const userId = requireAuthUser(req, res);
  if (!userId) return;
  const u = req.user as { id: string; email?: string | null; firstName?: string | null };
  const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
  if (!auth) return;
  const parsed = voucherVerifySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = parsed.data;
  const creds = razorpayCredentials();
  if (!creds) {
    res.status(503).json({ error: "payment gateway not configured" });
    return;
  }
  const [, keySecret] = creds;

  const expected = createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  let valid = false;
  try {
    valid = timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(razorpaySignature, "hex"),
    );
  } catch {
    valid = false;
  }
  if (!valid) {
    req.log.warn(
      { userId: auth.id, razorpayOrderId },
      "invalid voucher payment signature",
    );
    res.status(400).json({ error: "invalid payment signature" });
    return;
  }

  const [row] = await db
    .update(vouchersTable)
    .set({ status: "active", razorpayPaymentId })
    .where(
      and(
        eq(vouchersTable.purchasedByUserId, auth.id),
        eq(vouchersTable.razorpayOrderId, razorpayOrderId),
        eq(vouchersTable.status, "pending_payment"),
      ),
    )
    .returning();
  if (!row) {
    res.status(409).json({ error: "payment could not be applied" });
    return;
  }
  // Payment is captured and bound — only now is the code real, so only now is
  // it disclosed.
  res.json({ voucher: row });
});

router.get("/vouchers/mine", async (req: Request, res: Response) => {
  const userId = requireAuthUser(req, res);
  if (!userId) return;
  const u = req.user as { id: string; email?: string | null; firstName?: string | null };
  const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
  if (!auth) return;
  // `pending_payment` rows are excluded: an unpaid voucher has no code worth
  // showing and listing it would present abandoned checkouts as gift cards.
  const purchased = await db
    .select()
    .from(vouchersTable)
    .where(
      and(
        eq(vouchersTable.purchasedByUserId, auth.id),
        ne(vouchersTable.status, "pending_payment"),
      ),
    )
    .orderBy(desc(vouchersTable.createdAt))
    .limit(50);
  const redeemed = await db
    .select()
    .from(vouchersTable)
    .where(eq(vouchersTable.redeemedByUserId, auth.id))
    .orderBy(desc(vouchersTable.redeemedAt))
    .limit(50);
  res.json({ purchased, redeemed });
});

const previewVoucherSchema = z.object({ code: z.string().min(4).max(24) });

router.post("/vouchers/preview", async (req: Request, res: Response) => {
  const parsed = previewVoucherSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const [v] = await db
    .select()
    .from(vouchersTable)
    .where(eq(vouchersTable.code, parsed.data.code.toUpperCase()));
  // An unpaid voucher is indistinguishable from one that does not exist. This
  // endpoint is unauthenticated, so anything softer would let a guessed code
  // confirm a pending row — and would show a value that was never funded.
  if (!v || v.status === "pending_payment") {
    res.status(404).json({ error: "voucher not found" });
    return;
  }
  res.json({
    code: v.code,
    amountPaise: v.amountPaise,
    status: v.status,
    redeemed: v.status !== "active",
  });
});

router.post("/vouchers/redeem", async (req: Request, res: Response) => {
  const userId = requireAuthUser(req, res);
  if (!userId) return;
  const u = req.user as { id: string; email?: string | null; firstName?: string | null };
  const auth = { id: userId, email: u?.email ?? null, firstName: u?.firstName ?? null };
  if (!auth) return;
  const parsed = previewVoucherSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const code = parsed.data.code.toUpperCase();
  try {
    const out = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${"voucher:" + code}, 0))`,
      );
      const [v] = await tx
        .select()
        .from(vouchersTable)
        .where(eq(vouchersTable.code, code));
      // Fail-closed on anything that is not `active`. An unpaid voucher is
      // reported as not_found rather than already_redeemed: it was never
      // funded, so "already redeemed" would be a lie that also confirms the
      // code exists.
      if (!v || v.status === "pending_payment")
        return { error: "not_found" as const };
      if (v.status !== "active") return { error: "already_redeemed" as const };
      const [updated] = await tx
        .update(vouchersTable)
        .set({
          status: "redeemed",
          redeemedByUserId: auth.id,
          redeemedAt: new Date(),
        })
        .where(eq(vouchersTable.id, v.id))
        .returning();
      // Credit the user's wallet via the existing credit ledger so the
      // amount is automatically applied at checkout (same path as referral
      // / loyalty rewards). reason field is varchar; using a stable string.
      await tx.execute(
        sql`insert into credit_ledger (user_id, delta_paise, reason, ref_type, ref_id, note)
            values (${auth.id}, ${v.amountPaise}, ${"voucher_redeemed"}, ${"voucher"}, ${String(v.id)}, ${"Voucher " + v.code})`,
      );
      return { voucher: updated };
    });
    if ("error" in out) {
      res
        .status(out.error === "not_found" ? 404 : 409)
        .json({ error: out.error });
      return;
    }
    res.json({ voucher: out.voucher, creditedPaise: out.voucher.amountPaise });
  } catch (err) {
    req.log.error({ err }, "voucher redeem failed");
    res.status(500).json({ error: "redeem failed" });
  }
});

// ---------- public: corporate lead inquiries ----------
//
// No dedicated table yet — this is a lead-capture form, not an
// authenticated resource. Persisted storage (mirroring rd_applications)
// is a natural follow-up but needs a schema migration applied against
// production Postgres; until then this notifies ops by email (same
// mechanism rd_applications uses) so a submission is never silently
// dropped even though it isn't durably stored server-side yet.

const corporateInquirySchema = z.object({
  companyName: z.string().min(1).max(200),
  contactPerson: z.string().min(1).max(200),
  email: z.email().max(200),
  phone: z.string().min(1).max(40),
  size: z.string().min(1).max(64),
  message: z.string().min(1).max(4000),
});

router.post(
  "/corporate/inquiries",
  corporateInquiryRateLimit,
  async (req: Request, res: Response) => {
    const parsed = corporateInquirySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: "invalid payload",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }
    const d = parsed.data;
    const to = process.env["CORPORATE_OPS_INBOX_EMAIL"] ?? process.env["RD_OPS_INBOX_EMAIL"] ?? null;
    let notify: { delivered: boolean; reason?: string } = {
      delivered: false,
      reason: "no ops inbox configured",
    };
    if (to) {
      const lines = [
        `New corporate inquiry — ${d.companyName}`,
        ``,
        `Contact: ${d.contactPerson}`,
        `Email: ${d.email}`,
        `Phone: ${d.phone}`,
        `Estimated headcount: ${d.size}`,
        ``,
        `Message:`,
        d.message,
      ];
      const text = lines.join("\n");
      notify = await sendMail({
        to,
        subject: `Corporate inquiry: ${d.companyName}`,
        text,
        html: `<pre style="font-family:ui-monospace,monospace;font-size:13px;white-space:pre-wrap">${text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")}</pre>`,
      });
    }
    logger.info(
      {
        companyName: d.companyName,
        contactEmail: d.email,
        size: d.size,
        notify,
      },
      "corporate.inquiry.submitted",
    );
    res.status(200).json({ ok: true });
  },
);

// ── B2B Corporate Teams Seat Tier Quotes & Invoices (Table II.2) ─────────────

const corporateTeamsQuoteSchema = z.object({
  seats: z.number().int().min(1),
  track: z.enum(["veg", "egg", "nonveg"]).default("veg"),
  mealsPerCycle: z.number().int().min(1).default(22),
});

router.post("/corporate/teams/quote", async (req: Request, res: Response) => {
  const parsed = corporateTeamsQuoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid quote payload", issues: parsed.error.issues });
    return;
  }
  const { seats, track, mealsPerCycle } = parsed.data;
  if (seats < 10) {
    res.status(400).json({
      error: "minimum 10 seats required for corporate Teams tiers",
      code: "insufficient_seats",
      minSeats: 10,
    });
    return;
  }
  try {
    const quote = computeCorporateTeamsQuote(seats, track as DietTrack, mealsPerCycle);
    res.json({ ok: true, quote });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "quote failure" });
  }
});

const corporateTeamsInvoiceSchema = z.object({
  seats: z.number().int().min(1),
  track: z.enum(["veg", "egg", "nonveg"]).default("veg"),
  mealsPerCycle: z.number().int().min(1).default(22),
  companyName: z.string().min(1).max(200),
  contactEmail: z.email().max(200),
  clientTotalPaise: z.number().int().min(0).optional(),
});

router.post("/corporate/teams/invoice", async (req: Request, res: Response) => {
  const parsed = corporateTeamsInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid invoice payload", issues: parsed.error.issues });
    return;
  }
  const { seats, track, mealsPerCycle, companyName, contactEmail, clientTotalPaise } = parsed.data;
  if (seats < 10) {
    res.status(400).json({
      error: "minimum 10 seats required for corporate Teams tiers",
      code: "insufficient_seats",
      minSeats: 10,
    });
    return;
  }

  // Authoritative server-side pricing computation per Table II.2
  // Never trust client-supplied invoice amounts
  const quote = computeCorporateTeamsQuote(seats, track as DietTrack, mealsPerCycle);

  if (clientTotalPaise !== undefined && clientTotalPaise !== quote.cycleTotalPaise) {
    logger.warn(
      { clientTotalPaise, serverTotalPaise: quote.cycleTotalPaise, seats, track },
      "corporate.teams.invoice_amount_mismatch",
    );
  }

  logger.info(
    { companyName, contactEmail, seats, track, quote, discountSource: quote.discountSource },
    "corporate.teams.invoice.generated",
  );

  res.json({
    ok: true,
    invoice: {
      ...quote,
      companyName,
      contactEmail,
      authoritative: true,
    },
  });
});

export default router;

