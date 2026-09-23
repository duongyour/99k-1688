import { D1Database } from '../db/d1-interface.ts';
import { User, UserStatus } from '../contracts/index.ts';
import { RoleRepository } from './role-repo.ts';

export class UserRepository {
  private db: D1Database;
  private roleRepo: RoleRepository;

  constructor(db: D1Database, roleRepo: RoleRepository) {
    this.db = db;
    this.roleRepo = roleRepo;
  }

  /**
   * Atomic first-user bootstrap
   * Enforces that the very first registered user atomically becomes OWNER.
   * Any subsequent or concurrent registration safely becomes PENDING_APPROVAL.
   */
  public async atomicRegisterUser(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    phone: string;
  }): Promise<{ user: User; isOwner: boolean }> {
    if (!data.phone || !data.phone.trim()) {
      throw new Error('Số điện thoại là bắt buộc khi đăng ký tài khoản');
    }

    const execute = async () => {
      await this.roleRepo.ensureSeedData();

      // Check existing email
      const existing = await this.db.prepare(`SELECT id FROM users WHERE email = ?`).bind(data.email.toLowerCase()).first<any>();
      if (existing) {
        throw new Error(`Email '${data.email}' đã được sử dụng`);
      }

      // 1. Check if an OWNER claim already exists in D1
      const existingClaim = await this.db.prepare(
        `SELECT user_id FROM owner_bootstrap_claim WHERE claim_key = 'SINGLETON_OWNER'`
      ).first<{ user_id: string }>();

      const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();

      if (existingClaim) {
        // Owner already claimed: user becomes PENDING_APPROVAL
        await this.db.batch([
          this.db.prepare(
            `INSERT INTO users (id, email, password_hash, password_algo, full_name, phone, created_at, updated_at)
             VALUES (?, ?, ?, 'pbkdf2_sha256', ?, ?, ?, ?)`
          ).bind(userId, data.email.toLowerCase(), data.passwordHash, data.fullName, data.phone, now, now),

          this.db.prepare(
            `INSERT INTO memberships (user_id, status, created_at)
             VALUES (?, 'PENDING_APPROVAL', ?)`
          ).bind(userId, now),

          this.db.prepare(
            `INSERT INTO member_roles (user_id, role_id)
             VALUES (?, 'role_researcher')`
          ).bind(userId)
        ]);

        const user = await this.findById(userId);
        if (!user) throw new Error('Không thể tạo người dùng');
        return { user, isOwner: false };
      }

      // No claim exists: attempt transactional claim in a D1 batch
      try {
        await this.db.batch([
          this.db.prepare(
            `INSERT INTO users (id, email, password_hash, password_algo, full_name, phone, created_at, updated_at)
             VALUES (?, ?, ?, 'pbkdf2_sha256', ?, ?, ?, ?)`
          ).bind(userId, data.email.toLowerCase(), data.passwordHash, data.fullName, data.phone, now, now),

          this.db.prepare(
            `INSERT INTO memberships (user_id, status, created_at)
             VALUES (?, 'OWNER', ?)`
          ).bind(userId, now),

          this.db.prepare(
            `INSERT INTO member_roles (user_id, role_id)
             VALUES (?, 'role_owner')`
          ).bind(userId),

          this.db.prepare(
            `INSERT INTO owner_bootstrap_claim (claim_key, user_id, claimed_at)
             VALUES ('SINGLETON_OWNER', ?, ?)`
          ).bind(userId, now)
        ]);

        const user = await this.findById(userId);
        if (!user) throw new Error('Không thể tạo người dùng');
        return { user, isOwner: true };
      } catch (err: any) {
        // Only fallback to PENDING_APPROVAL if the error is specifically the singleton owner claim conflict
        const isSingletonConflict = err?.message && (
          err.message.includes('owner_bootstrap_claim') ||
          err.message.includes('SINGLETON_OWNER') ||
          err.message.includes('claim_key')
        );

        if (!isSingletonConflict) {
          // Schema, syntax, foreign key, or DB connection error - MUST PROPAGATE
          throw err;
        }

        // Concurrency race: someone else claimed SINGLETON_OWNER. Fallback to PENDING_APPROVAL
        await this.db.batch([
          this.db.prepare(
            `INSERT INTO users (id, email, password_hash, password_algo, full_name, phone, created_at, updated_at)
             VALUES (?, ?, ?, 'pbkdf2_sha256', ?, ?, ?, ?)`
          ).bind(userId, data.email.toLowerCase(), data.passwordHash, data.fullName, data.phone, now, now),

          this.db.prepare(
            `INSERT INTO memberships (user_id, status, created_at)
             VALUES (?, 'PENDING_APPROVAL', ?)`
          ).bind(userId, now),

          this.db.prepare(
            `INSERT INTO member_roles (user_id, role_id)
             VALUES (?, 'role_researcher')`
          ).bind(userId)
        ]);

        const user = await this.findById(userId);
        if (!user) throw new Error('Không thể tạo người dùng');
        return { user, isOwner: false };
      }
    };

    if (typeof (this.db as any).withAtomicLock === 'function') {
      return await (this.db as any).withAtomicLock(execute);
    }
    return await execute();
  }

  public async findByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
    const row = await this.db.prepare(`SELECT * FROM users WHERE email = ?`).bind(email.toLowerCase()).first<any>();
    if (!row) return null;

    const baseUser = await this.findById(row.id);
    if (!baseUser) return null;

    return {
      ...baseUser,
      passwordHash: row.password_hash
    };
  }

  public async findById(userId: string): Promise<User | null> {
    const userRow = await this.db.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first<any>();
    if (!userRow) return null;

    const membershipRow = await this.db.prepare(`SELECT status FROM memberships WHERE user_id = ?`).bind(userId).first<any>();
    const status: UserStatus = membershipRow ? membershipRow.status : 'PENDING_APPROVAL';

    // Get user roles
    const memberRoles = await this.db.prepare(`SELECT role_id FROM member_roles WHERE user_id = ?`).bind(userId).all<any>();
    const roleIds = (memberRoles.results || []).map(r => r.role_id);

    const allRoles = await this.roleRepo.getAllRoles();
    const assignedRoles = allRoles.filter(r => roleIds.includes(r.id));

    const permSet = new Set<string>();
    assignedRoles.forEach(r => {
      r.permissions.forEach(p => permSet.add(p));
    });

    return {
      id: userRow.id,
      email: userRow.email,
      fullName: userRow.full_name,
      phone: userRow.phone,
      status,
      roles: assignedRoles.map(r => r.name),
      roleIds,
      permissions: Array.from(permSet),
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at
    };
  }

  public async listAll(): Promise<User[]> {
    const usersRes = await this.db.prepare(`SELECT id FROM users ORDER BY created_at ASC`).all<any>();
    const users: User[] = [];
    for (const u of usersRes.results || []) {
      const user = await this.findById(u.id);
      if (user) users.push(user);
    }
    return users;
  }

  public async updateMembershipStatus(userId: string, newStatus: UserStatus, approvedBy: string): Promise<User> {
    const target = await this.findById(userId);
    if (!target) throw new Error('Không tìm thấy tài khoản');

    // Rule: OWNER role is immutable from lower roles
    if (target.status === 'OWNER') {
      throw new Error('Không thể thay đổi trạng thái của tài khoản CHỦ SỞ HỮU (OWNER)');
    }

    const now = new Date().toISOString();
    await this.db.prepare(
      `UPDATE memberships SET status = ?, approved_by = ?, approved_at = ? WHERE user_id = ?`
    ).bind(newStatus, approvedBy, now, userId).run();

    const updated = await this.findById(userId);
    return updated!;
  }

  public async assignRoles(userId: string, roleIds: string[]): Promise<User> {
    const target = await this.findById(userId);
    if (!target) throw new Error('Không tìm thấy tài khoản');

    if (target.status === 'OWNER') {
      throw new Error('Không thể thay đổi vai trò của tài khoản CHỦ SỞ HỮU (OWNER)');
    }

    // Delete existing roles
    await this.db.prepare(`DELETE FROM member_roles WHERE user_id = ?`).bind(userId).run();

    // Assign new roles
    for (const rId of roleIds) {
      await this.db.prepare(
        `INSERT INTO member_roles (user_id, role_id) VALUES (?, ?)`
      ).bind(userId, rId).run();
    }

    return (await this.findById(userId))!;
  }

  public async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(
      `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`
    ).bind(newPasswordHash, now, userId).run();
  }
}
