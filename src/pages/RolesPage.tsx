import React, { useState, useEffect } from 'react';
import { Role } from '../types.ts';
import { ShieldCheck, Plus, Check, Lock } from 'lucide-react';

export const RolesPage: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newRoleName, setNewRoleName] = useState<string>('');
  const [newRoleDesc, setNewRoleDesc] = useState<string>('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>(['research.read', 'products.read']);

  const allAvailablePerms = [
    { key: 'research.read', label: 'Xem tác vụ nghiên cứu' },
    { key: 'research.write', label: 'Tạo tác vụ tìm kiếm mới' },
    { key: 'products.read', label: 'Xem thư viện sản phẩm' },
    { key: 'products.write', label: 'Lưu / Loại / Sửa sản phẩm & Studio' },
    { key: 'shortlists.read', label: 'Xem danh sách chọn' },
    { key: 'shortlists.write', label: 'Tạo & Xuất file CSV shortlist' },
    { key: 'suppliers.read', label: 'Xem thông tin nhà xưởng 1688' },
    { key: 'browser.manage', label: 'Quản lý ghép nối máy trạm 1688' },
    { key: 'members.view', label: 'Xem danh sách thành viên' },
    { key: 'members.manage', label: 'Phê duyệt & phân quyền thành viên' },
    { key: 'roles.view', label: 'Xem vai trò & quyền hạn' },
    { key: 'roles.manage', label: 'Tạo vai trò tùy biến' },
    { key: 'audit.view', label: 'Xem nhật ký hoạt động' },
    { key: 'workspace.manage', label: 'Quản lý cấu hình hệ thống' },
    { key: 'integrations.manage', label: 'Quản trị kết nối Remote MCP' }
  ];

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/roles');
      if (res.ok) {
        const data = await res.json();
        setRoles(data.roles || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDesc.trim(),
          permissions: selectedPerms
        })
      });
      if (res.ok) {
        setShowCreateModal(false);
        setNewRoleName('');
        setNewRoleDesc('');
        fetchRoles();
      }
    } catch {
      // ignore
    }
  };

  const togglePerm = (perm: string) => {
    setSelectedPerms(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Vai trò & Quyền hạn (RBAC)</h2>
          <p className="text-xs text-slate-500">Phân định ranh giới quyền lực chặt chẽ giữa các cấp bậc người dùng</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors self-start"
        >
          <Plus size={16} />
          <span>Tạo vai trò tùy biến</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {roles.map(role => {
          const isOwnerRole = role.key === 'OWNER';

          return (
            <div
              key={role.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isOwnerRole ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {isOwnerRole ? <Lock size={16} /> : <ShieldCheck size={16} />}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{role.name}</h3>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    role.isBuiltin ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-orange-50 text-orange-700 border border-orange-200'
                  }`}>
                    {role.isBuiltin ? 'Mặc định' : 'Tùy biến'}
                  </span>
                </div>

                <p className="text-xs text-slate-500">{role.description}</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-700 block">
                  Quyền hạn cấp phép ({role.permissions.length} quyền):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {role.permissions.map((p, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200 font-mono text-[10px]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Custom Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900">Tạo vai trò tùy biến mới</h3>

            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tên vai trò:</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Quản trị viên Media Ads"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả mục đích:</label>
                <input
                  type="text"
                  placeholder="Mô tả phạm vi trách nhiệm của vai trò này..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-2">Chọn các quyền áp dụng:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-slate-200 rounded-xl p-3 bg-slate-50 max-h-56 overflow-y-auto">
                  {allAvailablePerms.map(p => {
                    const checked = selectedPerms.includes(p.key);
                    return (
                      <label
                        key={p.key}
                        onClick={() => togglePerm(p.key)}
                        className={`p-2 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                          checked ? 'bg-orange-50 border-orange-200 text-orange-950 font-semibold' : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                          checked ? 'bg-orange-600 border-orange-600 text-white' : 'border-slate-300'
                        }`}>
                          {checked && <Check size={12} />}
                        </div>
                        <span className="text-[11px] leading-tight">{p.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-sm"
                >
                  Lưu vai trò
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
