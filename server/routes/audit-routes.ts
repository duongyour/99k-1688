import { Router, Request, Response } from 'express';
import { AuditRepository } from '../repositories/audit-repo.ts';
import { requireAuth, requirePermission } from '../auth/middleware.ts';

export function createAuditRouter(auditRepo: AuditRepository) {
  const router = Router();

  router.use(requireAuth);

  router.get('/', requirePermission('audit.view'), async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 100;
      const logs = await auditRepo.listEvents(limit);
      return res.json({ logs });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
