import { D1Database } from '../db/d1-interface.ts';
import { CANONICAL_PERMISSIONS, PermissionKey, Role } from '../contracts/index.ts';

export const BUILTIN_ROLES: Role[] = [
  {
    id: 'role_owner',
    name: 'Chủ sở hữu (OWNER)',
    description: 'Toàn quyền tối cao quản trị hệ thống, không thể xóa hoặc hạ cấp',
    isBuiltin: true,
    permissions: CANONICAL_PERMISSIONS.map(p => p.key)
  },
  {
    id: 'role_admin',
    name: 'Quản trị viên (ADMIN)',
    description: 'Quản trị thành viên, vai trò, kiểm duyệt sản phẩm và cấu hình',
    isBuiltin: true,
    permissions: [
      'workspace.view', 'members.view', 'members.manage', 'members.approve',
      'roles.view', 'roles.manage', 'research.create', 'research.view_own',
      'research.view_all', 'research.cancel', 'products.view', 'products.manage_research_state',
      'suppliers.view', 'shortlists.view', 'shortlists.manage', 'exports.create',
      'browser.view', 'browser.manage', 'ai.view', 'ai.manage', 'mcp.view', 'mcp.manage', 'audit.view'
    ]
  },
  {
    id: 'role_researcher',
    name: 'Chuyên viên nghiên cứu (RESEARCHER)',
    description: 'Tạo phiên quét, lọc bẫy giá 1688 và quản lý danh sách sản phẩm',
    isBuiltin: true,
    permissions: [
      'workspace.view', 'research.create', 'research.view_own', 'research.view_all',
      'products.view', 'products.manage_research_state', 'suppliers.view',
      'shortlists.view', 'shortlists.manage', 'exports.create', 'browser.view',
      'ai.view', 'mcp.view'
    ]
  },
  {
    id: 'role_viewer',
    name: 'Người xem (VIEWER)',
    description: 'Chỉ xem dữ liệu sản phẩm, nhà cung cấp và danh sách chọn',
    isBuiltin: true,
    permissions: [
      'workspace.view', 'products.view', 'suppliers.view', 'shortlists.view'
    ]
  }
];

export class RoleRepository {
  private db: D1Database;
  private initialized = false;

  constructor(db: D1Database) {
    this.db = db;
  }

  public async ensureSeedData() {
    if (this.initialized) return;

    // Seed canonical permissions
    for (const p of CANONICAL_PERMISSIONS) {
      await this.db.prepare(
        `INSERT OR REPLACE INTO permissions (key, name, category, description) VALUES (?, ?, ?, ?)`
      ).bind(p.key, p.name, p.category, p.description).run();
    }

    // Seed builtin roles
    for (const r of BUILTIN_ROLES) {
      await this.db.prepare(
        `INSERT OR REPLACE INTO roles (id, name, description, is_builtin, created_at) VALUES (?, ?, ?, ?, ?)`
      ).bind(r.id, r.name, r.description, r.isBuiltin ? 1 : 0, new Date().toISOString()).run();

      for (const permKey of r.permissions) {
        await this.db.prepare(
          `INSERT OR REPLACE INTO role_permissions (role_id, permission_key) VALUES (?, ?)`
        ).bind(r.id, permKey).run();
      }
    }

    this.initialized = true;
  }

  public getCanonicalPermissions() {
    return CANONICAL_PERMISSIONS;
  }

  public async getAllRoles(): Promise<Role[]> {
    await this.ensureSeedData();
    const rolesRes = await this.db.prepare(`SELECT * FROM roles ORDER BY is_builtin DESC, name ASC`).all<any>();
    const roles = rolesRes.results || [];

    const rolePermsRes = await this.db.prepare(`SELECT * FROM role_permissions`).all<any>();
    const rolePerms = rolePermsRes.results || [];

    return roles.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isBuiltin: Boolean(r.is_builtin),
      permissions: rolePerms.filter(rp => rp.role_id === r.id).map(rp => rp.permission_key)
    }));
  }

  public async findById(roleId: string): Promise<Role | null> {
    await this.ensureSeedData();
    const role = await this.db.prepare(`SELECT * FROM roles WHERE id = ?`).bind(roleId).first<any>();
    if (!role) return null;

    const perms = await this.db.prepare(`SELECT permission_key FROM role_permissions WHERE role_id = ?`).bind(roleId).all<any>();
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isBuiltin: Boolean(role.is_builtin),
      permissions: (perms.results || []).map(p => p.permission_key)
    };
  }

  public async createCustomRole(name: string, description: string, permissionKeys: string[]): Promise<Role> {
    await this.ensureSeedData();

    // Server-side validation against canonical permissions
    const validPermKeys = new Set(CANONICAL_PERMISSIONS.map(p => p.key));
    for (const key of permissionKeys) {
      if (!validPermKeys.has(key as any)) {
        throw new Error(`Mã quyền '${key}' không hợp lệ theo danh mục chuẩn hệ thống`);
      }
    }

    const id = `role_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    await this.db.prepare(
      `INSERT INTO roles (id, name, description, is_builtin, created_at) VALUES (?, ?, ?, 0, ?)`
    ).bind(id, name, description, now).run();

    for (const p of permissionKeys) {
      await this.db.prepare(
        `INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)`
      ).bind(id, p).run();
    }

    return {
      id,
      name,
      description,
      isBuiltin: false,
      permissions: permissionKeys
    };
  }
}
