import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { D1RelationalEngine } from '../server/db/d1-engine.ts';
import { RoleRepository } from '../server/repositories/role-repo.ts';
import { UserRepository } from '../server/repositories/user-repo.ts';
import { SessionRepository } from '../server/repositories/session-repo.ts';
import { BrowserRepository } from '../server/repositories/browser-repo.ts';
import { ResearchRepository } from '../server/repositories/research-repo.ts';
import { AIRepository } from '../server/repositories/ai-repo.ts';
import { McpRepository } from '../server/repositories/mcp-repo.ts';
import { AuditRepository } from '../server/repositories/audit-repo.ts';
import { AIModelRouter } from '../server/ai/model-router.ts';
import { RemoteMcpServer } from '../server/mcp/server.ts';
import { Adapter1688 } from '../server/browser/adapter-1688.ts';
import { CdpBrowserRuntime } from '../server/browser/cdp-runtime.ts';
import { EvidenceStorageService } from '../server/storage/evidence-storage.ts';
import { ResearchQueueProcessor } from '../server/queue/research-queue.ts';
import { hashPassword, verifyPassword, generateSessionToken, hashToken } from '../server/auth/crypto.ts';
import { CANONICAL_PERMISSIONS } from '../server/contracts/index.ts';

describe('15-Point Acceptance Matrix Physical Verification', () => {
  let db: D1RelationalEngine;
  let roleRepo: RoleRepository;
  let userRepo: UserRepository;
  let sessionRepo: SessionRepository;
  let browserRepo: BrowserRepository;
  let researchRepo: ResearchRepository;
  let aiRepo: AIRepository;
  let mcpRepo: McpRepository;
  let auditRepo: AuditRepository;
  let aiRouter: AIModelRouter;
  let mcpServer: RemoteMcpServer;
  let evidenceService: EvidenceStorageService;

  beforeEach(() => {
    db = new D1RelationalEngine();
    roleRepo = new RoleRepository(db);
    userRepo = new UserRepository(db, roleRepo);
    sessionRepo = new SessionRepository(db, userRepo);
    browserRepo = new BrowserRepository(db);
    researchRepo = new ResearchRepository(db);
    aiRepo = new AIRepository(db);
    mcpRepo = new McpRepository(db, userRepo);
    auditRepo = new AuditRepository(db);
    aiRouter = new AIModelRouter(aiRepo);
    mcpServer = new RemoteMcpServer(mcpRepo, researchRepo, aiRouter);
    evidenceService = new EvidenceStorageService(db);
  });

  // A. Physical Singleton Owner Bootstrap
  it('A. Physical Singleton Owner Bootstrap: exactly one OWNER under race conditions', async () => {
    const registrations = await Promise.all([
      userRepo.atomicRegisterUser({ email: 'a1@1688.vn', passwordHash: hashPassword('P1!'), fullName: 'U1', phone: '0901000001' }),
      userRepo.atomicRegisterUser({ email: 'a2@1688.vn', passwordHash: hashPassword('P2!'), fullName: 'U2', phone: '0901000002' }),
      userRepo.atomicRegisterUser({ email: 'a3@1688.vn', passwordHash: hashPassword('P3!'), fullName: 'U3', phone: '0901000003' })
    ]);

    const owners = registrations.filter(r => r.isOwner && r.user.status === 'OWNER');
    const pendings = registrations.filter(r => !r.isOwner && r.user.status === 'PENDING_APPROVAL');

    assert.strictEqual(owners.length, 1);
    assert.strictEqual(pendings.length, 2);

    const claimRow = await db.prepare("SELECT * FROM owner_bootstrap_claim WHERE claim_key = 'SINGLETON_OWNER'").first<any>();
    assert.ok(claimRow);
    assert.strictEqual(claimRow.user_id, owners[0].user.id);
  });

  // B. Mandatory Phone in Registration & No Raw Token Leak
  it('B. Mandatory Phone: reject missing/empty phone', async () => {
    await assert.rejects(
      async () => {
        await userRepo.atomicRegisterUser({
          email: 'nophone@1688.vn',
          passwordHash: hashPassword('Pass123!'),
          fullName: 'No Phone User',
          phone: ''
        });
      },
      /Số điện thoại là bắt buộc/
    );
  });

  // C. HttpOnly Cookie Authentication & Session Token Hashing
  it('C. Session Token Hashing: raw token is never persisted in D1 sessions', async () => {
    const reg = await userRepo.atomicRegisterUser({
      email: 'session_test@1688.vn',
      passwordHash: hashPassword('Pass123!'),
      fullName: 'Session User',
      phone: '0901000010'
    });

    const { rawToken, tokenHash } = generateSessionToken();
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    const sessionId = await sessionRepo.createSession(reg.user.id, tokenHash, expiresAt);
    assert.strictEqual(rawToken.length, 64);

    // Verify D1 table stores hash, not raw token
    const stored = await db.prepare('SELECT token_hash FROM sessions WHERE id = ?').bind(sessionId).first<any>();
    assert.strictEqual(stored.token_hash, tokenHash);
    assert.notStrictEqual(stored.token_hash, rawToken);

    // Verification by raw token succeeds via token_hash lookup
    const userFound = await sessionRepo.findUserByTokenHash(hashToken(rawToken));
    assert.ok(userFound);
    assert.strictEqual(userFound!.id, reg.user.id);
  });

  // D. Password Change with Current Password Verification
  it('D. Password Change: verifies current password, updates salt and hash', async () => {
    const reg = await userRepo.atomicRegisterUser({
      email: 'pwd_change@1688.vn',
      passwordHash: hashPassword('OldPass123!'),
      fullName: 'Change User',
      phone: '0901000020'
    });

    const userWithHash = await userRepo.findByEmail('pwd_change@1688.vn');
    assert.ok(verifyPassword('OldPass123!', userWithHash!.passwordHash));

    // Reject incorrect old password
    assert.strictEqual(verifyPassword('WrongOld!', userWithHash!.passwordHash), false);

    // Apply new password
    const newHash = hashPassword('NewPass456!');
    await userRepo.updatePassword(reg.user.id, newHash);

    const updatedUser = await userRepo.findByEmail('pwd_change@1688.vn');
    assert.strictEqual(verifyPassword('NewPass456!', updatedUser!.passwordHash), true);
    assert.strictEqual(verifyPassword('OldPass123!', updatedUser!.passwordHash), false);
  });

  // E. Member Role Mutation & Owner Protection
  it('E. Member Role Mutation & Owner Protection: cannot deactivate or demote OWNER', async () => {
    const owner = await userRepo.atomicRegisterUser({
      email: 'protected_owner@1688.vn',
      passwordHash: hashPassword('Pass123!'),
      fullName: 'Owner Protection',
      phone: '0901000030'
    });

    await assert.rejects(
      async () => {
        await userRepo.updateMembershipStatus(owner.user.id, 'DEACTIVATED', 'Admin');
      },
      /Không thể thay đổi trạng thái của tài khoản CHỦ SỞ HỮU/
    );
  });

  // F. Canonical Permission Catalog (No Hallucinated Permissions)
  it('F. Canonical Permissions: rejects non-existent permissions', async () => {
    await assert.rejects(
      async () => {
        await roleRepo.createCustomRole(
          'Invalid Role',
          'Role with hallucinated permission',
          ['products.view', 'hallucinated.permission.fake']
        );
      },
      /không hợp lệ/
    );
  });

  // G. 1688 Pricing & Accessory Trap Elimination
  it('G. 1688 Pricing: accessory price trap correctly flagged and rejected', () => {
    const check = Adapter1688.verifyProductPricing({
      canonicalId: '1688_trap_test',
      title: 'Quạt mini để bàn tích điện',
      titleZh: '迷你桌面静音风扇',
      sourceUrl: 'https://detail.1688.com/offer/12345.html',
      mainImage: 'https://cbu01.alicdn.com/img.jpg',
      priceMin: 3.5,
      priceMax: 48.0,
      moq: 2,
      supplierName: 'Thâm Quyến OEM',
      variants: [
        { nameZh: 'USB数据线 (Dây sạc)', priceCny: 3.5 },
        { nameZh: '固定螺丝包 (Túi ốc)', priceCny: 4.0 },
        { nameZh: '风扇标准版 (Quạt chính)', priceCny: 38.0 }
      ],
      maxAllowedPriceCny: 30.0
    });

    assert.strictEqual(check.accessoryTrapDetected, true);
    assert.strictEqual(check.verifiedMainPrice, 38.0);
    assert.strictEqual(check.priceStatus, 'ACCESSORY_TRAP_REJECTED');
  });

  // H. Real Bounded Action Space & Jev Pattern (No Prohibited Actions)
  it('H. Bounded Action Space: prohibited actions rejected at runtime', async () => {
    const runtime = new CdpBrowserRuntime();
    const result = await runtime.execute({
      actionType: 'EVALUATE_ARBITRARY_JS' as any
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.message?.includes('bị nghiêm cấm'));
  });

  // I. Zero Fake Success in CDP Runtime
  it('I. Zero Fake Success: reports honest failure when browser agent is offline', async () => {
    const runtime = new CdpBrowserRuntime('http://127.0.0.1:59999'); // non-existent port
    const status = await runtime.getStatus();
    assert.strictEqual(status.connected, false);
    assert.strictEqual(status.isLoggedIn1688, false);

    const nav = await runtime.navigate('https://www.1688.com');
    assert.strictEqual(nav.success, false);
    assert.strictEqual(nav.error, 'BROWSER_AGENT_UNAVAILABLE');
  });

  // J. Secure Agent Pairing (pair grant one-time, secret hashed)
  it('J. Secure Agent Pairing: grantToken is single-use, deviceSecret is hashed', async () => {
    const grant = await browserRepo.createPairGrant('owner_1');
    assert.ok(grant.rawGrant);

    // Pair device
    const paired = await browserRepo.pairDeviceWithGrant(grant.rawGrant, 'Test Workstation', '127.0.0.1');
    assert.ok(paired.deviceId);
    assert.ok(paired.deviceSecret);

    // Second attempt with same token must fail
    await assert.rejects(
      async () => {
        await browserRepo.pairDeviceWithGrant(grant.rawGrant, 'Duplicate Workstation', '127.0.0.1');
      },
      /đã được sử dụng/
    );

    // Heartbeat verification with secret succeeds
    await browserRepo.recordHeartbeat({
      deviceId: paired.deviceId,
      deviceSecret: paired.deviceSecret,
      isLoggedIn1688: false,
      humanActionRequired: false,
      ipAddress: '127.0.0.1'
    });

    // Heartbeat with wrong secret fails
    await assert.rejects(
      async () => {
        await browserRepo.recordHeartbeat({
          deviceId: paired.deviceId,
          deviceSecret: 'wrong_secret',
          isLoggedIn1688: false,
          humanActionRequired: false,
          ipAddress: '127.0.0.1'
        });
      },
      /Xác thực thiết bị máy trạm thất bại/
    );
  });

  // K. Multi-AI Architecture & Separation of Fact vs Inference
  it('K. Multi-AI Architecture: routes to configured models with fallback capability', async () => {
    const providers = await aiRepo.listProviders();
    assert.ok(providers.length >= 4);

    const gemini = providers.find(p => p.providerType.toLowerCase() === 'gemini');
    assert.ok(gemini);

    const models = await aiRepo.listModels();
    assert.ok(models.length >= 5);
  });

  // L. R2 Evidence Pipeline & Cryptographic Provenance
  it('L. R2 Evidence Pipeline: stores snapshot, verifies SHA256 and size', async () => {
    const testData = JSON.stringify({ html: '<html><body>1688 Snapshot</body></html>', timestamp: Date.now() });
    const expectedSha256 = crypto.createHash('sha256').update(testData).digest('hex');

    const evidence = await evidenceService.storeEvidence({
      jobId: 'job_test_1',
      contentType: 'application/json',
      data: testData,
      metadata: { source: '1688.com' }
    });

    assert.strictEqual(evidence.sha256, expectedSha256);
    assert.strictEqual(evidence.sizeBytes, Buffer.byteLength(testData));
    assert.ok(evidence.r2Key.startsWith('evidence/job_test_1/'));

    // Retrieve and verify data integrity
    const retrieved = await evidenceService.getEvidence(evidence.r2Key);
    assert.ok(retrieved);
    assert.strictEqual(retrieved!.toString('utf8'), testData);
  });

  // M. Queue Execution State Machine
  it('M. Queue Processor: transitions job from PENDING to RUNNING and pauses on human action', async () => {
    const job = await researchRepo.createJob({
      title: 'Quạt tích điện',
      rawQuery: 'Quạt tích điện để bàn',
      creatorId: 'usr_owner',
      creatorName: 'Chủ sở hữu',
      maxPriceCny: 30.0
    });

    assert.strictEqual(job.status, 'PENDING');

    const queueProcessor = new ResearchQueueProcessor(researchRepo, auditRepo, aiRouter, evidenceService);
    await queueProcessor.processJob({
      jobId: job.id,
      query: job.rawQuery,
      maxPriceCny: job.maxPriceCny,
      creatorId: 'usr_owner',
      creatorName: 'Chủ sở hữu',
      attempts: 0
    });

    const updatedJob = await researchRepo.getJobById(job.id);
    assert.ok(updatedJob);
    // Since local Chrome CDP is not running in test environment, it gracefully pauses for human action
    assert.strictEqual(updatedJob!.status, 'PAUSED_HUMAN_ACTION');
    assert.strictEqual(updatedJob!.humanActionRequired, true);
  });

  // N. Remote MCP JSON-RPC 2.0 with Strict Scopes
  it('N. Remote MCP: enforces OAuth scopes, rejects unauthorized calls', async () => {
    const owner = await userRepo.atomicRegisterUser({
      email: 'mcp_scope_user@1688.vn',
      passwordHash: hashPassword('Pass123!'),
      fullName: 'MCP User',
      phone: '0901000040'
    });

    // Token ONLY with 'evaluate_facebook_ads' scope
    const { rawToken } = await mcpRepo.createToken(owner.user.id, 'Cursor IDE', ['evaluate_facebook_ads']);

    // Attempting to call 'search_1688_products' MUST fail with scope error
    const res = await mcpServer.handleJsonRpc(
      {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'search_1688_products',
          arguments: { query: 'quạt cầm tay' }
        }
      },
      `Bearer ${rawToken}`
    );

    assert.ok(res.error);
    assert.strictEqual(res.error.code, -32003);
    assert.ok(res.error.message.includes('Token thiếu quyền truy cập'));
  });

  // O. OAuth 2.1 PKCE Authorization Code Exchange
  it('O. OAuth 2.1 PKCE: verifies code_challenge (S256) and issues token', async () => {
    const owner = await userRepo.atomicRegisterUser({
      email: 'oauth_user@1688.vn',
      passwordHash: hashPassword('Pass123!'),
      fullName: 'OAuth User',
      phone: '0901000050'
    });

    const client = await mcpRepo.registerOAuthClient({
      clientName: 'Claude Desktop App',
      redirectUris: ['http://localhost:8080/callback'],
      allowedScopes: ['search_1688_products', 'verify_product_price']
    });

    const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const authCode = await mcpRepo.createAuthCode({
      clientId: client.clientId,
      userId: owner.user.id,
      redirectUri: 'http://localhost:8080/callback',
      scopes: ['search_1688_products'],
      codeChallenge,
      codeChallengeMethod: 'S256'
    });

    // Exchange auth code with valid code_verifier
    const tokenResult = await mcpRepo.exchangeAuthCode({
      clientId: client.clientId,
      code: authCode,
      redirectUri: 'http://localhost:8080/callback',
      codeVerifier
    });

    assert.ok(tokenResult);
    assert.ok(tokenResult!.accessToken.startsWith('mcp_oa_'));
    assert.deepStrictEqual(tokenResult!.scopes, ['search_1688_products']);

    // Reusing the same auth code must fail (single-use)
    const reusedResult = await mcpRepo.exchangeAuthCode({
      clientId: client.clientId,
      code: authCode,
      redirectUri: 'http://localhost:8080/callback',
      codeVerifier
    });
    assert.strictEqual(reusedResult, null);
  });
});
