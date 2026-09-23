import { Router, Request, Response } from 'express';
import { UserRepository } from '../repositories/user-repo.ts';
import { AuditRepository } from '../repositories/audit-repo.ts';
import { requireAuth, requirePermission } from '../auth/middleware.ts';
import { UserStatus } from '../contracts/index.ts';

export function createMemberRouter(
  userRepo: UserRepository,
  auditRepo: AuditRepository
) {
  const router = Router();

  router.use(requireAuth);

  // List members
  router.get('/', requirePermission('members.view'), async (req: Request, res: Response) => {
    try {
      const members = await userRepo.listAll();
      return res.json({ members });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Update membership status (approve/reject/deactivate)
  router.post('/:id/status', requirePermission('members.approve'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body as { status: UserStatus };

      if (!status) {
        return res.status(400).json({ error: 'Vui lòng cung cấp trạng thái mới' });
      }

      const updated = await userRepo.updateMembershipStatus(id, status, req.user!.fullName);

      await auditRepo.logEvent(
        { id: req.user!.id, name: req.user!.fullName },
        'MEMBER_STATUS_UPDATE',
        'user',
        id,
        { newStatus: status }
      );

      return res.json({ user: updated, message: `Cập nhật trạng thái thành công sang ${status}` });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Dedicated endpoint for UI: POST /:id/approve
  router.post('/:id/approve', requirePermission('members.approve'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updated = await userRepo.updateMembershipStatus(id, 'ACTIVE', req.user!.fullName);

      await auditRepo.logEvent(
        { id: req.user!.id, name: req.user!.fullName },
        'MEMBER_APPROVE',
        'user',
        id,
        { newStatus: 'ACTIVE' }
      );

      return res.json({ user: updated, success: true, message: 'Phê duyệt thành viên thành công' });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Dedicated endpoint for UI: POST /:id/reject
  router.post('/:id/reject', requirePermission('members.approve'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updated = await userRepo.updateMembershipStatus(id, 'REJECTED', req.user!.fullName);

      await auditRepo.logEvent(
        { id: req.user!.id, name: req.user!.fullName },
        'MEMBER_REJECT',
        'user',
        id,
        { newStatus: 'REJECTED' }
      );

      return res.json({ user: updated, success: true, message: 'Từ chối thành viên thành công' });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Dedicated endpoint for UI: POST /:id/role
  router.post('/:id/role', requirePermission('members.manage'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { role, roleId } = req.body;
      const targetRoleId = roleId || (role === 'ADMIN' ? 'role_admin' : role === 'LEAD' ? 'role_research_lead' : 'role_researcher');

      const updated = await userRepo.assignRoles(id, [targetRoleId]);

      await auditRepo.logEvent(
        { id: req.user!.id, name: req.user!.fullName },
        'MEMBER_ROLE_UPDATE',
        'user',
        id,
        { roleId: targetRoleId }
      );

      return res.json({ user: updated, success: true, message: 'Cập nhật chức vụ thành viên thành công' });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Assign roles
  router.post('/:id/roles', requirePermission('members.manage'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { roleIds } = req.body as { roleIds: string[] };

      if (!Array.isArray(roleIds)) {
        return res.status(400).json({ error: 'Danh sách vai trò không hợp lệ' });
      }

      const updated = await userRepo.assignRoles(id, roleIds);

      await auditRepo.logEvent(
        { id: req.user!.id, name: req.user!.fullName },
        'MEMBER_ROLES_UPDATE',
        'user',
        id,
        { assignedRoleIds: roleIds }
      );

      return res.json({ user: updated, message: 'Cập nhật phân quyền vai trò thành công' });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  return router;
}
