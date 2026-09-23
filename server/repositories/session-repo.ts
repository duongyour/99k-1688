import { D1Database } from '../db/d1-interface.ts';
import { UserRepository } from './user-repo.ts';
import { User } from '../contracts/index.ts';

export class SessionRepository {
  private db: D1Database;
  private userRepo: UserRepository;

  constructor(db: D1Database, userRepo: UserRepository) {
    this.db = db;
    this.userRepo = userRepo;
  }

  public async createSession(userId: string, tokenHash: string, expiresAt: string) {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    await this.db.prepare(
      `INSERT INTO sessions (id, token_hash, user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(sessionId, tokenHash, userId, expiresAt, now).run();

    return sessionId;
  }

  public async findUserByTokenHash(tokenHash: string): Promise<User | null> {
    const session = await this.db.prepare(
      `SELECT * FROM sessions WHERE token_hash = ?`
    ).bind(tokenHash).first<any>();

    if (!session) return null;

    if (new Date(session.expires_at) < new Date()) {
      // Expired session
      await this.revokeSession(tokenHash);
      return null;
    }

    return this.userRepo.findById(session.user_id);
  }

  public async revokeSession(tokenHash: string): Promise<boolean> {
    await this.db.prepare(
      `DELETE FROM sessions WHERE token_hash = ?`
    ).bind(tokenHash).run();
    return true;
  }

  public async revokeAllUserSessions(userId: string): Promise<void> {
    await this.db.prepare(
      `DELETE FROM sessions WHERE user_id = ?`
    ).bind(userId).run();
  }
}
