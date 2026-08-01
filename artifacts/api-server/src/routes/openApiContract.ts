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
