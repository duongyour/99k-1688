import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../server/app.ts';
import { D1RelationalEngine } from '../server/db/d1-engine.ts';

/**
 * Physical Integration Test Suite
 * Validates that all critical paths (/api/health, /api/auth, /api/products, /api/suppliers,
 * /api/browser, /mcp, and OAuth routes) are properly wired and behave according to specifications.
 */

describe('Physical End-to-End API Integration', () => {
  let app: any;
  let server: any;
  let baseUrl: string;
  let ownerCookie = '';

  before(async () => {
    const testDb = new D1RelationalEngine();
    const appBundle = createApp(testDb);
    app = appBundle.app;

    await new Promise<void>((resolve) => {
      // Bind to an ephemeral port for testing
      server = app.listen(0, '127.0.0.1', () => {
        const address: any = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  it('GET /api/health returns healthy system status with D1 and MCP info', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(body.mcpEndpoint, '/mcp');
    assert.ok(body.engine.includes('Cloudflare D1'));
  });

  it('POST /api/auth/register creates initial OWNER without exposing raw session token in JSON', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'integration_owner@1688.vn',
        password: 'Password123!',
        fullName: 'Integration Owner',
        phone: '0901234567'
      })
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.user.email, 'integration_owner@1688.vn');
    assert.strictEqual(body.user.status, 'OWNER');
    assert.strictEqual(body.isOwner, true);
    // Critical: raw session token must NOT be in the JSON payload
    assert.strictEqual(body.token, undefined);
    assert.strictEqual(body.sessionToken, undefined);

    // Cookie must contain session_token
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes('session_token='));
    assert.ok(setCookie.includes('HttpOnly'));
    ownerCookie = setCookie.split(';')[0];
  });

  it('POST /api/auth/login logs in user and sets HttpOnly cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'integration_owner@1688.vn',
        password: 'Password123!'
      })
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.user.email, 'integration_owner@1688.vn');
    assert.strictEqual(body.token, undefined);

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes('session_token='));
    ownerCookie = setCookie.split(';')[0];
  });

  it('GET /api/products returns empty array when authenticated as OWNER', async () => {
    const res = await fetch(`${baseUrl}/api/products`, {
      headers: { Cookie: ownerCookie }
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.ok(Array.isArray(body.products));
    assert.strictEqual(body.products.length, 0);
  });

  it('GET /api/suppliers returns empty array when authenticated as OWNER', async () => {
    const res = await fetch(`${baseUrl}/api/suppliers`, {
      headers: { Cookie: ownerCookie }
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.ok(Array.isArray(body.suppliers));
    assert.strictEqual(body.suppliers.length, 0);
  });

  it('POST /mcp handles JSON-RPC 2.0 initialize handshake', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      })
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.jsonrpc, '2.0');
    assert.strictEqual(body.id, 1);
    assert.ok(body.result.serverInfo.name);
  });

  it('POST /mcp lists tools and verifies zero forbidden operations', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      })
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    const tools: any[] = body.result.tools;
    assert.ok(Array.isArray(tools));
    const toolNames = tools.map(t => t.name);

    assert.ok(toolNames.includes('search_1688_products'));
    assert.ok(toolNames.includes('verify_product_price'));
    assert.ok(toolNames.includes('evaluate_facebook_ads'));
    assert.ok(toolNames.includes('get_supplier_info'));

    // Forbidden tools must NOT exist
    assert.strictEqual(toolNames.includes('buy'), false);
    assert.strictEqual(toolNames.includes('purchase'), false);
    assert.strictEqual(toolNames.includes('payment'), false);
    assert.strictEqual(toolNames.includes('solve_captcha'), false);
  });

  it('POST /mcp rejects calls without authentication', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'search_1688_products',
          arguments: { query: 'test' }
        }
      })
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.ok(body.error);
    assert.strictEqual(body.error.code, -32002);
  });

  it('GET /api/browser/status returns disconnected status honestly when authenticated', async () => {
    const res = await fetch(`${baseUrl}/api/browser/status`, {
      headers: { Cookie: ownerCookie }
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.connected, false);
    assert.strictEqual(body.device, null);
    assert.strictEqual(body.isLoggedIn1688, false);
  });
});
