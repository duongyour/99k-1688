import React, { useState, useEffect } from 'react';
import { useAuth, getAuthHeaders } from '../context/AuthContext.tsx';
import { User, Shield, Building, Save, CheckCircle2, Lock, Cpu, RefreshCw, Layers } from 'lucide-react';
import { AIProviderConfig, AIModelConfig, AITaskRoutingConfig, AITaskClass } from '../types.ts';

export const SettingsPage: React.FC = () => {
  const { user, isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'WORKSPACE' | 'AI_CONFIG'>('PROFILE');

  // Profile Form
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Workspace Settings
  const [workspaceName, setWorkspaceName] = useState('1688 Research & Studio Hub');
  const [defaultMaxPrice, setDefaultMaxPrice] = useState(30.0);
  const [workspaceMsg, setWorkspaceMsg] = useState<string | null>(null);

  // AI Configuration State
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [models, setModels] = useState<AIModelConfig[]>([]);
  const [routing, setRouting] = useState<AITaskRoutingConfig[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  const fetchAIData = async () => {
    setAiLoading(true);
    try {
      const [provRes, modRes, routRes] = await Promise.all([
        fetch('/api/ai/providers', { headers: getAuthHeaders() }),
        fetch('/api/ai/models', { headers: getAuthHeaders() }),
        fetch('/api/ai/routing', { headers: getAuthHeaders() })
      ]);

      if (provRes.ok) {
        const d = await provRes.json();
        setProviders(d.providers || []);
      }
      if (modRes.ok) {
        const d = await modRes.json();
        setModels(d.models || []);
      }
      if (routRes.ok) {
        const d = await routRes.json();
        setRouting(d.routing || []);
      }
    } catch {
      // ignore
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'AI_CONFIG') {
      fetchAIData();
    }
  }, [activeTab]);

  const handleUpdateRouting = async (taskClass: AITaskClass, primaryModelId: string, fallbackModelId?: string) => {
    try {
      const res = await fetch('/api/ai/routing', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ taskClass, primaryModelId, fallbackModelId })
      });
      if (res.ok) {
        setAiMsg(`Đã cập nhật định tuyến tác vụ ${taskClass}`);
        fetchAIData();
        setTimeout(() => setAiMsg(null), 3000);
      }
    } catch {
      // ignore
    }
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('Đã lưu cập nhật thông tin cá nhân!');
    setTimeout(() => setProfileMsg(null), 3000);
  };

  const handleUpdateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    setWorkspaceMsg('Đã lưu cấu hình Workspace thành công!');
    setTimeout(() => setWorkspaceMsg(null), 3000);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Cài đặt hệ thống</h2>
        <p className="text-xs text-slate-500">Quản lý tài khoản cá nhân, thông số không gian và định tuyến Multi-AI</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('PROFILE')}
          className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'PROFILE' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <User size={14} />
          <span>Hồ sơ cá nhân</span>
        </button>

        <button
          onClick={() => setActiveTab('WORKSPACE')}
          className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'WORKSPACE' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building size={14} />
          <span>Cấu hình Workspace {isOwner && '(OWNER)'}</span>
        </button>

        <button
          onClick={() => setActiveTab('AI_CONFIG')}
          className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'AI_CONFIG' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Cpu size={14} />
          <span>Định tuyến Multi-AI & Nhà cung cấp</span>
        </button>
      </div>

      {activeTab === 'PROFILE' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          {profileMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{profileMsg}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Họ và tên:</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Số điện thoại:</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email đăng nhập:</label>
              <input
                type="email"
                disabled
                value={user?.email}
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-500 cursor-not-allowed"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Save size={14} />
                <span>Lưu thông tin</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'WORKSPACE' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          {workspaceMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{workspaceMsg}</span>
            </div>
          )}

          <form onSubmit={handleUpdateWorkspace} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tên tổ chức / Workspace:</label>
              <input
                type="text"
                disabled={!isOwner}
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Trần giá mặc định (CNY):</label>
                <input
                  type="number"
                  step="0.1"
                  disabled={!isOwner}
                  value={defaultMaxPrice}
                  onChange={(e) => setDefaultMaxPrice(parseFloat(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cơ sở dữ liệu thẩm quyền:</label>
                <input
                  type="text"
                  disabled
                  value="Cloudflare D1 Relational Engine (SQL Authority)"
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 cursor-not-allowed font-mono"
                />
              </div>
            </div>

            {isOwner && (
              <div className="pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Save size={14} />
                  <span>Lưu cấu hình Workspace</span>
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {activeTab === 'AI_CONFIG' && (
        <div className="space-y-6">
          {aiMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{aiMsg}</span>
            </div>
          )}

          {/* Providers List Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Danh sách Nhà cung cấp AI (Multi-AI Providers)</h3>
                <p className="text-xs text-slate-500">Kiến trúc đa mô hình: Gemini, OpenAI, Claude, OpenRouter, Local Ollama</p>
              </div>
              <button
                onClick={fetchAIData}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              >
                <RefreshCw size={14} className={aiLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {providers.map(p => (
                <div key={p.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{p.displayName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      p.isConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {p.isConfigured ? 'Sẵn sàng' : 'Chưa cấu hình Key'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {p.isLocal ? 'Chạy cục bộ (Local Model)' : (p.endpoint || 'Mặc định SDK')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Task Class Routing Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers size={16} className="text-orange-600" />
                <span>Bảng phân bổ tác vụ AI (Task Class Routing & Fallback)</span>
              </h3>
              <p className="text-xs text-slate-500">Tự động chuyển tiếp sang mô hình dự phòng khi mô hình chính gặp sự cố</p>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Lớp tác vụ (Task Class)</th>
                    <th className="p-3">Mô hình chính (Primary)</th>
                    <th className="p-3">Mô hình dự phòng (Fallback)</th>
                    <th className="p-3 text-right">Lưu thay đổi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {routing.map(r => (
                    <tr key={r.taskClass} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {r.taskClass}
                      </td>
                      <td className="p-3">
                        <select
                          value={r.primaryModelId}
                          onChange={(e) => {
                            const newR = [...routing];
                            const idx = newR.findIndex(x => x.taskClass === r.taskClass);
                            if (idx !== -1) {
                              newR[idx].primaryModelId = e.target.value;
                              setRouting(newR);
                            }
                          }}
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          {models.map(m => (
                            <option key={m.id} value={m.id}>{m.displayName}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <select
                          value={r.fallbackModelId || ''}
                          onChange={(e) => {
                            const newR = [...routing];
                            const idx = newR.findIndex(x => x.taskClass === r.taskClass);
                            if (idx !== -1) {
                              newR[idx].fallbackModelId = e.target.value || undefined;
                              setRouting(newR);
                            }
                          }}
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          <option value="">-- Không có dự phòng --</option>
                          {models.map(m => (
                            <option key={m.id} value={m.id}>{m.displayName}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleUpdateRouting(r.taskClass, r.primaryModelId, r.fallbackModelId)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold"
                        >
                          Lưu
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
