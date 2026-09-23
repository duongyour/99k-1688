import React, { useState, useEffect } from 'react';
import { SearchJob, Product, Shortlist } from '../types.ts';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  BookmarkCheck,
  Video,
  ShieldCheck,
  Eye,
  Check,
  X,
  Sparkles,
  Zap,
  Building2
} from 'lucide-react';

interface ResearchDetailPageProps {
  jobId: string;
  onBack: () => void;
  onSelectProduct: (productId: string) => void;
}

export const ResearchDetailPage: React.FC<ResearchDetailPageProps> = ({ jobId, onBack, onSelectProduct }) => {
  const [job, setJob] = useState<SearchJob | null>(null);
  const [candidates, setCandidates] = useState<Product[]>([]);
  const [shortlists, setShortlists] = useState<Shortlist[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'VERIFIED' | 'TRAPS'>('ALL');
  const [shortlistModalProduct, setShortlistModalProduct] = useState<Product | null>(null);
  const [selectedShortlistId, setSelectedShortlistId] = useState<string>('');
  const [shortlistNotice, setShortlistNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const [jobRes, slRes] = await Promise.all([
          fetch(`/api/research/jobs/${jobId}`),
          fetch('/api/shortlists')
        ]);
        if (jobRes.ok) {
          const data = await jobRes.json();
          setJob(data.job);
          setCandidates(data.candidates || []);
        }
        if (slRes.ok) {
          const data = await slRes.json();
          setShortlists(data.shortlists || []);
          if (data.shortlists && data.shortlists.length > 0) {
            setSelectedShortlistId(data.shortlists[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [jobId]);

  const updateProductState = async (productId: string, state: 'SAVED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/products/${productId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state })
      });
      if (res.ok) {
        setCandidates(prev => prev.map(p => p.id === productId ? { ...p, researchState: state } : p));
      }
    } catch {
      // ignore
    }
  };

  const addToShortlist = async () => {
    if (!shortlistModalProduct || !selectedShortlistId) return;
    try {
      const res = await fetch(`/api/shortlists/${selectedShortlistId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: shortlistModalProduct.id })
      });
      if (res.ok) {
        setShortlistNotice(`Đã thêm sản phẩm "${shortlistModalProduct.title.slice(0, 30)}..." vào danh sách chọn`);
        setCandidates(prev => prev.map(p => p.id === shortlistModalProduct.id ? { ...p, researchState: 'SHORTLISTED' } : p));
        setTimeout(() => setShortlistNotice(null), 4000);
        setShortlistModalProduct(null);
      }
    } catch {
      // ignore
    }
  };

  const filteredCandidates = candidates.filter(c => {
    if (activeTab === 'VERIFIED') return c.priceStatus === 'VERIFIED';
    if (activeTab === 'TRAPS') return c.priceStatus === 'ACCESSORY_TRAP_REJECTED';
    return true;
  });

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-semibold">Đang tải dữ liệu kết quả nghiên cứu...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8 text-center text-slate-600">
        <p>Không tìm thấy thông tin tác vụ nghiên cứu này.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-800 text-white text-xs rounded-lg">Quay lại</button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Back & Breadcrumb */}
      <div className="flex items-center gap-3 text-xs">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Lịch sử nghiên cứu</span>
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500 truncate max-w-md">{job.title}</span>
      </div>

      {/* Shortlist Success Alert */}
      {shortlistNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{shortlistNotice}</span>
        </div>
      )}

      {/* Header Info Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200">
              Chiến dịch nghiên cứu 1688
            </span>
            <h2 className="text-xl font-bold text-slate-900 leading-tight">
              {job.title}
            </h2>
            <p className="text-xs text-slate-600 italic">
              "{job.rawQuery}"
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xs text-slate-400">Trần giá tối đa</div>
              <div className="text-lg font-bold text-slate-900">≤ {job.maxPriceCny} ¥</div>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Ứng viên đạt chuẩn</div>
              <div className="text-lg font-bold text-emerald-600">{job.verifiedCandidates} sp</div>
            </div>
          </div>
        </div>

        {/* Chinese Keywords Used */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500 flex items-center gap-1">
            <Sparkles size={13} className="text-orange-500" />
            <span>Từ khóa tiếng Trung xưởng 1688:</span>
          </span>
          {job.chineseKeywords.map((kw, i) => (
            <span
              key={i}
              className="px-2.5 py-1 bg-slate-100 text-slate-700 font-mono text-[11px] rounded-md border border-slate-200"
            >
              {kw}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tất cả ứng viên ({candidates.length})
          </button>
          <button
            onClick={() => setActiveTab('VERIFIED')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'VERIFIED' ? 'bg-emerald-700 text-white' : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 size={13} />
            <span>Đạt chuẩn ≤30¥ ({candidates.filter(c => c.priceStatus === 'VERIFIED').length})</span>
          </button>
          <button
            onClick={() => setActiveTab('TRAPS')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'TRAPS' ? 'bg-rose-700 text-white' : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            <AlertTriangle size={13} />
            <span>Bẫy giá phụ kiện ({candidates.filter(c => c.priceStatus === 'ACCESSORY_TRAP_REJECTED').length})</span>
          </button>
        </div>
      </div>

      {/* Candidates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCandidates.map(prod => {
          const isTrap = prod.priceStatus === 'ACCESSORY_TRAP_REJECTED';
          const isVerified = prod.priceStatus === 'VERIFIED';
          const assess = prod.assessment;

          return (
            <div
              key={prod.id}
              className={`bg-white border rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col ${
                isTrap ? 'border-rose-200 bg-rose-50/20' : isVerified ? 'border-slate-200 hover:border-orange-300' : 'border-slate-200'
              }`}
            >
              {/* Product Image & Badges */}
              <div className="relative aspect-4/3 bg-slate-100 overflow-hidden group">
                <img
                  src={prod.mainImage}
                  alt={prod.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Status Badges Overlay */}
                <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
                  {isVerified ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 text-white shadow-sm flex items-center gap-1">
                      <ShieldCheck size={12} /> Đã xác thực ≤ 30¥
                    </span>
                  ) : isTrap ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-600 text-white shadow-sm flex items-center gap-1">
                      <AlertTriangle size={12} /> Bẫy giá phụ kiện
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-600 text-white shadow-sm">
                      Chưa xác minh
                    </span>
                  )}

                  {prod.hasVideo && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900/80 backdrop-blur-xs text-white flex items-center gap-1 w-fit">
                      <Video size={10} /> Video demo xưởng
                    </span>
                  )}
                </div>

                {/* 1688 External Link */}
                <a
                  href={prod.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-2.5 right-2.5 p-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-md shadow-sm text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <span>Mở 1688</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                    {prod.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono line-clamp-1">
                    {prod.titleZh}
                  </p>

                  {/* Pricing Breakdown: Displayed vs Real SKU */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-500 text-[11px]">Giá hiển thị ngoài trang:</span>
                      <span className="font-semibold text-slate-600">{prod.priceDisplayedMin} ~ {prod.priceDisplayedMax} ¥</span>
                    </div>

                    <div className="flex justify-between items-baseline pt-1 border-t border-slate-200/60">
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <span>Giá SKU sản phẩm chính:</span>
                      </span>
                      <span className={`text-sm font-black ${isTrap ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {prod.verifiedVariantPrice ? `${prod.verifiedVariantPrice} ¥` : 'Chưa rõ'}
                      </span>
                    </div>

                    {isTrap && (
                      <div className="text-[11px] text-rose-600 font-semibold bg-rose-100/50 p-1.5 rounded">
                        Cảnh báo: Mồi giá ốc vít/phụ kiện chỉ {prod.priceDisplayedMin}¥ nhưng sản phẩm chính giá {prod.verifiedVariantPrice}¥ (vượt ngân sách 30¥).
                      </div>
                    )}
                  </div>

                  {/* Supplier & Specs */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <div className="flex items-center gap-1 truncate max-w-[160px]">
                      <Building2 size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate">{prod.supplierName}</span>
                    </div>
                    <span>MOQ: <strong>{prod.moq} chiếc</strong></span>
                  </div>

                  {/* Facebook Ads Quick Signals */}
                  {assess && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <span className="text-slate-400 block text-[10px]">Độ hút 3s đầu (Hook)</span>
                        <span className="font-bold text-slate-800">{assess.hookClarity}/10</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <span className="text-slate-400 block text-[10px]">Hiệu ứng Demo</span>
                        <span className="font-bold text-slate-800">{assess.demonstrability}/10</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => onSelectProduct(prod.id)}
                    className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Eye size={13} />
                    <span>Xem chi tiết</span>
                  </button>

                  <button
                    onClick={() => setShortlistModalProduct(prod)}
                    title="Thêm vào danh sách chọn"
                    className={`p-2 rounded-lg border transition-colors ${
                      prod.researchState === 'SHORTLISTED'
                        ? 'bg-purple-50 border-purple-300 text-purple-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <BookmarkCheck size={16} />
                  </button>

                  <button
                    onClick={() => updateProductState(prod.id, 'SAVED')}
                    title="Giữ lại"
                    className={`p-2 rounded-lg border transition-colors ${
                      prod.researchState === 'SAVED'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    <Check size={16} />
                  </button>

                  <button
                    onClick={() => updateProductState(prod.id, 'REJECTED')}
                    title="Loại"
                    className={`p-2 rounded-lg border transition-colors ${
                      prod.researchState === 'REJECTED'
                        ? 'bg-rose-50 border-rose-300 text-rose-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                    }`}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add to Shortlist Modal */}
      {shortlistModalProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Thêm vào danh sách chọn (Shortlist)
            </h3>
            <p className="text-xs text-slate-500 line-clamp-2">
              Sản phẩm: <strong>{shortlistModalProduct.title}</strong>
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Chọn danh sách đích:
              </label>
              <select
                value={selectedShortlistId}
                onChange={(e) => setSelectedShortlistId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
              >
                {shortlists.map(sl => (
                  <option key={sl.id} value={sl.id}>{sl.name} ({sl.itemCount} sản phẩm)</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShortlistModalProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={addToShortlist}
                className="px-4 py-2 text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-sm"
              >
                Lưu vào danh sách
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
