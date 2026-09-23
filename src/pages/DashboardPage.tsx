import React, { useState, useEffect } from 'react';
import { SearchJob, Product } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Search,
  Package,
  BookmarkCheck,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (tab: string, param?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingMembersCount, setPendingMembersCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobsRes, prodsRes] = await Promise.all([
          fetch('/api/research/jobs'),
          fetch('/api/products')
        ]);
        if (jobsRes.ok) {
          const data = await jobsRes.json();
          setJobs(data.jobs || []);
        }
        if (prodsRes.ok) {
          const data = await prodsRes.json();
          setProducts(data.products || []);
        }

        if (user?.status === 'OWNER' || user?.permissions.includes('members.view')) {
          const memRes = await fetch('/api/members');
          if (memRes.ok) {
            const mData = await memRes.json();
            const pending = (mData.members || []).filter((m: any) => m.status === 'PENDING_APPROVAL').length;
            setPendingMembersCount(pending);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const verifiedCandidatesCount = products.filter(p => p.priceStatus === 'VERIFIED').length;
  const trapCandidatesCount = products.filter(p => p.priceStatus === 'ACCESSORY_TRAP_REJECTED').length;
  const shortlistedCount = products.filter(p => p.researchState === 'SHORTLISTED').length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 rounded-2xl p-8 text-white shadow-xl shadow-orange-600/15 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-semibold">
            <Sparkles size={14} />
            <span>Thuật toán phát hiện bẫy giá 1688 & Đánh giá Facebook Ads</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            Nghiên cứu sản phẩm 1688 chuẩn xác dưới 30 CNY
          </h2>
          <p className="text-sm text-orange-100 leading-relaxed">
            Nhập ý định sản phẩm bằng tiếng Việt, hệ thống tự động bóc tách biến thể SKU, loại trừ bẫy ốc vít 0.1 tệ và chấm điểm khả năng làm video demo chạy Ads tại Việt Nam.
          </p>
        </div>

        <button
          onClick={() => onNavigate('research_new')}
          className="shrink-0 flex items-center justify-center gap-2.5 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-xl transition-all"
        >
          <Search size={18} />
          <span>Tìm sản phẩm mới ngay</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold">Lượt nghiên cứu</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{jobs.length}</div>
          <div className="text-xs text-slate-400 mt-1">Tổng số chiến dịch đã chạy</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold">Sản phẩm đạt chuẩn ≤30¥</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{verifiedCandidatesCount}</div>
          <div className="text-xs text-slate-400 mt-1">Đã xác minh SKU chính &lt;= 30 tệ</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold">Đã chặn bẫy giá phụ kiện</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600">{trapCandidatesCount}</div>
          <div className="text-xs text-slate-400 mt-1">Phát hiện mồi giá ảo 0.5¥ - 1.5¥</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold">Danh sách chọn (Shortlisted)</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <BookmarkCheck size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-600">{shortlistedCount}</div>
          <div className="text-xs text-slate-400 mt-1">Sản phẩm sẵn sàng test Ads</div>
        </div>
      </div>

      {/* Admin Notice if pending members */}
      {pendingMembersCount > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-amber-800">
            <Users size={18} className="text-amber-600 shrink-0" />
            <span>
              Có <strong>{pendingMembersCount}</strong> thành viên mới đang chờ bạn xét duyệt quyền truy cập hệ thống.
            </span>
          </div>
          <button
            onClick={() => onNavigate('members')}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-semibold transition-colors shrink-0"
          >
            Duyệt thành viên ngay
          </button>
        </div>
      )}

      {/* Recent Research Runs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Các đợt nghiên cứu gần đây</h3>
          <button
            onClick={() => onNavigate('research_history')}
            className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
          >
            <span>Xem tất cả</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
            <Package size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-700">Chưa có lượt tìm kiếm nào</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Hãy nhập nhu cầu sản phẩm cần tìm như "Phụ kiện ô tô dưới 30 tệ dễ quay clip demo" để bắt đầu.
            </p>
            <button
              onClick={() => onNavigate('research_new')}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-semibold hover:bg-orange-700"
            >
              Bắt đầu tìm kiếm
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.slice(0, 6).map(job => (
              <div
                key={job.id}
                onClick={() => onNavigate('research_detail', job.id)}
                className="bg-white border border-slate-200 hover:border-orange-300 rounded-xl p-5 shadow-xs cursor-pointer transition-all hover:shadow-md group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-900 line-clamp-1 group-hover:text-orange-600 transition-colors">
                    {job.title}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {job.status}
                  </span>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                  "{job.rawQuery}"
                </p>

                <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100 text-slate-400">
                  <span>Trần giá: ≤ {job.maxPriceCny} ¥</span>
                  <span className="font-semibold text-slate-700">{job.verifiedCandidates} đạt chuẩn</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
