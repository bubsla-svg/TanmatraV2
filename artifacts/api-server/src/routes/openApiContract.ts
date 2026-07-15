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

export const OPENAPI_SPEC_V1 = {
  openapi: "3.0.3",
  info: {
    title: "Tanmatra Therapeutic Meal Delivery API",
    version: "1.2.0",
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
  },
};

/**
 * Step 1: GET /api/v1/openapi.json
 * Exposes OpenAPI 3.0 JSON spec contract.
 */
router.get("/v1/openapi.json", (_req: Request, res: Response) => {
  res.json(OPENAPI_SPEC_V1);
});

/**
 * Step 3: GET /api/v1/changelog
 * Exposes version changelog, deprecation notices, and migration timelines.
 */
router.get("/v1/changelog", (_req: Request, res: Response) => {
  res.json({
    currentVersion: "v1.2.0",
    changelog: API_CHANGELOG,
  });
});

/**
 * Step 2 & 3: Deprecation Guard Middleware
 * Injects Deprecation and Sunset headers for sunsetting API versions.
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
