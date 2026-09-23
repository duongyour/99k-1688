import { D1Database } from '../db/d1-interface.ts';
import { BrowserDevice } from '../contracts/index.ts';
import { generatePairGrant, hashToken } from '../auth/crypto.ts';
import crypto from 'node:crypto';

export class BrowserRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  public async getActiveDevice(): Promise<BrowserDevice | null> {
    // Return most recently seen device
    const row = await this.db.prepare(
      `SELECT d.*, c.is_logged_in_1688, c.human_action_required, c.human_action_reason, c.current_task
       FROM browser_devices d
       LEFT JOIN browser_connections c ON c.device_id = d.id
       ORDER BY d.created_at DESC LIMIT 1`
    ).first<any>();

    if (!row) return null;

    // Check if device is stale (silent for > 60 seconds)
    const isStale = row.last_seen ? (Date.now() - new Date(row.last_seen).getTime() > 60000) : true;
    const computedStatus = isStale ? 'DISCONNECTED' : (row.status || 'DISCONNECTED');

    return {
      id: row.id,
      name: row.name,
      status: computedStatus,
      ipAddress: row.ip_address,
      lastSeen: row.last_seen,
      pairedAt: row.paired_at,
      createdAt: row.created_at,
      isLoggedIn1688: Boolean(row.is_logged_in_1688),
      humanActionReason: row.human_action_reason,
      currentTask: row.current_task
    };
  }

  public async listDevices(): Promise<BrowserDevice[]> {
    const rows = await this.db.prepare(
      `SELECT d.*, c.is_logged_in_1688, c.human_action_required, c.human_action_reason, c.current_task
       FROM browser_devices d
       LEFT JOIN browser_connections c ON c.device_id = d.id
       ORDER BY d.created_at DESC`
    ).all<any>();

    return (rows.results || []).map(row => {
      const isStale = row.last_seen ? (Date.now() - new Date(row.last_seen).getTime() > 60000) : true;
      const computedStatus = isStale ? 'DISCONNECTED' : (row.status || 'DISCONNECTED');
      return {
        id: row.id,
        name: row.name,
        status: computedStatus,
        ipAddress: row.ip_address,
        lastSeen: row.last_seen,
        pairedAt: row.paired_at,
        createdAt: row.created_at,
        isLoggedIn1688: Boolean(row.is_logged_in_1688),
        humanActionReason: row.human_action_reason,
        currentTask: row.current_task
      };
    });
  }

  /**
   * Create short-lived, one-time pairing grant
   */
  public async createPairGrant(createdBy: string): Promise<{ rawGrant: string; expiresAt: string }> {
    const { rawGrant, grantHash } = generatePairGrant();
    const grantId = `grant_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 minutes

    await this.db.prepare(
      `INSERT INTO pair_grants (id, token_hash, created_by, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(grantId, grantHash, createdBy, expiresAt, now.toISOString()).run();

    return { rawGrant, expiresAt };
  }

  /**
   * Authenticated Device Pairing via one-time grant
   */
  public async pairDeviceWithGrant(rawGrant: string, deviceName: string, ipAddress?: string): Promise<{ deviceId: string; deviceSecret: string }> {
    const grantHash = hashToken(rawGrant);
    const grant = await this.db.prepare(
      `SELECT * FROM pair_grants WHERE token_hash = ?`
    ).bind(grantHash).first<any>();

    if (!grant) {
      throw new Error('Mã ghép nối không hợp lệ');
    }

    if (grant.used_at) {
      throw new Error('Mã ghép nối này đã được sử dụng');
    }

    if (new Date(grant.expires_at) < new Date()) {
      throw new Error('Mã ghép nối đã hết hạn');
    }

    // Mark grant used
    const now = new Date().toISOString();
    await this.db.prepare(`UPDATE pair_grants SET used_at = ? WHERE id = ?`).bind(now, grant.id).run();

    const deviceId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const secretHash = hashToken(rawSecret);

    await this.db.batch([
      this.db.prepare(
        `INSERT INTO browser_devices (id, name, pairing_token, device_secret, status, ip_address, paired_at, created_at)
         VALUES (?, ?, ?, ?, 'DISCONNECTED', ?, ?, ?)`
      ).bind(deviceId, deviceName, grantHash, secretHash, ipAddress || '127.0.0.1:16881', now, now),

      this.db.prepare(
        `INSERT INTO browser_connections (id, device_id, is_logged_in_1688, human_action_required, updated_at)
         VALUES (?, ?, 0, 0, ?)`
      ).bind(`conn_${deviceId}`, deviceId, now)
    ]);

    return { deviceId, deviceSecret: rawSecret };
  }

  /**
   * Authenticated Device Heartbeat
   */
  public async recordHeartbeat(params: {
    deviceId: string;
    deviceSecret: string;
    isLoggedIn1688: boolean;
    humanActionRequired?: boolean;
    humanActionReason?: string;
    currentTask?: string;
    ipAddress?: string;
  }): Promise<boolean> {
    const secretHash = hashToken(params.deviceSecret);
    const device = await this.db.prepare(
      `SELECT * FROM browser_devices WHERE id = ? AND device_secret = ?`
    ).bind(params.deviceId, secretHash).first<any>();

    if (!device) {
      throw new Error('Xác thực thiết bị máy trạm thất bại');
    }

    const now = new Date().toISOString();
    const status = params.humanActionRequired ? 'HUMAN_ACTION_REQUIRED' : 'CONNECTED';

    await this.db.batch([
      this.db.prepare(
        `UPDATE browser_devices SET status = ?, last_seen = ?, ip_address = COALESCE(?, ip_address) WHERE id = ?`
      ).bind(status, now, params.ipAddress || null, params.deviceId),

      this.db.prepare(
        `UPDATE browser_connections SET
           is_logged_in_1688 = ?,
           human_action_required = ?,
           human_action_reason = ?,
           current_task = ?,
           updated_at = ?
         WHERE device_id = ?`
      ).bind(
        params.isLoggedIn1688 ? 1 : 0,
        params.humanActionRequired ? 1 : 0,
        params.humanActionReason || null,
        params.currentTask || null,
        now,
        params.deviceId
      )
    ]);

    return true;
  }
}
