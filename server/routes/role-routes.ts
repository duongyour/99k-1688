import { Router, Request, Response } from 'express';
import { RoleRepository } from '../repositories/role-repo.ts';
import { AuditRepository } from '../repositories/audit-repo.ts';
import { requireAuth, requirePermission } from '../auth/middleware.ts';

export function createRoleRouter(
  roleRepo: RoleRepository,
  auditRepo: AuditRepository
) {
  const router = Router();

  router.use(requireAuth);

  // List all roles
  router.get('/roles', requirePermission('roles.view'), async (req: Request, res: Response) => {
    try {
      const roles = await roleRepo.getAllRoles();
      return res.json({ roles });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Get canonical permissions catalog
  router.get('/permissions', requirePermission('roles.view'), async (req: Request, res: Response) => {
    try {
      const permissions = roleRepo.getCanonicalPermissions();
      return res.json({ permissions });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Create custom role
  router.post('/roles', requirePermission('roles.manage'), async (req: Request, res: Response) => {
    try {
      const { name, description, permissions } = req.body;

      if (!name || !Array.isArray(permissions)) {
        return res.status(400).json({ error: 'Tên vai trò và danh sách quyền là bắt buộc' });
      }

      const newRole = await roleRepo.createCustomRole(name, description || '', permissions);

      await auditRepo.logEvent(
        { id: req.user!.id, name: req.user!.fullName },
        'ROLE_CREATE',
        'role',
        newRole.id,
        { name: newRole.name, permissionsCount: newRole.permissions.length }
      );

      return res.json({ role: newRole, message: 'Tạo vai trò tùy biến thành công' });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  return router;
}
