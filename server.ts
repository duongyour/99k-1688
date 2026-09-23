import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app.ts';
import { ResearchQueueProcessor } from './server/queue/research-queue.ts';
import { ResearchRepository } from './server/repositories/research-repo.ts';
import { AuditRepository } from './server/repositories/audit-repo.ts';
import { AIRepository } from './server/repositories/ai-repo.ts';
import { AIModelRouter } from './server/ai/model-router.ts';
import { EvidenceStorageService } from './server/storage/evidence-storage.ts';
import { localD1 } from './server/db/d1-engine.ts';

const PORT = 3000;

let appInstance: any = null;

export function getOrCreateApp(db?: any) {
  if (!appInstance || db) {
    appInstance = createApp(db || localD1);
  }
  return appInstance;
}

// Cloudflare Worker Runtime Export (fetch & queue)
export default {
  async fetch(request: Request, env?: any, ctx?: any): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          runtime: 'Cloudflare Worker (workerd)',
          engine: 'Cloudflare D1 & Queues',
          mcpEndpoint: '/mcp',
          timestamp: new Date().toISOString()
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ message: '1688 Product Research Cloudflare Worker Entrypoint' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  },

  async queue(batch: any, env?: any, ctx?: any): Promise<void> {
    const db = env?.DB || localD1;
    const researchRepo = new ResearchRepository(db);
    const auditRepo = new AuditRepository(db);
    const aiRepo = new AIRepository(db);
    const aiRouter = new AIModelRouter(aiRepo);
    const evidenceService = new EvidenceStorageService(db, env?.EVIDENCE_BUCKET);
    const processor = new ResearchQueueProcessor(researchRepo, auditRepo, aiRouter, evidenceService);

    for (const msg of batch.messages || []) {
      try {
        await processor.processJob(msg.body);
        msg.ack?.();
      } catch (err) {
        console.error(`[Cloudflare Queue] Failed job ${msg.body?.jobId}:`, err);
        msg.retry?.();
      }
    }
  }
};

async function start() {
  const { app } = getOrCreateApp();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use((await import('express')).default.static(distPath));
    app.get('*', (req: any, res: any) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[1688 Research Hub] Running on port ${PORT}`);
    console.log(`[Architecture] Cloudflare D1 Authority | Multi-AI Model Router | Remote MCP at /mcp | CDP Browser Harness`);
  });
}

// Standalone execution for Node.js / Container runtime
if (typeof process !== 'undefined' && process.release?.name === 'node') {
  if (process.env.NODE_ENV !== 'test') {
    start().catch(console.error);
  }
}
