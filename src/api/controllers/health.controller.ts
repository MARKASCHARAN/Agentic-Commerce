import type { Request, Response } from "express";
import { getHealthStatus } from "../../application/services/health.service.js";

export function getHealth(_req: Request, res: Response) {
  const health = getHealthStatus();

  res.json(health);
}