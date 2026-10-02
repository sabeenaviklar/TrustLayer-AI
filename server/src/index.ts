import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env } from './config/env';
import { connectDB } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { generalApiLimiter } from './middleware/rateLimiter';
import apiRoutes from './routes';
import { aiServiceClient } from './services/aiServiceClient';

const app = express();

// Security and middleware
app.use(helmet());
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Health check endpoint for Docker & Nginx
app.get(['/health', '/api/health'], async (_req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const aiStatus = await aiServiceClient.checkHealth();

  const isHealthy = mongoStatus === 'connected' && aiStatus;

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    data: {
      status: isHealthy ? 'healthy' : 'degraded',
      service: 'trustlayer-server',
      mongo: mongoStatus,
      aiService: aiStatus ? 'reachable' : 'unreachable',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    error: isHealthy ? null : { message: 'One or more dependencies are unavailable' },
  });
});

// Mount API routes with versioning and general rate limiter
app.use('/api', generalApiLimiter);
app.use('/api/v1', apiRoutes);
app.use('/api', apiRoutes); // Also mount at /api for convenience

// 404 handler for undefined routes
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    data: null,
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      code: 'NOT_FOUND',
    },
  });
});

// Centralized error handler
app.use(errorHandler);

// Start server
async function startServer() {
  await connectDB();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 [TrustLayer Server] listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[TrustLayer Server] Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await mongoose.disconnect();
      console.log('[TrustLayer Server] Closed all connections. Exiting process.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[TrustLayer Server] Fatal startup failure:', err);
  process.exit(1);
});

export default app;
