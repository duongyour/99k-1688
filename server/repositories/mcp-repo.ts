import crypto from 'crypto';
import { D1Database } from '../db/d1-interface.ts';
import { generateMcpToken, hashToken } from '../auth/crypto.ts';
import { UserRepository } from './user-repo.ts';
import { User, McpTokenInfo } from '../contracts/index.ts';

export class McpRepository {
  private db: D1Database;
  private userRepo: UserRepository;

  constructor(db: D1Database, userRepo: UserRepository) {
    this.db = db;
    this.userRepo = userRepo;
  }

  public async createToken(userId: string, clientName: string, scopes: string[]): Promise<{ rawToken: string; tokenInfo: McpTokenInfo }> {
    const { rawToken, tokenHash } = generateMcpToken();
    const tokenId = `mcp_tok_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    await this.db.prepare(
      `INSERT INTO mcp_tokens (id, token_hash, client_name, scopes_json, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(tokenId, tokenHash, clientName, JSON.stringify(scopes), userId, now).run();

    return {
      rawToken,
      tokenInfo: {
        id: tokenId,
        clientName,
        scopes,
        createdAt: now
      }
    };
  }

  public async verifyToken(rawToken: string): Promise<{ user: User; scopes: string[] } | null> {
    const tokenHash = hashToken(rawToken);

    // 1. Check direct MCP tokens
    const mcpRow = await this.db.prepare(
      `SELECT * FROM mcp_tokens WHERE token_hash = ? AND revoked_at IS NULL`
    ).bind(tokenHash).first<any>();

    if (mcpRow) {
      if (mcpRow.expires_at && new Date(mcpRow.expires_at) < new Date()) {
        return null;
      }
      const user = await this.userRepo.findById(mcpRow.user_id);
      if (!user || (user.status !== 'ACTIVE' && user.status !== 'OWNER')) {
        return null;
      }
      const scopes: string[] = typeof mcpRow.scopes_json === 'string' ? JSON.parse(mcpRow.scopes_json) : (mcpRow.scopes_json || []);
      return { user, scopes };
    }

    // 2. Check OAuth 2.1 Access Tokens
    const oauthRow = await this.db.prepare(
      `SELECT * FROM oauth_tokens WHERE token_hash = ? AND revoked_at IS NULL`
    ).bind(tokenHash).first<any>();

    if (oauthRow) {
      if (oauthRow.expires_at && new Date(oauthRow.expires_at) < new Date()) {
        return null;
      }
      const user = await this.userRepo.findById(oauthRow.user_id);
      if (!user || (user.status !== 'ACTIVE' && user.status !== 'OWNER')) {
        return null;
      }
      const scopes: string[] = typeof oauthRow.scopes_json === 'string' ? JSON.parse(oauthRow.scopes_json) : (oauthRow.scopes_json || []);
      return { user, scopes };
    }

    return null;
  }

  public async listTokens(userId?: string): Promise<McpTokenInfo[]> {
    let query = `SELECT id, client_name, scopes_json, created_at, expires_at, revoked_at FROM mcp_tokens`;
    let res;
    if (userId) {
      res = await this.db.prepare(`${query} WHERE user_id = ? ORDER BY created_at DESC`).bind(userId).all<any>();
    } else {
      res = await this.db.prepare(`${query} ORDER BY created_at DESC`).all<any>();
    }

    return (res.results || []).map(r => ({
      id: r.id,
      clientName: r.client_name,
      scopes: typeof r.scopes_json === 'string' ? JSON.parse(r.scopes_json) : (r.scopes_json || []),
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      revokedAt: r.revoked_at
    }));
  }

  public async revokeToken(tokenId: string): Promise<boolean> {
    const now = new Date().toISOString();
    await this.db.prepare(`UPDATE mcp_tokens SET revoked_at = ? WHERE id = ?`).bind(now, tokenId).run();
    return true;
  }

  // --- OAuth 2.1 Methods ---

  public async registerOAuthClient(params: {
    clientName: string;
    redirectUris: string[];
    allowedScopes: string[];
    isConfidential?: boolean;
  }): Promise<{ clientId: string; clientSecret?: string }> {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let clientSecret: string | undefined;
    let secretHash: string | null = null;

    if (params.isConfidential) {
      clientSecret = crypto.randomBytes(32).toString('hex');
      secretHash = hashToken(clientSecret);
    }

    const now = new Date().toISOString();
    await this.db.prepare(
      `INSERT INTO oauth_clients (
        client_id, client_name, client_secret_hash, redirect_uris_json, scopes_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      clientId, params.clientName, secretHash,
      JSON.stringify(params.redirectUris), JSON.stringify(params.allowedScopes),
      now
    ).run();

    return { clientId, clientSecret };
  }

  public async getClient(clientId: string): Promise<any> {
    const row = await this.db.prepare(`SELECT * FROM oauth_clients WHERE client_id = ?`).bind(clientId).first<any>();
    if (!row) return null;
    return {
      clientId: row.client_id,
      clientName: row.client_name,
      redirectUris: JSON.parse(row.redirect_uris_json || '[]'),
      allowedScopes: JSON.parse(row.scopes_json || '[]')
    };
  }

  public async createAuthCode(params: {
    clientId: string;
    userId: string;
    redirectUri: string;
    scopes: string[];
    codeChallenge: string;
    codeChallengeMethod: string;
  }): Promise<string> {
    // Validate client existence, redirectUri and scopes
    const client = await this.getClient(params.clientId);
    if (!client) {
      throw new Error(`Client ID '${params.clientId}' không tồn tại`);
    }
    if (!client.redirectUris.includes(params.redirectUri)) {
      throw new Error(`Redirect URI '${params.redirectUri}' không hợp lệ cho client này`);
    }
    for (const sc of params.scopes) {
      if (!client.allowedScopes.includes(sc)) {
        throw new Error(`Scope '${sc}' không được phép cho client này`);
      }
    }
    if (params.codeChallengeMethod !== 'S256') {
      throw new Error('Chỉ hỗ trợ code_challenge_method=S256');
    }

    const rawCode = crypto.randomBytes(32).toString('hex');
    const codeHash = hashToken(rawCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins
    const now = new Date().toISOString();

    await this.db.prepare(
      `INSERT INTO oauth_authorization_codes (
        code_hash, client_id, user_id, redirect_uri, scopes_json, code_challenge, code_challenge_method, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      codeHash, params.clientId, params.userId, params.redirectUri,
      JSON.stringify(params.scopes), params.codeChallenge, params.codeChallengeMethod, expiresAt, now
    ).run();

    return rawCode;
  }

  public async exchangeAuthCode(params: {
    clientId: string;
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<{ accessToken: string; expiresIn: number; scopes: string[] } | null> {
    const codeHash = hashToken(params.code);
    const row = await this.db.prepare(`SELECT * FROM oauth_authorization_codes WHERE code_hash = ?`).bind(codeHash).first<any>();
    if (!row) return null;

    // Remove code immediately (single use)
    await this.db.prepare(`DELETE FROM oauth_authorization_codes WHERE code_hash = ?`).bind(codeHash).run();

    if (new Date(row.expires_at) < new Date()) {
      return null;
    }

    if (row.client_id !== params.clientId || row.redirect_uri !== params.redirectUri) {
      return null;
    }

    // Verify PKCE
    let computedChallenge = '';
    if (row.code_challenge_method === 'S256') {
      computedChallenge = crypto.createHash('sha256').update(params.codeVerifier).digest('base64url');
    } else {
      computedChallenge = params.codeVerifier;
    }

    if (computedChallenge !== row.code_challenge) {
      return null; // PKCE mismatch
    }

    // Issue Token
    const rawToken = `mcp_oa_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = hashToken(rawToken);
    const now = new Date();
    const expiresIn = 3600 * 24; // 24 hours
    const expiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString();

    await this.db.prepare(
      `INSERT INTO oauth_tokens (
        token_hash, client_id, user_id, scopes_json, token_type, expires_at, created_at
      ) VALUES (?, ?, ?, ?, 'Bearer', ?, ?)`
    ).bind(tokenHash, row.client_id, row.user_id, row.scopes_json, expiresAt, now.toISOString()).run();

    const scopes = JSON.parse(row.scopes_json);
    return { accessToken: rawToken, expiresIn, scopes };
  }
}
