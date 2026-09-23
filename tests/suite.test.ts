import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { D1RelationalEngine } from '../server/db/d1-engine.ts';
import { RoleRepository, BUILTIN_ROLES } from '../server/repositories/role-repo.ts';
import { UserRepository } from '../server/repositories/user-repo.ts';
import { SessionRepository } from '../server/repositories/session-repo.ts';
import { BrowserRepository } from '../server/repositories/browser-repo.ts';
import { ResearchRepository } from '../server/repositories/research-repo.ts';
import { AIRepository } from '../server/repositories/ai-repo.ts';
import { McpRepository } from '../server/repositories/mcp-repo.ts';
import { AIModelRouter } from '../server/ai/model-router.ts';
import { RemoteMcpServer } from '../server/mcp/server.ts';
import { Adapter1688 } from '../server/browser/adapter-1688.ts';
import { CdpBrowserRuntime } from '../server/browser/cdp-runtime.ts';
import { hashPassword, verifyPassword, generateSessionToken, hashToken } from '../server/auth/crypto.ts';
import { CANONICAL_PERMISSIONS } from '../server/contracts/index.ts';

/**
 * 1688 PRODUCT RESEARCH - PHYSICAL VERIFICATION TEST SUITE
 * Verifies all 6 mandatory architectural domains against physical truth.
 */

describe('1. Cryptographic Security & Password Hashing', () => {
  it('should use PBKDF2 with unique per-password salts', () => {
    const password = 'SecretPassword123!';
    const hash1 = hashPassword(password);
    const hash2 = hashPassword(password);

    // Two hashes of the same password MUST have different salts and different hash strings
    assert.notStrictEqual(hash1, hash2, 'Salts must be unique per password');
    assert.ok(hash1.startsWith('pbkdf2_sha256$100000$'), 'Must use PBKDF2 with 100,000 iterations');

    // Both must verify correctly
    assert.strictEqual(verifyPassword(password, hash1), true);
    assert.strictEqual(verifyPassword(password, hash2), true);
    assert.strictEqual(verifyPassword('WrongPassword', hash1), false);
  });

  it('should store only hashed session tokens, never raw tokens', () => {
    const { rawToken, tokenHash } = generateSessionToken();
    assert.strictEqual(rawToken.length, 64);
    assert.strictEqual(tokenHash, hashToken(rawToken));
    assert.notStrictEqual(rawToken, tokenHash);
  });
});

describe('2. Atomic Owner Bootstrap & User Registration', () => {
  let db: D1RelationalEngine;
  let roleRepo: RoleRepository;
  let userRepo: UserRepository;

  beforeEach(() => {
    db = new D1RelationalEngine();
    roleRepo = new RoleRepository(db);
    userRepo = new UserRepository(db, roleRepo);
  });

  it('should atomically assign OWNER to the very first user and PENDING_APPROVAL to subsequent users', async () => {
    const user1 = await userRepo.atomicRegisterUser({
      email: 'owner@1688.vn',
      passwordHash: hashPassword('Pass123456!'),
      fullName: 'Nguyễn Chủ Sở Hữu',
      phone: '0901234567'
    });

    assert.strictEqual(user1.isOwner, true);
    assert.strictEqual(user1.user.status, 'OWNER');
    assert.ok(user1.user.roleIds?.includes('role_owner'));

    const user2 = await userRepo.atomicRegisterUser({
      email: 'member@1688.vn',
      passwordHash: hashPassword('Pass123456!'),
      fullName: 'Trần Nhân Viên',
      phone: '0907654321'
    });

    assert.strictEqual(user2.isOwner, false);
    assert.strictEqual(user2.user.status, 'PENDING_APPROVAL');
    assert.ok(user2.user.roleIds?.includes('role_researcher'));
  });

  it('should guarantee exactly one OWNER under concurrent registrations', async () => {
    const results = await Promise.all([
      userRepo.atomicRegisterUser({ email: 'concurrent1@1688.vn', passwordHash: hashPassword('Pass123!'), fullName: 'C1', phone: '0911111111' }),
      userRepo.atomicRegisterUser({ email: 'concurrent2@1688.vn', passwordHash: hashPassword('Pass123!'), fullName: 'C2', phone: '0922222222' }),
      userRepo.atomicRegisterUser({ email: 'concurrent3@1688.vn', passwordHash: hashPassword('Pass123!'), fullName: 'C3', phone: '0933333333' })
    ]);

    const owners = results.filter(r => r.isOwner);
    const pendings = results.filter(r => !r.isOwner);

    assert.strictEqual(owners.length, 1, 'Exactly one registration can become OWNER');
    assert.strictEqual(pendings.length, 2, 'All others must be PENDING_APPROVAL');
  });

  it('should prevent degrading or deactivating the OWNER account', async () => {
    const owner = await userRepo.atomicRegisterUser({
      email: 'owner_protect@1688.vn',
      passwordHash: hashPassword('Pass123456!'),
      fullName: 'Bảo Vệ Chủ Sở Hữu',
      phone: '0988888888'
    });

    await assert.rejects(
      async () => {
        await userRepo.updateMembershipStatus(owner.user.id, 'DEACTIVATED', 'Someone');
      },
      /Không thể thay đổi trạng thái của tài khoản CHỦ SỞ HỮU/
    );
  });
});

describe('3. Canonical RBAC & Single Source of Truth Permissions', () => {
  let db: D1RelationalEngine;
  let roleRepo: RoleRepository;

  beforeEach(() => {
    db = new D1RelationalEngine();
    roleRepo = new RoleRepository(db);
  });

  it('should have canonical permissions defined in one single location', () => {
    assert.ok(CANONICAL_PERMISSIONS.length >= 20);
    const keys = CANONICAL_PERMISSIONS.map(p => p.key);
    assert.ok(keys.includes('workspace.view'));
    assert.ok(keys.includes('research.create'));
    assert.ok(keys.includes('browser.manage'));
    assert.ok(keys.includes('ai.manage'));
    assert.ok(keys.includes('mcp.manage'));
  });

  it('should reject custom roles with invalid or hallucinated permissions', async () => {
    await assert.rejects(
      async () => {
        await roleRepo.createCustomRole('Role Lỗi', 'Mô tả', ['fake.permission', 'research.create']);
      },
      /không hợp lệ theo danh mục chuẩn/
    );
  });

  it('should successfully create custom role when permissions are valid', async () => {
    const custom = await roleRepo.createCustomRole('Role Chuyên Biệt', 'Chỉ xem và nghiên cứu', [
      'workspace.view',
      'research.create',
      'products.view'
    ]);
    assert.strictEqual(custom.permissions.length, 3);
    assert.strictEqual(custom.isBuiltin, false);
  });
});

describe('4. 1688 Domain Adapter & Accessory Trap Detection', () => {
  it('should reject accessory price traps when only screw/cable is cheap while main product exceeds budget', () => {
    const result = Adapter1688.verifyProductPricing({
      canonicalId: 'prod_trap_1',
      title: 'Giá đỡ điện thoại ô tô sạc không dây 15W',
      titleZh: '车载无线充手机支架',
      sourceUrl: 'https://detail.1688.com/offer/1.html',
      mainImage: '',
      priceMin: 5.5,
      priceMax: 48.0,
      moq: 1,
      supplierName: 'Xưởng Đồ Chơi Xe Hơi',
      variants: [
        { nameZh: '备用螺丝配件包 (Gói ốc vít dự phòng)', priceCny: 5.5 },
        { nameZh: 'Type-C 单线 (Dây sạc lẻ)', priceCny: 8.0 },
        { nameZh: '【标准版】车载支架主机 (Thân máy chính)', priceCny: 38.0 },
        { nameZh: '【高配版】车载无线充支架主机+夹头', priceCny: 48.0 }
      ],
      maxAllowedPriceCny: 30.0
    });

    assert.strictEqual(result.accessoryTrapDetected, true);
    assert.strictEqual(result.priceStatus, 'ACCESSORY_TRAP_REJECTED');
    assert.strictEqual(result.verifiedMainPrice, 38.0);
    assert.strictEqual(result.product.researchState, 'REJECTED');
  });

  it('should mark VERIFIED when genuine main product is within price ceiling', () => {
    const result = Adapter1688.verifyProductPricing({
      canonicalId: 'prod_valid_1',
      title: 'Giá đỡ điện thoại ô tô mini hợp kim',
      titleZh: '迷你合金车载手机支架',
      sourceUrl: 'https://detail.1688.com/offer/2.html',
      mainImage: '',
      priceMin: 18.5,
      priceMax: 24.0,
      moq: 2,
      supplierName: 'Xưởng Kim Khí Quảng Châu',
      variants: [
        { nameZh: '黑色标准款 (Bản chuẩn đen)', priceCny: 18.5 },
        { nameZh: '银色高光款 (Bản bóng bạc)', priceCny: 22.0 }
      ],
      maxAllowedPriceCny: 30.0
    });

    assert.strictEqual(result.accessoryTrapDetected, false);
    assert.strictEqual(result.priceStatus, 'VERIFIED');
    assert.strictEqual(result.verifiedMainPrice, 18.5);
    assert.strictEqual(result.product.researchState, 'NEW');
  });

  it('should detect Captcha / Risk Control and require human action', () => {
    const pageType = Adapter1688.detectPageType({
      url: 'https://sec.1688.com/query',
      title: '安全验证 - 请按住滑块拖动到最右边',
      observedNodes: [],
      timestamp: new Date().toISOString(),
      isCapturingRiskControl: true,
      isLoggedIn1688: false,
      rawTextExcerpt: '请按住滑块拖动到最右边完成验证码验证'
    });

    assert.strictEqual(pageType, 'RISK_CONTROL_CAPTCHA');
  });
});

describe('5. Browser Harness & Bounded Action Space', () => {
  it('should reject stale target mutations when Node ID is missing from observation', async () => {
    const runtime = new CdpBrowserRuntime();
    const result = await runtime.execute({
      actionType: 'CLICK',
      targetNodeId: 99999 // Non-existent node
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.staleTargetPrevented, true);
    assert.ok(result.message?.includes('Stale target rejected'));
  });
});

describe('6. Multi-AI Architecture & Task Router', () => {
  let db: D1RelationalEngine;
  let aiRepo: AIRepository;
  let router: AIModelRouter;

  beforeEach(() => {
    db = new D1RelationalEngine();
    aiRepo = new AIRepository(db);
    router = new AIModelRouter(aiRepo);
  });

  it('should register multiple AI providers including Gemini, OpenAI, Claude, OpenRouter, and Local AI', async () => {
    const providers = await aiRepo.getProviders();
    const types = providers.map(p => p.providerType);
    assert.ok(types.includes('gemini'));
    assert.ok(types.includes('openai'));
    assert.ok(types.includes('anthropic'));
    assert.ok(types.includes('openrouter'));
    assert.ok(types.includes('local_ai'));
  });

  it('should route task classes with primary and fallback models', async () => {
    const routing = await aiRepo.getRouting();
    assert.ok(routing.length >= 7);
    const translationRoute = routing.find(r => r.taskClass === 'KEYWORD_TRANSLATION');
    assert.ok(translationRoute);
    assert.strictEqual(translationRoute.primaryModelId, 'model_gemini_flash');
    assert.strictEqual(translationRoute.fallbackModelId, 'model_ollama_local');
  });
});

describe('7. Remote MCP Server (Streamable HTTP / JSON-RPC 2.0)', () => {
  let db: D1RelationalEngine;
  let roleRepo: RoleRepository;
  let userRepo: UserRepository;
  let researchRepo: ResearchRepository;
  let aiRepo: AIRepository;
  let aiRouter: AIModelRouter;
  let mcpRepo: McpRepository;
  let mcpServer: RemoteMcpServer;

  beforeEach(() => {
    db = new D1RelationalEngine();
    roleRepo = new RoleRepository(db);
    userRepo = new UserRepository(db, roleRepo);
    researchRepo = new ResearchRepository(db);
    aiRepo = new AIRepository(db);
    aiRouter = new AIModelRouter(aiRepo);
    mcpRepo = new McpRepository(db, userRepo);
    mcpServer = new RemoteMcpServer(mcpRepo, researchRepo, aiRouter);
  });

  it('should respond to JSON-RPC initialize handshake', async () => {
    const res = await mcpServer.handleJsonRpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05' }
    });

    assert.strictEqual(res.jsonrpc, '2.0');
    assert.strictEqual(res.id, 1);
    assert.strictEqual(res.result.serverInfo.name, '1688-research-mcp-server');
  });

  it('should list all 4 allowed MCP tools', async () => {
    const res = await mcpServer.handleJsonRpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    });

    assert.strictEqual(res.jsonrpc, '2.0');
    const tools = res.result.tools;
    assert.strictEqual(tools.length, 4);
    const names = tools.map((t: any) => t.name);
    assert.ok(names.includes('search_1688_products'));
    assert.ok(names.includes('verify_product_price'));
    assert.ok(names.includes('evaluate_facebook_ads'));
    assert.ok(names.includes('get_supplier_info'));
  });

  it('should strictly reject forbidden tools like purchase, payment, and bypass_captcha', async () => {
    const forbiddenRequests = ['purchase', 'payment', 'add_to_cart', 'bypass_captcha'];

    for (const toolName of forbiddenRequests) {
      const res = await mcpServer.handleJsonRpc({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: toolName, arguments: {} }
      });

      assert.ok(res.error, `Tool '${toolName}' must be rejected with error`);
      assert.strictEqual(res.error.code, -32001);
      assert.ok(res.error.message.includes('Quy tắc cấm tuyệt đối'));
    }
  });

  it('should verify pricing through MCP verify_product_price tool', async () => {
    // Setup authorized user and token
    const owner = await userRepo.atomicRegisterUser({
      email: 'mcp_owner@1688.vn',
      passwordHash: hashPassword('Pass123456!'),
      fullName: 'MCP User',
      phone: '0977777777'
    });

    const { rawToken } = await mcpRepo.createToken(owner.user.id, 'Claude Desktop', ['verify_product_price']);

    const res = await mcpServer.handleJsonRpc(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'verify_product_price',
          arguments: {
            title: 'Sản phẩm thử nghiệm',
            variants: [
              { nameZh: 'Ốc vít phụ kiện', priceCny: 5 },
              { nameZh: 'Máy chính', priceCny: 50 }
            ],
            maxAllowedPriceCny: 30
          }
        }
      },
      `Bearer ${rawToken}`
    );

    assert.ok(res.result);
    const content = JSON.parse(res.result.content[0].text);
    assert.strictEqual(content.accessoryTrapDetected, true);
    assert.strictEqual(content.priceStatus, 'ACCESSORY_TRAP_REJECTED');
  });
});
