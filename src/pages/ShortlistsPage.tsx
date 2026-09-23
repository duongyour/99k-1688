import React, { useState, useEffect } from 'react';
import { Shortlist, ShortlistItem } from '../types.ts';
import {
  BookmarkCheck,
  Plus,
  ArrowLeft,
  Download,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Scale,
  Building2,
  Video
} from 'lucide-react';

export const ShortlistsPage: React.FC<{ onSelectProduct: (id: string) => void }> = ({ onSelectProduct }) => {
  const [shortlists, setShortlists] = useState<Shortlist[]>([]);
  const [selectedShortlistId, setSelectedShortlistId] = useState<string | null>(null);
  const [shortlistDetail, setShortlistDetail] = useState<{ shortlist: Shortlist; items: ShortlistItem[] } | null>(null);
  const [newShortlistName, setNewShortlistName] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchShortlists = async () => {
    try {
      const res = await fetch('/api/shortlists');
      if (res.ok) {
        const data = await res.json();
        setShortlists(data.shortlists || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShortlists();
  }, []);

  const fetchDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/shortlists/${id}`);
      if (res.ok) {
        const data = await res.json();
        setShortlistDetail(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedShortlistId) {
      fetchDetail(selectedShortlistId);
    } else {
      setShortlistDetail(null);
    }
  }, [selectedShortlistId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShortlistName.trim()) return;

    try {
      const res = await fetch('/api/shortlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newShortlistName.trim() })
      });
      if (res.ok) {
        setNewShortlistName('');
        setShowCreateModal(false);
        fetchShortlists();
      }
    } catch {
      // ignore
    }
  };

  const removeItem = async (productId: string) => {
    if (!selectedShortlistId) return;
    try {
      const res = await fetch(`/api/shortlists/${selectedShortlistId}/items/${productId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchDetail(selectedShortlistId);
        fetchShortlists();
      }
    } catch {
      // ignore
    }
  };

  const handleExportCsv = () => {
    if (!selectedShortlistId) return;
    window.location.href = `/api/shortlists/${selectedShortlistId}/export`;
  };

  // Detail & Side-by-Side Comparison View
  if (selectedShortlistId && shortlistDetail) {
    const { shortlist, items } = shortlistDetail;

    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            onClick={() => setSelectedShortlistId(null)}
            className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 self-start"
          >
            <ArrowLeft size={16} />
            <span>Tất cả danh sách chọn</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              <Download size={14} />
              <span>Xuất file CSV nghiên cứu</span>
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{shortlist.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Bảng so sánh chi tiết {items.length} ứng viên sản phẩm tiềm năng
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-200">
            {items.length} sản phẩm
          </span>
        </div>

        {items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
            <BookmarkCheck size={40} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">Chưa có sản phẩm nào trong danh sách này</p>
            <p className="text-xs mt-1">Khi xem kết quả tìm kiếm, hãy bấm biểu tượng lưu để đưa sản phẩm vào đây</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                  <th className="py-3.5 px-6">Sản phẩm</th>
                  <th className="py-3.5 px-4">Giá xác thực</th>
                  <th className="py-3.5 px-4">MOQ</th>
                  <th className="py-3.5 px-4">Nhà cung cấp</th>
                  <th className="py-3.5 px-4">Điểm Hook Ads</th>
                  <th className="py-3.5 px-4">Điểm Demo</th>
                  <th className="py-3.5 px-4">Biên độ bán lẻ VN</th>
                  <th className="py-3.5 px-6 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {items.map(it => {
                  const p = it.product;
                  if (!p) return null;
                  const assess = p.assessment;

                  return (
                    <tr key={it.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 max-w-xs">
                        <div className="flex items-center gap-3">
                          <img src={p.mainImage} alt={p.title} className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-100" />
                          <div className="overflow-hidden">
                            <h4
                              onClick={() => onSelectProduct(p.id)}
                              className="font-bold text-slate-900 line-clamp-2 hover:text-orange-600 cursor-pointer transition-colors"
                            >
                              {p.title}
                            </h4>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">{p.titleZh}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-extrabold text-slate-900 text-sm">
                          {p.verifiedVariantPrice || p.priceDisplayedMin} ¥
                        </span>
                        <div className="text-[10px] text-emerald-600 font-bold">≤ 30¥ Verified</div>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap font-medium">
                        {p.moq} chiếc
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap max-w-[140px] truncate text-slate-600">
                        {p.supplierName}
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900">{assess?.hookClarity || 8}</span>/10
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900">{assess?.demonstrability || 8}</span>/10
                      </td>
                      <td className="py-4 px-4 max-w-xs text-[11px] text-slate-600">
                        {assess?.retailHeadroomHypothesis || 'Biên độ tốt để test Facebook Ads'}
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap space-x-2">
                        <a
                          href={p.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                          title="Mở 1688"
                        >
                          <ExternalLink size={14} />
                        </a>
                        <button
                          onClick={() => removeItem(p.id)}
                          className="inline-flex p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                          title="Xóa khỏi danh sách chọn"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Danh sách chọn (Shortlists)</h2>
          <p className="text-xs text-slate-500">Tạo và quản lý các bộ sưu tập sản phẩm để so sánh và xuất dữ liệu test Ads</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors self-start"
        >
          <Plus size={16} />
          <span>Tạo danh sách mới</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {shortlists.map(sl => (
          <div
            key={sl.id}
            onClick={() => setSelectedShortlistId(sl.id)}
            className="bg-white border border-slate-200 hover:border-purple-300 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <BookmarkCheck size={20} />
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                  {sl.itemCount} sản phẩm
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">{sl.name}</h3>
              <p className="text-xs text-slate-400">Tạo bởi: {sl.userName}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-purple-600 font-semibold">
              <span>Xem và so sánh →</span>
              <span className="text-slate-400 font-normal">
                {new Date(sl.updatedAt).toLocaleDateString('vi-VN')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Tạo danh sách chọn mới</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tên danh sách:</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Test phụ kiện ô tô tháng 9 dưới 30 tệ..."
                  value={newShortlistName}
                  onChange={(e) => setNewShortlistName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
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
                  Tạo danh sách
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
