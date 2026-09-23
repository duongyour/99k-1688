import React, { useState, useEffect } from 'react';
import { Product } from '../types.ts';
import { Package, Search, Filter, ShieldCheck, AlertTriangle, ExternalLink, Eye, Video } from 'lucide-react';

interface ProductsPageProps {
  onSelectProduct: (productId: string) => void;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({ onSelectProduct }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priceStatusFilter, setPriceStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products');
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.titleZh.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || p.researchState === statusFilter;
    const matchesPriceStatus = priceStatusFilter === 'ALL' || p.priceStatus === priceStatusFilter;
    return matchesSearch && matchesStatus && matchesPriceStatus;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Thư viện sản phẩm 1688 đã lưu</h2>
          <p className="text-xs text-slate-500">Quản lý và tra cứu toàn bộ ứng viên sản phẩm kèm lịch sử phân tích</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên sản phẩm, tên tiếng Trung hoặc nhà cung cấp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={priceStatusFilter}
            onChange={(e) => setPriceStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
          >
            <option value="ALL">Tất cả trạng thái giá</option>
            <option value="VERIFIED">Đã xác minh ≤ 30¥</option>
            <option value="ACCESSORY_TRAP_REJECTED">Bẫy giá phụ kiện</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
          >
            <option value="ALL">Tất cả trạng thái lưu</option>
            <option value="SHORTLISTED">Đã vào Shortlist</option>
            <option value="SAVED">Đã giữ lại</option>
            <option value="REJECTED">Đã loại</option>
          </select>
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
          <Package size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="font-semibold text-slate-700">Chưa có sản phẩm phù hợp</p>
          <p className="text-xs mt-1">Hãy thay đổi bộ lọc hoặc chạy tìm kiếm mới</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredProducts.map(p => {
            const isVerified = p.priceStatus === 'VERIFIED';
            const isTrap = p.priceStatus === 'ACCESSORY_TRAP_REJECTED';

            return (
              <div
                key={p.id}
                onClick={() => onSelectProduct(p.id)}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-orange-300 hover:shadow-md transition-all cursor-pointer flex flex-col group"
              >
                <div className="relative aspect-square bg-slate-100 overflow-hidden">
                  <img src={p.mainImage} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {isVerified ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                        ≤ 30¥ Đạt chuẩn
                      </span>
                    ) : isTrap ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white shadow-xs">
                        Bẫy giá
                      </span>
                    ) : null}
                    {p.hasVideo && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900/80 text-white flex items-center gap-1 w-fit">
                        <Video size={10} /> Video
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-orange-600 transition-colors">
                      {p.title}
                    </h3>
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 font-mono">{p.titleZh}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between text-xs">
                    <span className="text-slate-400 text-[11px]">Giá xác thực:</span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      {p.verifiedVariantPrice ? `${p.verifiedVariantPrice} ¥` : `${p.priceDisplayedMin} ¥`}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>MOQ: {p.moq} chiếc</span>
                    <span className="text-orange-600 font-semibold flex items-center gap-0.5">
                      <Eye size={11} /> Chi tiết
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
