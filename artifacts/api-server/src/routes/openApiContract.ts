import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

export interface ApiChangelogEntry {
  version: string;
  releasedAt: string;
  status: "active" | "deprecated" | "sunset";
  deprecationNotice?: string;
  migrationGuideUrl?: string;
  changes: string[];
}

export const API_CHANGELOG: ApiChangelogEntry[] = [
  {
    version: "v1.4.0",
    releasedAt: "2026-08-01",
    status: "active",
    changes: [
      "Added the Policy, Legal & Disclaimer CMS: public /legal-documents (+ :slug) and /admin/legal-documents CRUD + publish, gated to role compliance (ADM-20)",
    ],
  },
  {
    version: "v1.3.0",
    releasedAt: "2026-08-01",
    status: "active",
    changes: [
      "Added OpenAPI contracts for all /ops and /admin surfaces (ADM-04)",
      "Added continuous validation for missing ops contracts"
    ],
  },
  {
    version: "v1.2.0",
    releasedAt: "2026-07-15",
    status: "active",
    changes: [
      "Mounted OpenAPI 3.0 contract schema spec at /api/v1/openapi.json",
      "Added explicit Zod contract validation across all /api/v1/ endpoints",
      "Introduced Deprecation header middleware and versioned /api/v1/ and /api/v2/ routes",
    ],
  },
  {
    version: "v1.0.0",
    releasedAt: "2026-01-10",
    status: "active",
    changes: ["Initial v1 release of Tanmatra Therapeutic Meal Delivery API"],
  },
];

const OPS_PATHS = {
  "/ops/anomalies": { get: { summary: "Get anomalies" } },
  "/ops/anomalies/scan": { post: { summary: "Scan for anomalies" } },
  "/ops/anomalies/{id}/ack": { post: { summary: "Acknowledge anomaly" } },
  "/ops/anomalies/{id}/snooze": { post: { summary: "Snooze anomaly" } },
  "/ops/anomalies/{id}/close": { post: { summary: "Close anomaly" } },
  "/ops/anomalies/digest": { get: { summary: "Get anomaly digest" } },
  "/ops/anomalies/digest/send": { post: { summary: "Send anomaly digest" } },
  "/ops/packaging": { get: { summary: "Get packaging" } },
  "/ops/measurements": { get: { summary: "Get measurements" } },
  "/ops/inventory": { get: { summary: "Get inventory" } },
  "/ops/recipes": { get: { summary: "Get recipes" } },
  "/ops/recipes/{slug}": { get: { summary: "Get recipe by slug" } },
  "/ops/kds/orders": { get: { summary: "Get KDS orders" } },
  "/ops/kds/orders/{id}/ready": { post: { summary: "Mark order ready" } },
  "/ops/supplier/batches": { get: { summary: "List supplier delivery batches" } },
  "/ops/supplier/deliver": { post: { summary: "Supplier deliver" } },
  "/ops/supplier/intake": { post: { summary: "Supplier intake" } },
  "/ops/kds/orders/{id}/simulate-delay": { post: { summary: "Simulate order delay" } },
  "/ops/kds/prep-brief": { get: { summary: "Get KDS prep brief" } },
  "/ops/kds/orders/{id}/explode-bom": { post: { summary: "Explode BOM for order" } },
  "/ops/logistics/scan-fallbacks": { get: { summary: "Scan logistics fallbacks" } },
  "/ops/logistics/evaluate-wholesale-spike": { post: { summary: "Evaluate wholesale spike" } },
  "/ops/wms/route-fulfillment": { post: { summary: "Route fulfillment" } },
};

const ADMIN_PATHS = {
  "/admin/login": { post: { summary: "Admin login" } },
  "/admin/logout": { post: { summary: "Admin logout" } },
  "/admin/me": { get: { summary: "Get admin profile" } },
  "/admin/_hash": { post: { summary: "Generate hash" } },
  "/admin/sessions/{sid}/revoke": { post: { summary: "Revoke admin session" } },
  "/admin/_status": { get: { summary: "Get admin status" } },
  "/admin/audit": { get: { summary: "Get admin audit log" } },
  "/admin/roles": {
    get: { summary: "List user roles" },
    post: { summary: "Grant role" },
  },
  "/admin/roles/{userId}/{role}": {
    delete: { summary: "Revoke role" },
  },
  "/admin/legal-documents": {
    get: { summary: "List legal-document drafts (compliance)", responses: { "200": { description: "Draft rows + published-version pointer" } } },
    post: { summary: "Create a new legal-document slug (compliance)", responses: { "201": { description: "Draft created" }, "409": { description: "Slug already exists" } } },
  },
  "/admin/legal-documents/{slug}": {
    put: { summary: "Edit a legal-document draft (compliance)", responses: { "200": { description: "Draft updated" }, "404": { description: "Unknown slug" } } },
  },
  "/admin/legal-documents/{slug}/publish": {
    post: { summary: "Publish a legal-document draft as a new immutable version (compliance)", responses: { "200": { description: "New version published" }, "404": { description: "Unknown slug" }, "409": { description: "Publish conflict — retry" } } },
  },
};

/**
 * Public, unauthenticated Legal/Policy CMS reads (ADM-20). Kept as their own
 * const rather than folded into OPS_PATHS/ADMIN_PATHS since neither router
 * they describe (routes/legalDocuments.ts's public half) is ops- or
 * admin-gated — see ADMIN_PATHS above for the /admin/legal-documents* half
 * of the same router.
 */
const LEGAL_PATHS: Record<string, any> = {
  "/legal-documents": {
    get: { summary: "List published legal documents + the company/entity singleton", responses: { "200": { description: "Published documents and company profile" } } },
  },
  "/legal-documents/{slug}": {
    get: { summary: "Get one published legal document by slug", responses: { "200": { description: "Document body and company profile" }, "404": { description: "Unpublished or unknown slug" } } },
  },
};

export const OPENAPI_SPEC_V1 = {
  openapi: "3.0.3",
  info: {
    title: "Tanmatra Therapeutic Meal Delivery API",
    version: "1.4.0",
    description: "Strict OpenAPI/Zod contract specs, explicit v1/v2 versioning, and deprecation governance.",
  },
  servers: [{ url: "/api/v1", description: "Production v1 API Server" }],
  paths: {
    "/catalog/skus": {
      get: {
        summary: "Get menu catalog SKUs and committed plans",
        responses: {
          "200": { description: "Verified SKU catalog list with committed weekly rates" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        summary: "Silent background session refresh and single-use token rotation",
        responses: {
          "200": { description: "Token refreshed and rotated successfully" },
          "401": { description: "Session expired or token reuse compromise detected" },
        },
      },
    },
    ...OPS_PATHS,
    ...ADMIN_PATHS,
    ...LEGAL_PATHS,
  },
};

/**
 * Normalizes express path syntax (`/ops/:id/ack`) to OpenAPI syntax (`/ops/{id}/ack`).
 */
export function normalizeExpressPath(path: string): string {
  return path.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");
}

/**
 * Validates that an Express router's registered paths are present in the OpenAPI specification.
 * Throws or returns missing paths when a router registers an uncontracted route.
 */
export function validateRouterContract(
  routerInstance: any,
  mountPrefix = "",
  spec: typeof OPENAPI_SPEC_V1 = OPENAPI_SPEC_V1,
): { valid: boolean; missing: string[]; totalChecked: number } {
  const missing: string[] = [];
  let totalChecked = 0;

  const stack = routerInstance?.stack ?? [];
  for (const layer of stack) {
    if (layer.route?.path) {
      const rawPath = `${mountPrefix}${layer.route.path}`.replace(/\/+/g, "/");
      const openApiPath = normalizeExpressPath(rawPath);
      totalChecked++;
      if (!spec.paths[openApiPath as keyof typeof spec.paths]) {
        missing.push(openApiPath);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    totalChecked,
  };
}

/**
 * GET /v1/openapi.json
 * Exposes OpenAPI 3.0 JSON spec contract.
 */
router.get("/v1/openapi.json", (_req: Request, res: Response) => {
  res.json(OPENAPI_SPEC_V1);
});

/**
 * GET /v1/changelog
 * Exposes version changelog, deprecation notices, and migration timelines.
 */
router.get("/v1/changelog", (_req: Request, res: Response) => {
  res.json({
    currentVersion: "v1.3.0",
    changelog: API_CHANGELOG,
  });
});

/**
 * Deprecation Guard Middleware
 */
export function apiDeprecationHeaderGuard(deprecationDate?: string, sunsetDate?: string) {
  return (_req: Request, res: Response, next: () => void): void => {
    res.setHeader("Deprecation", deprecationDate ?? "true");
    if (sunsetDate) {
      res.setHeader("Sunset", sunsetDate);
    }
    res.setHeader("Link", '</api/v1/changelog>; rel="deprecation"');
    next();
  };
}

export default router;
