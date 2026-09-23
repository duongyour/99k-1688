import React, { useState, useEffect } from 'react';
import { User, Role } from '../types.ts';
import { Users, CheckCircle2, XCircle, Shield, AlertCircle, Phone, Mail, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export const MembersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>('RESEARCHER');
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [mRes, rRes] = await Promise.all([
        fetch('/api/members'),
        fetch('/api/roles')
      ]);
      if (mRes.ok) {
        const mData = await mRes.json();
        setMembers(mData.members || []);
      }
      if (rRes.ok) {
        const rData = await rRes.json();
        setRoles(rData.roles || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (userId: string, roleKey: string = 'RESEARCHER') => {
    try {
      const res = await fetch(`/api/members/${userId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleKey })
      });
      if (res.ok) {
        setMessage('Đã phê duyệt tài khoản thành công!');
        fetchData();
        setSelectedMember(null);
      }
    } catch {
      // ignore
    }
  };

  const handleReject = async (userId: string) => {
    if (!confirm('Bạn có chắc chắn muốn từ chối tài khoản này không?')) return;
    try {
      const res = await fetch(`/api/members/${userId}/reject`, { method: 'POST' });
      if (res.ok) {
        setMessage('Đã từ chối tài khoản.');
        fetchData();
      }
    } catch {
      // ignore
    }
  };

  const handleUpdateRole = async (userId: string, roleKey: string) => {
    try {
      const res = await fetch(`/api/members/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleKey })
      });
      if (res.ok) {
        setMessage('Đã cập nhật vai trò thành công!');
        fetchData();
      }
    } catch {
      // ignore
    }
  };

  const filteredMembers = members.filter(m => {
    if (statusFilter === 'ALL') return true;
    return m.status === statusFilter;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Quản lý Thành viên Workspace</h2>
          <p className="text-xs text-slate-500">Phê duyệt người dùng mới, phân quyền truy cập và kiểm soát thành viên</p>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
        {['ALL', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED'].map(st => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors ${
              statusFilter === st ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {st === 'ALL' && `Tất cả (${members.length})`}
            {st === 'PENDING_APPROVAL' && `Chờ duyệt (${members.filter(m => m.status === 'PENDING_APPROVAL').length})`}
            {st === 'ACTIVE' && `Đang hoạt động (${members.filter(m => m.status === 'ACTIVE' || m.status === 'OWNER').length})`}
            {st === 'REJECTED' && `Đã từ chối (${members.filter(m => m.status === 'REJECTED').length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-6">Thành viên</th>
              <th className="py-3.5 px-4">Số điện thoại</th>
              <th className="py-3.5 px-4">Trạng thái</th>
              <th className="py-3.5 px-4">Vai trò (Role)</th>
              <th className="py-3.5 px-4">Ngày đăng ký</th>
              <th className="py-3.5 px-6 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredMembers.map(m => {
              const isOwner = m.status === 'OWNER';
              const isPending = m.status === 'PENDING_APPROVAL';

              return (
                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900">{m.fullName}</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Mail size={12} />
                      <span>{m.email}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap text-slate-600 font-mono">
                    {m.phone || 'Chưa cập nhật'}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isOwner
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : isPending
                        ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                        : m.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {isOwner ? 'CHỦ SỞ HỮU (OWNER)' : isPending ? 'CHỜ DUYỆT' : m.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    {isOwner ? (
                      <span className="font-bold text-amber-700 flex items-center gap-1 text-[11px]">
                        <Shield size={13} /> Toàn quyền hệ thống
                      </span>
                    ) : (
                      <select
                        disabled={isPending}
                        value={m.roleKey || 'RESEARCHER'}
                        onChange={(e) => handleUpdateRole(m.id, e.target.value)}
                        className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-700 disabled:opacity-50"
                      >
                        {roles.map(r => (
                          <option key={r.id} value={r.key}>{r.name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap text-[11px] text-slate-400">
                    {new Date(m.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="py-4 px-6 text-right whitespace-nowrap space-x-2">
                    {isPending ? (
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedMember(m); }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                          Duyệt
                        </button>
                        <button
                          onClick={() => handleReject(m.id)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Từ chối
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px] italic">
                        {isOwner ? 'Không thể chỉnh sửa' : 'Đã duyệt'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Approval Modal with Role Selection */}
      {selectedMember && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Phê duyệt thành viên mới</h3>
            <p className="text-xs text-slate-500">
              Bạn đang phê duyệt tài khoản của <strong>{selectedMember.fullName}</strong> ({selectedMember.email}).
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Gán vai trò mặc định:</label>
              <select
                value={selectedRoleKey}
                onChange={(e) => setSelectedRoleKey(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              >
                {roles.map(r => (
                  <option key={r.id} value={r.key}>{r.name} - {r.description}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleApprove(selectedMember.id, selectedRoleKey)}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
              >
                Xác nhận phê duyệt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
