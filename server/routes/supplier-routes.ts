import { Router, Request, Response } from 'express';
import { ResearchRepository } from '../repositories/research-repo.ts';
import { requireAuth, requirePermission } from '../auth/middleware.ts';

export function createSupplierRouter(researchRepo: ResearchRepository) {
  const router = Router();
  router.use(requireAuth);

  // GET /api/suppliers
  router.get('/', requirePermission('suppliers.view'), async (req: Request, res: Response) => {
    try {
      const suppliers = await researchRepo.listSuppliers();
      return res.json({ suppliers });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/suppliers/:id
  router.get('/:id', requirePermission('suppliers.view'), async (req: Request, res: Response) => {
    try {
      const detail = await researchRepo.getSupplierById(req.params.id);
      if (!detail) {
        return res.status(404).json({ error: 'Không tìm thấy nhà cung cấp' });
      }
      return res.json(detail);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
