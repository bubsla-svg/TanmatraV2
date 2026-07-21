// Ambient Express augmentation for the api-server request lifecycle.
//
// This previously lived inline in `middlewares/authMiddleware.ts`. It is a
// standalone ambient declaration so that every package which type-checks
// api-server source sees the same request shape the running server relies on
// — notably `@workspace/scripts`, whose verification suites import server
// internals (e.g. `rdCopilot/clientSummary`) and would otherwise re-check a
// subgraph of route/middleware code without the `req.user` /
// `req.isAuthenticated` / `req.log` augmentations, which are wired at the app
// composition layer (`app.ts`, `authMiddleware.ts`) it never reaches.
//
// `pino-http` augments `http.IncomingMessage` with `log`; Express `Request`
// extends `IncomingMessage`, so importing it here surfaces `req.log`.
import "pino-http";
import type { AuthUser } from "@workspace/api-zod";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}
