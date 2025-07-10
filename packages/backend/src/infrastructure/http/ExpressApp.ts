import compression from 'compression';
import cors from 'cors';
import express, { type Application } from 'express';
import helmet from 'helmet';
import type { Kysely } from 'kysely';
import morgan from 'morgan';

import type { DB } from '../../generated/database/types.js';
import { VersionedOpenApiGenerator } from './VersionedOpenApiGenerator.js';
import { VersionedApiRouter } from './api/VersionedApiRouter.js';

interface ServerConfig {
  readonly port: number;
  readonly nodeEnv: string;
  readonly corsOrigin?: string | boolean;
}

const setupMiddleware = (app: Application, config: ServerConfig): void => {
  app.use(helmet());

  app.use(
    cors({
      origin: config.nodeEnv === 'production' ? config.corsOrigin || false : true,
      credentials: true,
    })
  );

  app.use(compression());
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
};

const setupRoutes = (app: Application, db: Kysely<DB>): void => {
  // Setup all versioned API routes using the new versioned system
  // Routes are now organized in api/v1/, api/v2/, etc.
  const versionedApiRouter = new VersionedApiRouter(db);
  versionedApiRouter.setupRoutes(app);
};

const setupDocumentation = (app: Application): void => {
  const versionedOpenApiGenerator = new VersionedOpenApiGenerator();
  versionedOpenApiGenerator.setupSwaggerUI(app);
};

const setupErrorHandling = (app: Application): void => {
  app.use('*', (_req, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
    });
  });

  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('Unhandled error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  );
};

export const createExpressApp = (db: Kysely<DB>, config: ServerConfig): Application => {
  const app: Application = express();

  setupMiddleware(app, config);
  setupRoutes(app, db);
  setupDocumentation(app);
  setupErrorHandling(app);

  return app;
};

export const startServer = (app: Application, port: number): void => {
  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`🔗 API base URL: http://localhost:${port}/api/v1`);
  });
};

export type { ServerConfig };
