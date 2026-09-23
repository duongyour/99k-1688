import React, { useState, useEffect } from 'react';
import { AuditLog } from '../types.ts';
import { FileText, Filter, Clock, User, Shield, Info, ArrowRight } from 'lucide-react';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/audit');
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(l => {
    if (filterAction === 'ALL') return true;
    return l.action.toLowerCase().includes(filterAction.toLowerCase());
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Nhật ký Hoạt động (Audit Logs)</h2>
        <p className="text-xs text-slate-500">Minh bạch toàn bộ thao tác hệ thống, tìm kiếm, phê duyệt tài khoản và trích xuất dữ liệu</p>
      </div>

      {/* Action Filters */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
        {['ALL', 'SEARCH', 'USER', 'ROLE', 'STUDIO'].map(f => (
          <button
            key={f}
            onClick={() => setFilterAction(f)}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors ${
              filterAction === f ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f === 'ALL' && `Tất cả sự kiện (${logs.length})`}
            {f === 'SEARCH' && 'Tìm kiếm & Nghiên cứu'}
            {f === 'USER' && 'Người dùng & Phê duyệt'}
            {f === 'ROLE' && 'Vai trò & Quyền'}
            {f === 'STUDIO' && 'Media Studio'}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-6">Thời gian</th>
              <th className="py-3.5 px-4">Tác nhân (Actor)</th>
              <th className="py-3.5 px-4">Hành động</th>
              <th className="py-3.5 px-6">Nội dung chi tiết</th>
              <th className="py-3.5 px-4 text-right">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredLogs.map(l => (
              <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3.5 px-6 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                  {new Date(l.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <div className="font-semibold text-slate-900">{l.actorName}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{l.actorRole}</div>
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 font-mono border border-slate-200">
                    {l.action}
                  </span>
                </td>
                <td className="py-3.5 px-6 text-slate-800 font-medium">
                  {typeof l.details === 'string' ? l.details : JSON.stringify(l.details)}
                </td>
                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                  <button
                    onClick={() => setSelectedLog(l)}
                    className="text-orange-600 hover:text-orange-700 font-semibold text-[11px]"
                  >
                    Xem JSON
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Technical Payload Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Chi tiết kỹ thuật sự kiện</h3>
            <div className="space-y-1 text-xs">
              <div><strong>Hành động:</strong> {selectedLog.action}</div>
              <div><strong>Thực hiện bởi:</strong> {selectedLog.actorName} ({selectedLog.actorRole})</div>
              <div><strong>Thời gian:</strong> {new Date(selectedLog.createdAt).toISOString()}</div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Dữ liệu ghi nhận (Metadata):</label>
              <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto max-h-60">
                {JSON.stringify(selectedLog.metadata, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
