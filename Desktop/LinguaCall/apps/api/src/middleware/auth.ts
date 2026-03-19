import { NextFunction, Request, Response } from "express";

export interface AuthenticatedRequest extends Request {
  clerkUserId: string;
}

export function requireClerkUser(req: Request, res: Response, next: NextFunction) {
  const clerkUserId = req.header("x-clerk-user-id");
  if (!clerkUserId) {
    res.status(401).json({
      ok: false,
      error: { code: "forbidden", message: "x-clerk-user-id header is required" }
    });
    return;
  }
  (req as AuthenticatedRequest).clerkUserId = clerkUserId;
  next();
}
