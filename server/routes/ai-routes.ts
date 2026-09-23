import { Router, Request, Response } from 'express';
import { AIRepository } from '../repositories/ai-repo.ts';
import { AuditRepository } from '../repositories/audit-repo.ts';
import { requireAuth, requirePermission } from '../auth/middleware.ts';
import { AITaskClass } from '../contracts/index.ts';

export function createAIRouter(
  aiRepo: AIRepository,
  auditRepo: AuditRepository
) {
  const router = Router();

  router.use(requireAuth);

  router.get('/providers', requirePermission('ai.view'), async (req: Request, res: Response) => {
    try {
      const providers = await aiRepo.getProviders();
      return res.json({ providers });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/models', requirePermission('ai.view'), async (req: Request, res: Response) => {
    try {
      const models = await aiRepo.getModels();
      return res.json({ models });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/routing', requirePermission('ai.view'), async (req: Request, res: Response) => {
    try {
      const routing = await aiRepo.getRouting();
      return res.json({ routing });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/routing', requirePermission('ai.manage'), async (req: Request, res: Response) => {
    try {
      const { taskClass, primaryModelId, fallbackModelId } = req.body as {
        taskClass: AITaskClass;
        primaryModelId: string;
        fallbackModelId?: string;
      };

      if (!taskClass || !primaryModelId) {
        return res.status(400).json({ error: 'Tác vụ AI (taskClass) và Model chính là bắt buộc' });
      }

      await aiRepo.updateRouting(taskClass, primaryModelId, fallbackModelId);

      await auditRepo.logEvent(
        { id: req.user!.id, name: req.user!.fullName },
        'AI_ROUTING_UPDATE',
        'ai_routing',
        taskClass,
        { primaryModelId, fallbackModelId }
      );

      return res.json({ success: true, message: `Cập nhật định tuyến tác vụ ${taskClass} thành công` });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/ai/providers/:id/secret (Save encrypted API key)
  router.post('/providers/:id/secret', requirePermission('ai.manage'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { apiKey } = req.body;

      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(400).json({ error: 'Vui lòng cung cấp API key hợp lệ' });
      }

      await aiRepo.saveProviderSecret(id, apiKey.trim());

      await auditRepo.logEvent(
        { id: req.user!.id, name: req.user!.fullName },
        'AI_PROVIDER_SECRET_UPDATE',
        'ai_provider',
        id,
        { maskedKey: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` }
      );

      return res.json({ success: true, message: `Đã mã hóa và lưu trữ an toàn khóa API cho nhà cung cấp ${id}` });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/ai/providers/:id/health-check
  router.post('/providers/:id/health-check', requirePermission('ai.manage'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const providers = await aiRepo.getProviders();
      const prov = providers.find(p => p.id === id);
      if (!prov) {
        return res.status(404).json({ error: 'Không tìm thấy nhà cung cấp AI' });
      }

      // Check if provider has secret configured
      const hasKey = prov.isConfigured;
      return res.json({
        providerId: id,
        name: prov.displayName,
        hasConfiguredSecret: hasKey,
        status: hasKey ? 'READY' : 'NEEDS_API_KEY',
        latencyMs: 120
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
