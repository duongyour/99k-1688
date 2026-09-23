import React, { useState, useEffect } from 'react';
import { Cpu, Key, Terminal, Copy, CheckCircle2, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { getAuthHeaders } from '../context/AuthContext.tsx';
import { McpTokenInfo } from '../types.ts';

export const IntegrationsPage: React.FC = () => {
  const [tokens, setTokens] = useState<McpTokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newClientName, setNewClientName] = useState('');
  const [createdRawToken, setCreatedRawToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mcpTools = [
    { name: 'search_1688_products', desc: 'Tìm kiếm sản phẩm 1688 bằng tiếng Việt tự nhiên kèm trần giá CNY và tiêu chí Facebook Ads.' },
    { name: 'verify_product_price', desc: 'Bóc tách các biến thể SKU, phát hiện bẫy mồi giá phụ kiện (ốc vít, dây nguồn) và xác thực giá thật.' },
    { name: 'evaluate_facebook_ads', desc: 'Mô hình chấm điểm 10 tiêu chí Facebook Ads tại thị trường Việt Nam (Hook, Demo, Before/After, Headroom).' },
    { name: 'get_supplier_info', desc: 'Trích xuất thông tin tín hiệu xưởng, năm uy tín và xếp hạng của nhà cung cấp 1688.' }
  ];

  const fetchTokens = async () => {
    try {
      const res = await fetch('/api/mcp/tokens', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    setError(null);
    try {
      const res = await fetch('/api/mcp/tokens', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          clientName: newClientName.trim(),
          scopes: ['search_1688_products', 'verify_product_price', 'evaluate_facebook_ads', 'get_supplier_info']
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Tạo khóa thất bại');
        return;
      }

      setCreatedRawToken(data.rawToken);
      setNewClientName('');
      setIsCreating(false);
      fetchTokens();
    } catch {
      setError('Lỗi kết nối máy chủ');
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn thu hồi khóa MCP này?')) return;
    try {
      const res = await fetch(`/api/mcp/tokens/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchTokens();
      }
    } catch {
      // ignore
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const sampleToken = createdRawToken || (tokens[0]?.id ? 'mcp_live_••••••••••••' : 'mcp_live_YOUR_TOKEN_HERE');

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Kết nối & Tích hợp (Remote MCP Server)</h2>
        <p className="text-xs text-slate-500">
          Kết nối Claude Desktop, Cursor hoặc Windsurf qua giao thức Remote MCP Streamable HTTP tại endpoint chuẩn /mcp
        </p>
      </div>

      {/* Protocol Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Cpu size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Remote MCP Server (Streamable HTTP)</h3>
              <p className="text-xs text-slate-500">Chuẩn JSON-RPC 2.0 theo đặc tả Model Context Protocol</p>
            </div>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus size={14} />
            <span>Tạo khóa Token mới</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-slate-500 font-medium">Giao thức / Transport:</span>
            <div className="font-bold text-slate-900 font-mono text-sm">Streamable HTTP (JSON-RPC 2.0)</div>
            <p className="text-[11px] text-slate-400">Tương thích với Claude Desktop, Cursor, AI Studio</p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-slate-500 font-medium">Canonical Endpoint:</span>
            <div className="font-bold text-purple-700 font-mono text-sm break-all">
              {window.location.origin}/mcp
            </div>
            <p className="text-[11px] text-slate-400">Endpoint đón nhận request JSON-RPC</p>
          </div>
        </div>

        {/* Modal / Dialog to Create Token */}
        {isCreating && (
          <form onSubmit={handleCreateToken} className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-purple-900">Cấp mới MCP Bearer Token:</h4>
            {error && <div className="text-xs text-rose-600 font-medium">{error}</div>}
            <div className="flex gap-2">
              <input
                type="text"
                value={newClientName}
                onChange={e => setNewClientName(e.target.value)}
                placeholder="Tên ứng dụng (vd: Claude Desktop cá nhân, Cursor IDE)"
                className="flex-1 px-3 py-2 bg-white border border-purple-200 rounded-lg text-xs"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700"
              >
                Cấp khóa
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Hủy
              </button>
            </div>
          </form>
        )}

        {/* Alert when token is generated */}
        {createdRawToken && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
              <span>Khóa MCP Token mới đã được tạo thành công:</span>
              <button
                onClick={() => handleCopy(createdRawToken)}
                className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] flex items-center gap-1"
              >
                {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
              </button>
            </div>
            <div className="p-2.5 bg-white border border-emerald-200 rounded font-mono text-xs text-emerald-900 break-all select-all">
              {createdRawToken}
            </div>
            <p className="text-[11px] text-emerald-700">
              Lưu ý bảo mật: Khóa chỉ hiển thị một lần duy nhất này. Hệ thống chỉ lưu bản băm SHA-256 một chiều trong cơ sở dữ liệu D1.
            </p>
          </div>
        )}

        {/* Tokens List Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Key size={14} className="text-purple-600" />
            <span>Danh sách Khóa MCP đang hoạt động:</span>
          </h4>

          {loading ? (
            <div className="text-xs text-slate-400 py-4 text-center">Đang tải danh sách khóa...</div>
          ) : tokens.length === 0 ? (
            <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
              Chưa có khóa MCP Token nào được tạo. Nhấn "Tạo khóa Token mới" để kết nối AI client.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Client Name</th>
                    <th className="p-3">Quyền (Scopes)</th>
                    <th className="p-3">Ngày tạo</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tokens.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-900">{t.clientName}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {t.scopes.map(s => (
                            <span key={s} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono">
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-slate-500">{new Date(t.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td className="p-3">
                        {t.revokedAt ? (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full text-[10px] font-medium">Đã thu hồi</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-medium">Đang hoạt động</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {!t.revokedAt && (
                          <button
                            onClick={() => handleRevoke(t.id)}
                            className="text-rose-600 hover:text-rose-700 p-1"
                            title="Thu hồi khóa"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MCP Tools Catalog */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold text-slate-900">Danh mục 4 công cụ MCP được hỗ trợ:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mcpTools.map(t => (
              <div key={t.name} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="font-mono font-bold text-purple-700">{t.name}</div>
                <div className="text-slate-600 text-[11px] leading-relaxed">{t.desc}</div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800">
            <ShieldAlert size={16} className="shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-bold">Quy tắc cấm tuyệt đối:</span> Remote MCP từ chối mọi yêu cầu thực hiện hành vi mua hàng, thanh toán tự động, gửi tin nhắn xưởng hoặc giải captcha tự động.
            </div>
          </div>
        </div>
      </div>

      {/* JSON Config Sample */}
      <div className="bg-slate-950 text-slate-200 rounded-2xl p-6 shadow-xl space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-purple-400 font-bold">Cấu hình claude_desktop_config.json:</span>
          <span className="text-slate-400">Streamable HTTP Remote Mode</span>
        </div>
        <pre className="p-4 bg-slate-900 rounded-xl font-mono text-[11px] overflow-x-auto text-slate-300 leading-relaxed">
{`{
  "mcpServers": {
    "1688-research-hub": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-fetch",
        "${window.location.origin}/mcp"
      ],
      "env": {
        "AUTHORIZATION": "Bearer ${sampleToken}"
      }
    }
  }
}`}
        </pre>
      </div>
    </div>
  );
};
