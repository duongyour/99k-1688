import React, { useState, useEffect } from 'react';
import { SearchJob } from '../types.ts';
import { Search, History, Calendar, CheckCircle2, AlertTriangle, ArrowRight, User } from 'lucide-react';

interface ResearchHistoryPageProps {
  onSelectJob: (jobId: string) => void;
  onNewResearch: () => void;
}

export const ResearchHistoryPage: React.FC<ResearchHistoryPageProps> = ({ onSelectJob, onNewResearch }) => {
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetch('/api/research/jobs');
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  const filteredJobs = jobs.filter(j => {
    if (filterStatus === 'ALL') return true;
    return j.status === filterStatus;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Lịch sử nghiên cứu sản phẩm</h2>
          <p className="text-xs text-slate-500">Toàn bộ các tác vụ tìm kiếm và bóc tách dữ liệu 1688 đã thực hiện</p>
        </div>
        <button
          onClick={onNewResearch}
          className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors self-start sm:self-auto"
        >
          <Search size={14} />
          <span>Tìm sản phẩm mới</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs">
        {['ALL', 'COMPLETED', 'RUNNING', 'HUMAN_ACTION_REQUIRED'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              filterStatus === status
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {status === 'ALL' && `Tất cả (${jobs.length})`}
            {status === 'COMPLETED' && `Hoàn tất (${jobs.filter(j => j.status === 'COMPLETED').length})`}
            {status === 'RUNNING' && `Đang chạy (${jobs.filter(j => j.status === 'RUNNING').length})`}
            {status === 'HUMAN_ACTION_REQUIRED' && `Cần xác thực (${jobs.filter(j => j.status === 'HUMAN_ACTION_REQUIRED').length})`}
          </button>
        ))}
      </div>

      {/* Table / List */}
      {filteredJobs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-sm">
          <History size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="font-semibold text-slate-700">Không tìm thấy tác vụ nào</p>
          <p className="text-xs mt-1">Hãy khởi tạo tìm kiếm đầu tiên để thu thập sản phẩm</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-6">Nội dung tìm kiếm</th>
                <th className="py-3.5 px-4">Người tạo</th>
                <th className="py-3.5 px-4">Trần giá</th>
                <th className="py-3.5 px-4">Ứng viên đạt chuẩn</th>
                <th className="py-3.5 px-4">Bẫy giá loại bỏ</th>
                <th className="py-3.5 px-4">Thời gian</th>
                <th className="py-3.5 px-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredJobs.map(job => (
                <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6 max-w-sm">
                    <div className="font-semibold text-slate-900 line-clamp-1">{job.title}</div>
                    <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 font-mono">
                      Từ khóa TQ: {job.chineseKeywords.join(', ')}
                    </div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <User size={13} className="text-slate-400" />
                      <span>{job.creatorName}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-bold text-slate-900 whitespace-nowrap">
                    ≤ {job.maxPriceCny} ¥
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                      <CheckCircle2 size={12} /> {job.verifiedCandidates} sản phẩm
                    </span>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    {job.rejectedCandidates > 0 ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                        <AlertTriangle size={12} /> {job.rejectedCandidates} bẫy giá
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                    {new Date(job.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <button
                      onClick={() => onSelectJob(job.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 hover:bg-orange-600 text-orange-700 hover:text-white rounded-lg font-semibold text-xs transition-colors"
                    >
                      <span>Xem kết quả</span>
                      <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
