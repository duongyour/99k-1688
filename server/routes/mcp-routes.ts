import { Router, Request, Response } from 'express';
import { McpRepository } from '../repositories/mcp-repo.ts';
import { RemoteMcpServer } from '../mcp/server.ts';
import { AuditRepository } from '../repositories/audit-repo.ts';
import { requireAuth, requirePermission } from '../auth/middleware.ts';

export function createMcpRouter(
  mcpServer: RemoteMcpServer,
  mcpRepo: McpRepository,
  auditRepo: AuditRepository
) {
  const router = Router();

  // Canonical Remote MCP endpoint (Streamable HTTP / JSON-RPC 2.0)
  router.post('/mcp', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const response = await mcpServer.handleJsonRpc(req.body, authHeader);
      return res.json(response);
    } catch (err: any) {
      return res.status(500).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: { code: -32603, message: `Internal server error: ${err.message}` }
      });
    }
  });

  // Token Management Endpoints
  router.get('/api/mcp/tokens', requireAuth, requirePermission('mcp.view'), async (req: Request, res: Response) => {
    try {
      const tokens = await mcpRepo.listTokens(req.user!.status === 'OWNER' ? undefined : req.user!.id);
      return res.json({ tokens });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/mcp/tokens', requireAuth, requirePermission('mcp.manage'), async (req: Request, res: Response) => {
    try {
      const { clientName, scopes = ['search_1688_products', 'verify_product_price', 'evaluate_facebook_ads'] } = req.body;

      if (!clientName) {
        return res.status(400).json({ error: 'Tên định danh ứng dụng/client là bắt buộc' });
      }

      const { rawToken, tokenInfo } = await mcpRepo.createToken(req.user!.id, clientName, scopes);

      await auditRepo.logEvent(
        { id: req.user!.id, name: req.user!.fullName },
        'MCP_TOKEN_CREATE',
        'mcp_token',
        tokenInfo.id,
        { clientName, scopes }
      );

      return res.json({
        rawToken,
        tokenInfo,
        message: 'Khóa MCP Token đã được tạo. Vui lòng sao chép ngay vì khóa sẽ không được hiển thị lại.'
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.delete('/api/mcp/tokens/:id', requireAuth, requirePermission('mcp.manage'), async (req: Request, res: Response) => {
    try {
      await mcpRepo.revokeToken(req.params.id);

      await auditRepo.logEvent(
        { id: req.user!.id, name: req.user!.fullName },
        'MCP_TOKEN_REVOKE',
        'mcp_token',
        req.params.id
      );

      return res.json({ success: true, message: 'Đã thu hồi khóa MCP Token' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
