import { McpRepository } from '../repositories/mcp-repo.ts';
import { ResearchRepository } from '../repositories/research-repo.ts';
import { Adapter1688 } from '../browser/adapter-1688.ts';
import { AIModelRouter } from '../ai/model-router.ts';

/**
 * Standards-Compliant Remote MCP Server (Streamable HTTP / JSON-RPC 2.0)
 * Mounted at canonical /mcp endpoint
 * Supported Tools:
 * - search_1688_products (scope: search_1688_products)
 * - verify_product_price (scope: verify_product_price)
 * - evaluate_facebook_ads (scope: evaluate_facebook_ads)
 * - get_supplier_info (scope: search_1688_products | get_supplier_info)
 * Strictly forbids: purchase, payment, add_to_cart, bypass_captcha
 * Zero fabrication: real queries and provenance-separated AI inferences
 */

const FORBIDDEN_TOOLS = new Set([
  'purchase', 'buy', 'order', 'payment', 'pay', 'checkout',
  'add_to_cart', 'supplier_message', 'chat_supplier',
  'bypass_captcha', 'solve_captcha', 'bypass_login'
]);

const TOOL_SCOPE_MAP: Record<string, string> = {
  'search_1688_products': 'search_1688_products',
  'verify_product_price': 'verify_product_price',
  'evaluate_facebook_ads': 'evaluate_facebook_ads',
  'get_supplier_info': 'search_1688_products'
};

export class RemoteMcpServer {
  private mcpRepo: McpRepository;
  private researchRepo: ResearchRepository;
  private aiRouter: AIModelRouter;

  constructor(mcpRepo: McpRepository, researchRepo: ResearchRepository, aiRouter: AIModelRouter) {
    this.mcpRepo = mcpRepo;
    this.researchRepo = researchRepo;
    this.aiRouter = aiRouter;
  }

  public async handleJsonRpc(reqBody: any, authHeader?: string): Promise<any> {
    const { jsonrpc, id, method, params } = reqBody;

    if (jsonrpc !== '2.0') {
      return { jsonrpc: '2.0', id: id || null, error: { code: -32600, message: 'Invalid Request: jsonrpc version must be 2.0' } };
    }

    // 1. Handshake initialize
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false },
            logging: {}
          },
          serverInfo: {
            name: '1688-research-mcp-server',
            version: '1.0.0'
          }
        }
      };
    }

    if (method === 'notifications/initialized') {
      return { jsonrpc: '2.0', id: null, result: {} };
    }

    // 2. Authentication check for subsequent methods
    let authenticatedUser: any = null;
    let authorizedScopes: string[] = [];

    if (authHeader) {
      const rawToken = authHeader.replace(/^Bearer\s+/i, '');
      const authResult = await this.mcpRepo.verifyToken(rawToken);
      if (authResult) {
        authenticatedUser = authResult.user;
        authorizedScopes = authResult.scopes;
      }
    }

    // 3. tools/list
    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'search_1688_products',
              description: 'Tìm kiếm sản phẩm 1688 bằng tiếng Việt tự nhiên kèm trần giá CNY và tiêu chí test Ads Việt Nam',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Nhu cầu tìm kiếm sản phẩm tiếng Việt' },
                  maxPriceCny: { type: 'number', description: 'Trần giá tối đa CNY (ví dụ: 30)' }
                },
                required: ['query']
              }
            },
            {
              name: 'verify_product_price',
              description: 'Bóc tách các biến thể SKU, phát hiện bẫy mồi giá phụ kiện (ốc vít, dây nguồn) và xác thực giá thật',
              inputSchema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  variants: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        nameZh: { type: 'string' },
                        priceCny: { type: 'number' }
                      },
                      required: ['nameZh', 'priceCny']
                    }
                  },
                  maxAllowedPriceCny: { type: 'number' }
                },
                required: ['title', 'variants']
              }
            },
            {
              name: 'evaluate_facebook_ads',
              description: 'Mô hình chấm điểm 10 tiêu chí Facebook Ads tại thị trường Việt Nam (Hook, Demo, Before/After, Headroom)',
              inputSchema: {
                type: 'object',
                properties: {
                  productTitle: { type: 'string' },
                  priceCny: { type: 'number' },
                  category: { type: 'string' }
                },
                required: ['productTitle']
              }
            },
            {
              name: 'get_supplier_info',
              description: 'Trích xuất thông tin tín hiệu xưởng, năm uy tín và xếp hạng của nhà cung cấp 1688 từ cơ sở dữ liệu thực tế',
              inputSchema: {
                type: 'object',
                properties: {
                  supplierId: { type: 'string' }
                },
                required: ['supplierId']
              }
            }
          ]
        }
      };
    }

    // 4. tools/call
    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      // Check forbidden tools
      if (FORBIDDEN_TOOLS.has(toolName)) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32001,
            message: `Quy tắc cấm tuyệt đối: Hệ thống 1688 Research Hub không hỗ trợ thao tác '${toolName}' (mua hàng, thanh toán hoặc can thiệp bảo mật).`
          }
        };
      }

      // Authentication Check
      if (!authenticatedUser) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32002, message: 'Yêu cầu Bearer Token hợp lệ để thực thi công cụ MCP' }
        };
      }

      // Scope Enforcement Check
      const requiredScope = TOOL_SCOPE_MAP[toolName];
      if (requiredScope && !authorizedScopes.includes(requiredScope) && !authorizedScopes.includes('*')) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32003,
            message: `Token thiếu quyền truy cập (scope). Công cụ '${toolName}' yêu cầu scope '${requiredScope}'. Quyền hiện có: [${authorizedScopes.join(', ')}]`
          }
        };
      }

      try {
        const toolResult = await this.executeTool(toolName, toolArgs, authenticatedUser);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(toolResult, null, 2) }]
          }
        };
      } catch (err: any) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32603, message: `Tool execution error: ${err.message}` }
        };
      }
    }

    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` }
    };
  }

  private async executeTool(toolName: string, args: any, user: any): Promise<any> {
    switch (toolName) {
      case 'search_1688_products': {
        const job = await this.researchRepo.createJob({
          title: args.query,
          rawQuery: args.query,
          creatorId: user.id,
          creatorName: user.fullName,
          maxPriceCny: args.maxPriceCny || 30.0,
          chineseKeywords: [args.query, `${args.query} 批发`, `${args.query} 厂家直销`]
        });
        return { success: true, jobId: job.id, status: job.status, chineseKeywords: job.chineseKeywords };
      }

      case 'verify_product_price': {
        const check = Adapter1688.verifyProductPricing({
          canonicalId: 'mcp_check',
          title: args.title || 'Sản phẩm 1688',
          titleZh: args.title || '',
          sourceUrl: 'https://detail.1688.com',
          mainImage: '',
          priceMin: 0,
          priceMax: 100,
          moq: 1,
          supplierName: 'Xưởng 1688',
          variants: args.variants || [],
          maxAllowedPriceCny: args.maxAllowedPriceCny || 30.0
        });
        return {
          priceStatus: check.priceStatus,
          verifiedMainPrice: check.verifiedMainPrice,
          accessoryTrapDetected: check.accessoryTrapDetected,
          meetsCeiling: check.priceStatus === 'VERIFIED'
        };
      }

      case 'evaluate_facebook_ads': {
        const aiEvaluation = await this.aiRouter.routeTask('PRODUCT_EVALUATION', {
          titleZh: args.productTitle,
          variantPrice: args.priceCny || 25.0,
          category: args.category || 'Gia dụng thông minh'
        });

        return {
          scores: aiEvaluation.scores,
          recommendationStatus: aiEvaluation.recommendationStatus,
          strengths: aiEvaluation.strengths,
          risks: aiEvaluation.risks,
          retailHeadroomHypothesis: aiEvaluation.retailHeadroomHypothesis || `Biên lợi nhuận bán lẻ ước tính x3 - x4 giá nhập ${args.priceCny || 25} CNY`
        };
      }

      case 'get_supplier_info': {
        const detail = await this.researchRepo.getSupplierById(args.supplierId);
        if (!detail) {
          return {
            found: false,
            supplierId: args.supplierId,
            message: 'Không tìm thấy nhà cung cấp trong cơ sở dữ liệu thực tế'
          };
        }
        return {
          found: true,
          supplier: detail.supplier,
          productCount: detail.products.length
        };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
