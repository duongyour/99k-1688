import React, { useState, useEffect } from 'react';
import { Product } from '../types.ts';
import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Video,
  Wand2,
  Sparkles,
  Download,
  Image as ImageIcon,
  CheckCircle2,
  Layers,
  Scale,
  Truck,
  TrendingUp,
  HelpCircle
} from 'lucide-react';

interface ProductDetailPageProps {
  productId: string;
  onBack: () => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ productId, onBack }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [activeImage, setActiveImage] = useState<string>('');
  const [studioPrompt, setStudioPrompt] = useState<string>(
    'Tách nền sản phẩm, làm sạch phông nền trắng studio cao cấp, giữ nguyên độ bóng và chi tiết gốc'
  );
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [studioMessage, setStudioMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/products/${productId}`);
        if (res.ok) {
          const data = await res.json();
          setProduct(data.product);
          setActiveImage(data.product.mainImage);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  const handleCleanImage = async () => {
    if (!product) return;
    setIsCleaning(true);
    setStudioMessage(null);

    try {
      const res = await fetch(`/api/products/${productId}/studio/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: activeImage,
          instruction: studioPrompt
        })
      });
      if (res.ok) {
        const data = await res.json();
        setProduct(prev => prev ? {
          ...prev,
          media: [data.media, ...(prev.media || [])]
        } : null);
        setActiveImage(data.media.cleanedUrl);
        setStudioMessage('Đã xử lý tách nền và tối ưu ảnh sản phẩm thành công theo hướng dẫn!');
      }
    } catch {
      setStudioMessage('Lỗi khi xử lý ảnh');
    } finally {
      setIsCleaning(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-semibold">Đang tải dữ liệu chi tiết sản phẩm...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center text-slate-600">
        <p>Không tìm thấy sản phẩm</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs">Quay lại</button>
      </div>
    );
  }

  const isVerified = product.priceStatus === 'VERIFIED';
  const isTrap = product.priceStatus === 'ACCESSORY_TRAP_REJECTED';
  const assess = product.assessment;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <button onClick={onBack} className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold">
          <ArrowLeft size={16} />
          <span>Thư viện sản phẩm</span>
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500 truncate max-w-md">{product.title}</span>
      </div>

      {/* Main Product Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Media Gallery & Studio Photo Cleaner */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="relative aspect-square bg-slate-100 flex items-center justify-center">
              <img src={activeImage} alt={product.title} className="w-full h-full object-contain" />
              {product.hasVideo && (
                <span className="absolute top-3 left-3 px-2 py-1 rounded-md text-xs font-bold bg-slate-900/80 text-white flex items-center gap-1.5 shadow-sm">
                  <Video size={13} /> Video xưởng
                </span>
              )}
            </div>

            {/* Thumbnails */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
              {product.media?.map(m => (
                <button
                  key={m.id}
                  onClick={() => setActiveImage(m.url)}
                  className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                    activeImage === m.url ? 'border-orange-600 ring-2 ring-orange-200' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img src={m.url} alt="thumb" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Product Photo Studio & Background Remover Tool */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-lg space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-orange-400">
              <Wand2 size={16} />
              <span>Studio Xử lý Ảnh & Tách nền Sản phẩm</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Nhập hướng dẫn bằng chữ để tự động tách nền, làm sạch phông nền trắng hoặc đặt sản phẩm vào bối cảnh thương mại để làm ảnh test Ads:
            </p>

            {studioMessage && (
              <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>{studioMessage}</span>
              </div>
            )}

            <div className="space-y-2">
              <input
                type="text"
                value={studioPrompt}
                onChange={(e) => setStudioPrompt(e.target.value)}
                placeholder="Ví dụ: Tách nền sản phẩm, đặt trên nền trắng studio sạch..."
                className="w-full px-3.5 py-2 bg-slate-950/70 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCleanImage}
                  disabled={isCleaning}
                  className="flex-1 py-2 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isCleaning ? (
                    <span>Đang tách nền & làm sạch ảnh...</span>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Xử lý ảnh ngay</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Product Details, Pricing & SKU Matrix */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-lg font-bold text-slate-900 leading-snug">
                  {product.title}
                </h1>
                <p className="text-xs font-mono text-slate-400">
                  Tên gốc 1688: {product.titleZh}
                </p>
              </div>
              <a
                href={product.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                <span>Mở link gốc 1688</span>
                <ExternalLink size={12} />
              </a>
            </div>

            {/* Price Verification Highlight Box */}
            <div className={`p-4 rounded-xl border space-y-2 ${
              isTrap ? 'bg-rose-50/70 border-rose-200 text-rose-900' : isVerified ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isVerified ? (
                    <span className="flex items-center gap-1 font-bold text-emerald-800 text-xs">
                      <ShieldCheck size={16} className="text-emerald-600" />
                      <span>Đã xác minh giá sản phẩm chính đạt chuẩn ≤ 30 CNY</span>
                    </span>
                  ) : isTrap ? (
                    <span className="flex items-center gap-1 font-bold text-rose-800 text-xs">
                      <AlertTriangle size={16} className="text-rose-600" />
                      <span>Cảnh báo: Bẫy giá phụ kiện / SKU ảo</span>
                    </span>
                  ) : (
                    <span className="font-bold text-slate-700 text-xs">Giá chưa kiểm chứng</span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Giá SKU sản phẩm chính</span>
                  <span className={`text-xl font-black ${isTrap ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {product.verifiedVariantPrice ? `${product.verifiedVariantPrice} ¥` : 'Chưa rõ'}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-600 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <span>Giá hiển thị ngoài bìa trang 1688:</span>
                <span className="font-semibold text-slate-800">{product.priceDisplayedMin} ~ {product.priceDisplayedMax} ¥</span>
              </div>
            </div>

            {/* Variants / SKUs Table */}
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Layers size={14} className="text-orange-600" />
                <span>Chi tiết các biến thể SKU & Phân loại bẫy phụ kiện:</span>
              </h3>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Tên biến thể</th>
                      <th className="py-2.5 px-4">Giá (CNY)</th>
                      <th className="py-2.5 px-4">Phân loại</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {product.variants?.map(v => (
                      <tr key={v.id} className={v.isAccessory ? 'bg-rose-50/40 text-rose-900' : 'hover:bg-slate-50'}>
                        <td className="py-2.5 px-4 font-medium">
                          {v.name}
                          <div className="text-[10px] text-slate-400 font-mono">{v.nameZh}</div>
                        </td>
                        <td className="py-2.5 px-4 font-bold">
                          {v.priceCny} ¥
                        </td>
                        <td className="py-2.5 px-4">
                          {v.isAccessory ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              Phụ kiện / Mồi giá
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Sản phẩm chính
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Price Tiers (MOQ) */}
            {product.priceTiers && product.priceTiers.length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold text-slate-900">Bảng giá theo số lượng nhập (Price Tiers):</h3>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {product.priceTiers.map(t => (
                    <div key={t.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
                      <div className="text-[11px] text-slate-500">Từ {t.minQuantity} chiếc:</div>
                      <div className="font-bold text-slate-900 mt-0.5">{t.priceCny} ¥</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Supplier Signals */}
            {product.supplier && (
              <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Building2 size={14} className="text-orange-600" />
                  <span>Xưởng cung cấp: {product.supplier.name}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Địa điểm: {product.supplier.location} | Thâm niên: {product.supplier.yearsOnPlatform} năm | Đánh giá: {product.supplier.ratingScore}★
                </p>
                {product.supplier.factorySignals && (
                  <p className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                    {product.supplier.factorySignals}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 10-Point Facebook Ads Vietnam Scorecard */}
      {assess && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp size={18} className="text-orange-600" />
                <span>Mô hình Đánh giá Facebook Ads tại Thị trường Việt Nam</span>
              </h2>
              <p className="text-xs text-slate-500">
                Chấm điểm 10 tiêu chí thực nghiệm, phân tích biên độ giá bán lẻ và rủi ro hoàn hàng
              </p>
            </div>

            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider self-start sm:self-auto ${
              assess.recommendationStatus === 'RECOMMENDED'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : assess.recommendationStatus === 'CONSIDER'
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-rose-100 text-rose-800 border border-rose-300'
            }`}>
              {assess.recommendationStatus === 'RECOMMENDED' ? 'Khuyên dùng để test Ads' : assess.recommendationStatus === 'CONSIDER' ? 'Cân nhắc kỹ' : 'Không nên nhập'}
            </span>
          </div>

          {/* 7 Core Quantitative Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Độ hút 3s (Hook)', val: assess.hookClarity },
              { label: 'Dễ quay Demo', val: assess.demonstrability },
              { label: 'Before / After', val: assess.beforeAfterPotential },
              { label: 'Giải quyết vấn đề', val: assess.problemSolutionStrength },
              { label: 'Tò mò / Mới lạ', val: assess.noveltyCuriosity },
              { label: 'Chất lượng Media', val: assess.visualMediaQuality },
              { label: 'Nhỏ gọn dễ ship', val: assess.smallLightSuitability },
            ].map((metric, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[11px] text-slate-500 block leading-tight mb-1">{metric.label}</span>
                <span className="text-lg font-black text-slate-900">{metric.val}</span>
                <span className="text-[10px] text-slate-400 font-semibold"> / 10</span>
              </div>
            ))}
          </div>

          {/* Qualitative In-depth Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-orange-50/60 border border-orange-200/80 space-y-1 text-xs">
                <span className="font-bold text-orange-950 flex items-center gap-1.5">
                  <Scale size={14} className="text-orange-600" />
                  <span>Biên độ giá bán lẻ dự kiến tại Việt Nam (Retail Headroom):</span>
                </span>
                <p className="text-orange-900 leading-relaxed font-medium">
                  {assess.retailHeadroomHypothesis}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Truck size={14} className="text-slate-600" />
                  <span>Rủi ro bảo hành & Vận chuyển hoàn hàng:</span>
                </span>
                <p className="text-slate-600 leading-relaxed">
                  {assess.returnSupportRisk}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-slate-600" />
                  <span>Rủi ro bản quyền & Thương hiệu (Brand / IP Risk):</span>
                </span>
                <p className="text-slate-600 leading-relaxed">
                  {assess.brandIpRisk}
                </p>
              </div>
            </div>

            {/* Strengths, Risks & Unknowns Breakdown */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 size={13} /> Điểm mạnh nổi bật (Strengths):
                </span>
                <ul className="space-y-1 text-xs text-slate-700 pl-4 list-disc">
                  {assess.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                  <AlertTriangle size={13} /> Rủi ro & Lưu ý khi chạy Ads (Risks):
                </span>
                <ul className="space-y-1 text-xs text-slate-700 pl-4 list-disc">
                  {assess.risks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                  <HelpCircle size={13} /> Yếu tố chưa kiểm chứng độc lập (Unknowns):
                </span>
                <ul className="space-y-1 text-xs text-slate-700 pl-4 list-disc">
                  {assess.unknowns.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
