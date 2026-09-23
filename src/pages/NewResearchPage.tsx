import React, { useState } from 'react';
import { Search, Sparkles, Shield, AlertTriangle, ArrowRight, Video, Feather, Zap } from 'lucide-react';

interface NewResearchPageProps {
  onJobCreated: (jobId: string) => void;
}

export const NewResearchPage: React.FC<NewResearchPageProps> = ({ onJobCreated }) => {
  const [rawQuery, setRawQuery] = useState(
    'Tìm cho tôi sản phẩm 1688 dưới 30 tệ, dễ quay video demo, nhỏ nhẹ, tránh thương hiệu, phù hợp để nghiên cứu chạy Facebook Ads tại Việt Nam.'
  );
  const [maxPriceCny, setMaxPriceCny] = useState<number>(30.0);
  const [minPriceCny, setMinPriceCny] = useState<number>(0);
  const [category, setCategory] = useState<string>('Tất cả danh mục');
  const [requireVideo, setRequireVideo] = useState<boolean>(true);
  const [smallLight, setSmallLight] = useState<boolean>(true);
  const [excludeBrand, setExcludeBrand] = useState<boolean>(true);
  const [targetCount, setTargetCount] = useState<number>(12);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawQuery.trim()) {
      setError('Vui lòng nhập ý định tìm kiếm');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/research/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawQuery,
          maxPriceCny,
          minPriceCny,
          category,
          requireVideo,
          smallLight,
          excludeBrand,
          resultTargetCount: targetCount
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi khởi tạo tác vụ nghiên cứu');
      }

      onJobCreated(data.job.id);
    } catch (err: any) {
      setError(err.message || 'Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const sampleQueries = [
    'Tìm phụ kiện ô tô dưới 30 tệ, dễ quay video demo, nhỏ nhẹ, tránh thương hiệu, phù hợp test Facebook Ads Việt Nam.',
    'Tìm đồ gia dụng thông minh nhà bếp dưới 25 tệ, có hiệu ứng Before/After rõ ràng, không cồng kềnh.',
    'Tìm phụ kiện công nghệ decor bàn làm việc độc lạ dưới 30 tệ, giải quyết đau điểm gọn gàng.'
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-900">Khởi tạo đợt tìm kiếm sản phẩm 1688 mới</h2>
        <p className="text-xs text-slate-500">
          Nhập mô tả sản phẩm bằng tiếng Việt tự nhiên. Hệ thống sẽ dịch và mở rộng từ khóa tiếng Trung, trích xuất dữ liệu và bóc tách biến thể giá thật.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
        {/* Primary Input */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-orange-600" />
              <span>Bạn muốn tìm sản phẩm gì?</span>
              <span className="text-rose-500">*</span>
            </span>
            <span className="text-[11px] font-normal text-slate-400">Hỗ trợ tiếng Việt tự nhiên</span>
          </label>
          <textarea
            rows={4}
            required
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Ví dụ: Tìm cho tôi sản phẩm phụ kiện ô tô dưới 30 tệ, nhỏ nhẹ, dễ quay video demo, tránh thương hiệu, phù hợp test Facebook Ads tại Việt Nam..."
            className="w-full p-4 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all leading-relaxed"
          />

          {/* Quick Suggestions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-semibold text-slate-400">Gợi ý mẫu:</span>
            {sampleQueries.map((sq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRawQuery(sq)}
                className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-orange-50 hover:text-orange-700 text-slate-600 rounded-md border border-slate-200 transition-colors truncate max-w-xs text-left"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>

        {/* Structured Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Trần giá tối đa (CNY / Nhân dân tệ)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="1"
                max="500"
                value={maxPriceCny}
                onChange={(e) => setMaxPriceCny(parseFloat(e.target.value) || 30)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">¥ (Tệ)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Mặc định 30 CNY (~105.000 VNĐ) tối ưu để bán lẻ 250k - 350k tại Việt Nam.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Danh mục sản phẩm
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="Tất cả danh mục">Tất cả danh mục</option>
              <option value="Phụ kiện ô tô">Phụ kiện & Nội thất Ô tô</option>
              <option value="Gia dụng thông minh">Đồ gia dụng & Nhà bếp</option>
              <option value="Phụ kiện công nghệ">Công nghệ & Decor</option>
              <option value="Làm đẹp & Chăm sóc cá nhân">Làm đẹp & Chăm sóc cá nhân</option>
              <option value="Dã ngoại & Thể thao">Thể thao & Dã ngoại</option>
            </select>
          </div>
        </div>

        {/* Facebook Ads Testing Checkboxes */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-900 block">
            Tiêu chuẩn tuyển chọn Facebook Ads Việt Nam
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
              requireVideo ? 'bg-orange-50/50 border-orange-200 text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <input
                type="checkbox"
                checked={requireVideo}
                onChange={(e) => setRequireVideo(e.target.checked)}
                className="mt-0.5 rounded text-orange-600 focus:ring-orange-500"
              />
              <div>
                <span className="font-semibold flex items-center gap-1">
                  <Video size={13} className="text-orange-600" /> Có video gốc xưởng
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">Ưu tiên xưởng có sẵn clip để cắt dựng creative</p>
              </div>
            </label>

            <label className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
              smallLight ? 'bg-orange-50/50 border-orange-200 text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <input
                type="checkbox"
                checked={smallLight}
                onChange={(e) => setSmallLight(e.target.checked)}
                className="mt-0.5 rounded text-orange-600 focus:ring-orange-500"
              />
              <div>
                <span className="font-semibold flex items-center gap-1">
                  <Feather size={13} className="text-orange-600" /> Nhỏ nhẹ, dễ ship
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">Trọng lượng dưới 500g, cước TQ-VN tiết kiệm</p>
              </div>
            </label>

            <label className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
              excludeBrand ? 'bg-orange-50/50 border-orange-200 text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <input
                type="checkbox"
                checked={excludeBrand}
                onChange={(e) => setExcludeBrand(e.target.checked)}
                className="mt-0.5 rounded text-orange-600 focus:ring-orange-500"
              />
              <div>
                <span className="font-semibold flex items-center gap-1">
                  <Shield size={13} className="text-orange-600" /> Tránh vi phạm Brand/IP
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">Không dính logo các thương hiệu lớn để chạy ads sạch</p>
              </div>
            </label>
          </div>
        </div>

        {/* Boundary Notice */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
          <Shield size={18} className="text-slate-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-slate-800">Phạm vi bảo mật & Nghiên cứu:</span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Hệ thống chỉ thực hiện thu thập và nghiên cứu dữ liệu công khai trên 1688, tuyệt đối không đặt hàng, thanh toán hay trích xuất mật khẩu của người dùng. Nếu 1688 yêu cầu kéo thanh trượt (slider captcha), hệ thống sẽ tạm dừng để bạn thao tác trực tiếp trên trình duyệt rồi tiếp tục.
            </p>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-50"
        >
          {loading ? (
            <span>Đang dịch từ khóa & Tìm kiếm trên 1688...</span>
          ) : (
            <>
              <Search size={18} />
              <span>Bắt đầu tìm sản phẩm</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
