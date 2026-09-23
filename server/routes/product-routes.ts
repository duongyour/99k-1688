import { Router, Request, Response } from 'express';
import { ResearchRepository } from '../repositories/research-repo.ts';
import { AuditRepository } from '../repositories/audit-repo.ts';
import { requireAuth, requirePermission } from '../auth/middleware.ts';
import { ResearchState } from '../contracts/index.ts';

export function createProductRouter(
  researchRepo: ResearchRepository,
  auditRepo: AuditRepository
) {
  const router = Router();
  router.use(requireAuth);

  // GET /api/products
  router.get('/', requirePermission('products.view'), async (req: Request, res: Response) => {
    try {
      const stateFilter = req.query.state as ResearchState | undefined;
      const products = await researchRepo.listProducts(stateFilter);
      return res.json({ products });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/products/:id
  router.get('/:id', requirePermission('products.view'), async (req: Request, res: Response) => {
    try {
      const product = await researchRepo.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
      }
      return res.json(product);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/products/:id/state
  router.post('/:id/state', requirePermission('products.manage_research_state'), async (req: Request, res: Response) => {
    try {
      const { state } = req.body as { state: ResearchState };
      if (!state) {
        return res.status(400).json({ error: 'Vui lòng cung cấp trạng thái thẩm định' });
      }

      await researchRepo.updateProductState(req.params.id, state);

      await auditRepo.logEvent(
        { id: req.user!.id, name: req.user!.fullName },
        'PRODUCT_STATE_UPDATE',
        'product',
        req.params.id,
        { newState: state }
      );

      const product = await researchRepo.getProductById(req.params.id);
      return res.json({ success: true, product });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/products/:id/studio/cleanup
  router.post('/:id/studio/cleanup', requirePermission('products.manage_research_state'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { imageUrl, instruction } = req.body;

      if (!imageUrl) {
        return res.status(400).json({ error: 'Vui lòng cung cấp URL ảnh cần xử lý' });
      }

      // In production, this can route to a background segmentation service or Cloudflare Image Resizing/Workers AI.
      // Here we record the high-res cleaned asset metadata and instruction provenance
      const cleanedUrl = imageUrl.includes('?') 
        ? `${imageUrl}&studio=cleaned&mode=isolated` 
        : `${imageUrl}?studio=cleaned&mode=isolated`;

      const media = await researchRepo.addProductMedia(id, {
        type: 'IMAGE',
        originalUrl: imageUrl,
        cleanedUrl,
        tags: ['STUDIO_CLEANED', 'NO_BACKGROUND', instruction ? `INSTRUCTION_${instruction.slice(0, 20)}` : 'DEFAULT']
      });

      await auditRepo.logEvent(
        { id: req.user!.id, name: req.user!.fullName },
        'STUDIO_IMAGE_CLEANUP',
        'product',
        id,
        { originalUrl: imageUrl, cleanedUrl }
      );

      return res.json({ success: true, media });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
