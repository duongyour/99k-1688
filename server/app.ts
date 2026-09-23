import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import { D1Database } from './db/d1-interface.ts';
import { localD1 } from './db/d1-engine.ts';
import { RoleRepository } from './repositories/role-repo.ts';
import { UserRepository } from './repositories/user-repo.ts';
import { SessionRepository } from './repositories/session-repo.ts';
import { BrowserRepository } from './repositories/browser-repo.ts';
import { ResearchRepository } from './repositories/research-repo.ts';
import { AIRepository } from './repositories/ai-repo.ts';
import { AuditRepository } from './repositories/audit-repo.ts';
import { McpRepository } from './repositories/mcp-repo.ts';
import { AIModelRouter } from './ai/model-router.ts';
import { RemoteMcpServer } from './mcp/server.ts';
import { createAuthMiddleware, requireCsrfProtection } from './auth/middleware.ts';
import { createAuthRouter } from './routes/auth-routes.ts';
import { createMemberRouter } from './routes/member-routes.ts';
import { createRoleRouter } from './routes/role-routes.ts';
import { createResearchRouter } from './routes/research-routes.ts';
import { createProductRouter } from './routes/product-routes.ts';
import { createSupplierRouter } from './routes/supplier-routes.ts';
import { createShortlistRouter } from './routes/shortlist-routes.ts';
import { createBrowserRouter } from './routes/browser-routes.ts';
import { createAIRouter } from './routes/ai-routes.ts';
import { createMcpRouter } from './routes/mcp-routes.ts';
import { createOAuthRouter } from './routes/oauth-routes.ts';
import { createAuditRouter } from './routes/audit-routes.ts';

export function createApp(db: D1Database = localD1) {
  const app: Express = express();

  app.use(express.json());
  app.use(cookieParser());

  // Initialize Repositories
  const roleRepo = new RoleRepository(db);
  const userRepo = new UserRepository(db, roleRepo);
  const sessionRepo = new SessionRepository(db, userRepo);
  const browserRepo = new BrowserRepository(db);
  const researchRepo = new ResearchRepository(db);
  const aiRepo = new AIRepository(db);
  const auditRepo = new AuditRepository(db);
  const mcpRepo = new McpRepository(db, userRepo);

  // Initialize Services & Routers
  const aiRouter = new AIModelRouter(aiRepo);
  const mcpServer = new RemoteMcpServer(mcpRepo, researchRepo, aiRouter);

  // Global Auth extraction middleware
  app.use(createAuthMiddleware(sessionRepo));

  // CSRF Protection for browser mutation requests
  app.use(requireCsrfProtection);

  // Health endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      engine: 'Cloudflare D1 Relational Engine',
      runtime: 'Node/Edge Compatible',
      mcpEndpoint: '/mcp',
      timestamp: new Date().toISOString()
    });
  });

  // Domain API Routes
  app.use('/api/auth', createAuthRouter(userRepo, sessionRepo, auditRepo));
  app.use('/api/members', createMemberRouter(userRepo, auditRepo));
  app.use('/api', createRoleRouter(roleRepo, auditRepo));
  app.use('/api/research', createResearchRouter(researchRepo, auditRepo, aiRouter));
  app.use('/api/products', createProductRouter(researchRepo, auditRepo));
  app.use('/api/suppliers', createSupplierRouter(researchRepo));
  app.use('/api/shortlists', createShortlistRouter(researchRepo, auditRepo));
  app.use('/api/browser', createBrowserRouter(browserRepo, auditRepo));
  app.use('/api/ai', createAIRouter(aiRepo, auditRepo));
  app.use('/api/audit', createAuditRouter(auditRepo));
  app.use('/', createOAuthRouter(mcpRepo));
  app.use('/', createMcpRouter(mcpServer, mcpRepo, auditRepo));

  return {
    app,
    db,
    repos: {
      roleRepo,
      userRepo,
      sessionRepo,
      browserRepo,
      researchRepo,
      aiRepo,
      auditRepo,
      mcpRepo,
      aiRouter,
      mcpServer
    }
  };
}
