import { Router } from 'express';
import authRoutes from './auth.routes';
import workspaceRoutes from './workspace.routes';
import documentRoutes from './document.routes';
import apiKeyRoutes from './apiKey.routes';
import checkRoutes from './check.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/workspaces', documentRoutes);
router.use('/workspaces', apiKeyRoutes);
router.use('/workspaces', checkRoutes);
router.use('/', checkRoutes); // Mounts /check at /api/v1/check

export default router;
