import { D1Database } from '../db/d1-interface.ts';
import { AuditLog } from '../contracts/index.ts';

export class AuditRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  public async logEvent(actor: { id?: string; name: string }, action: string, targetType: string, targetId?: string, details?: any): Promise<void> {
    const id = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    // Redact sensitive keys if details is an object
    let safeDetails = details;
    if (typeof details === 'object' && details !== null) {
      safeDetails = { ...details };
      delete safeDetails.password;
      delete safeDetails.token;
      delete safeDetails.apiKey;
      delete safeDetails.deviceSecret;
      delete safeDetails.rawGrant;
    }

    const detailsJson = typeof safeDetails === 'string' ? safeDetails : JSON.stringify(safeDetails || {});

    await this.db.prepare(
      `INSERT INTO audit_events (id, actor_id, actor_name, action, target_type, target_id, details_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, actor.id || null, actor.name, action, targetType, targetId || null, detailsJson, now).run();
  }

  public async listEvents(limit: number = 100): Promise<AuditLog[]> {
    const rows = await this.db.prepare(
      `SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?`
    ).bind(limit).all<any>();

    return (rows.results || []).map(r => ({
      id: r.id,
      actorId: r.actor_id,
      actorName: r.actor_name,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      details: r.details_json,
      createdAt: r.created_at
    }));
  }
}
