import { Router, Request, Response } from 'express';
import { ResearchRepository } from '../repositories/research-repo.ts';
import { AuditRepository } from '../repositories/audit-repo.ts';
import { requireAuth, requirePermission } from '../auth/middleware.ts';

export function createShortlistRouter(
  researchRepo: ResearchRepository,
  auditRepo: AuditRepository
) {
  const router = Router();
  router.use(requireAuth);

  // GET /api/shortlists
  router.get('/', requirePermission('shortlists.manage'), async (req: Request, res: Response) => {
    try {
      const shortlists = await researchRepo.listShortlists(req.user!.id);
      return res.json({ shortlists });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/shortlists/:id
  router.get('/:id', requirePermission('shortlists.manage'), async (req: Request, res: Response) => {
    try {
      const detail = await researchRepo.getShortlistById(req.params.id);
      if (!detail) {
        return res.status(404).json({ error: 'Không tìm thấy danh sách rút gọn' });
      }
      return res.json(detail);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/shortlists
  router.post('/', requirePermission('shortlists.manage'), async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Vui lòng nhập tên danh sách' });
      }

      const shortlist = await researchRepo.createShortlist({
        name: name.trim(),
        description: description?.trim(),
        userId: req.user!.id,
        userName: req.user!.fullName
      });

      await auditRepo.logEvent(
        { id: req.user!.id, name: req.user!.fullName },
        'SHORTLIST_CREATE',
        'shortlist',
        shortlist.id,
        { name }
      );

      return res.json({ shortlist });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/shortlists/:id
  router.delete('/:id', requirePermission('shortlists.manage'), async (req: Request, res: Response) => {
    try {
      await researchRepo.deleteShortlist(req.params.id);

      await auditRepo.logEvent(
        { id: req.user!.id, name: req.user!.fullName },
        'SHORTLIST_DELETE',
        'shortlist',
        req.params.id,
        {}
      );

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/shortlists/:id/items
  router.post('/:id/items', requirePermission('shortlists.manage'), async (req: Request, res: Response) => {
    try {
      const { productId, notes } = req.body;
      if (!productId) {
        return res.status(400).json({ error: 'Vui lòng cung cấp mã sản phẩm' });
      }

      const item = await researchRepo.addShortlistItem(req.params.id, productId, notes);
      return res.json({ success: true, item });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/shortlists/:id/items/:itemId
  router.delete('/:id/items/:itemId', requirePermission('shortlists.manage'), async (req: Request, res: Response) => {
    try {
      await researchRepo.removeShortlistItem(req.params.id, req.params.itemId);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/shortlists/:id/export
  router.get('/:id/export', requirePermission('shortlists.manage'), async (req: Request, res: Response) => {
    try {
      const detail = await researchRepo.getShortlistById(req.params.id);
      if (!detail) {
        return res.status(404).json({ error: 'Không tìm thấy danh sách' });
      }

      // Generate CSV
      let csv = 'Product ID,Title (ZH),Title (VI),Variant Price (CNY),MOQ,Supplier,Recommendation,Notes\n';
      for (const item of detail.items || []) {
        const p = item.product;
        if (!p) continue;
        const line = [
          `"${p.canonical1688Id || p.id}"`,
          `"${(p.titleZh || '').replace(/"/g, '""')}"`,
          `"${(p.title || '').replace(/"/g, '""')}"`,
          p.verifiedVariantPrice,
          p.moq,
          `"${(p.supplierName || '').replace(/"/g, '""')}"`,
          p.assessment?.recommendationStatus || 'N/A',
          `"${(item.notes || '').replace(/"/g, '""')}"`
        ].join(',');
        csv += line + '\n';
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="shortlist_${detail.shortlist.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv"`);
      return res.send(csv);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
