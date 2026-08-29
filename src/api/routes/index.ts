import { Router } from "express";
import express from 'express';
import path from 'path';
import healthRouter from "./health.js";
import uiRoutes from "./ui.routes.js";

const router = Router();

router.use('/api', uiRoutes);
router.use(healthRouter);

// Serve static files from the public directory
router.use(express.static(path.join(process.cwd(), 'public')));

export default router;