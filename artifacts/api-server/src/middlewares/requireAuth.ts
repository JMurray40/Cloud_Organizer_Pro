import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getAuth } from "@clerk/express";

/**
 * Mounts after clerkMiddleware. Rejects requests without an authenticated Clerk user.
 * On success, exposes `req.userId` for downstream handlers.
 *
 * Health checks (/api/healthz) and Clerk proxy paths bypass this in app.ts.
 */
export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const auth = getAuth(req);
  const userId = auth.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as Request & { userId: string }).userId = userId;
  next();
};

export function getUserId(req: Request): string {
  const userId = (req as Request & { userId?: string }).userId;
  if (!userId) {
    // Defensive — requireAuth should have run first.
    throw new Error("getUserId called without requireAuth middleware");
  }
  return userId;
}
