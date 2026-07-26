import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import { isServiceablePincode } from "@workspace/api-zod";

const router: IRouter = Router();

const PincodeSchema = z.string().regex(/^\d{6}$/, { message: "pincode must be exactly 6 digits" });

/**
 * GET /serviceability/:pincode — public front-door serviceability check (II.2).
 * Unauthenticated by design so users can check serviceability before giving identity.
 * Reuses checkout's exact unserviceable_pincode code without altering checkout's hard gate authority.
 */
router.get("/serviceability/:pincode", (req: Request, res: Response) => {
  const parsed = PincodeSchema.safeParse(String(req.params["pincode"] ?? "").trim());
  if (!parsed.success) {
    res.status(400).json({ error: "invalid pincode format" });
    return;
  }

  const serviceable = isServiceablePincode(parsed.data);
  if (!serviceable) {
    res.status(200).json({ serviceable: false, code: "unserviceable_pincode" });
    return;
  }

  res.status(200).json({ serviceable: true });
});

export default router;
