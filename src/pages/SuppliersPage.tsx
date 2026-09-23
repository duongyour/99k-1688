import React, { useState, useEffect } from 'react';
import { Supplier, Product } from '../types.ts';
import { Building2, MapPin, Star, Calendar, Package, ExternalLink, ArrowLeft } from 'lucide-react';

export const SuppliersPage: React.FC<{ onSelectProduct: (id: string) => void }> = ({ onSelectProduct }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [supplierDetail, setSupplierDetail] = useState<{ supplier: Supplier; products: Product[] } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch('/api/suppliers');
        if (res.ok) {
          const data = await res.json();
          setSuppliers(data.suppliers || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (!selectedSupplierId) {
      setSupplierDetail(null);
      return;
    }
    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/suppliers/${selectedSupplierId}`);
        if (res.ok) {
          const data = await res.json();
          setSupplierDetail(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchDetail();
  }, [selectedSupplierId]);

  if (selectedSupplierId && supplierDetail) {
    const { supplier, products } = supplierDetail;
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <button
          onClick={() => setSelectedSupplierId(null)}
          className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          <span>Danh sách nhà cung cấp</span>
        </button>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">{supplier.name}</h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                <span className="flex items-center gap-1"><MapPin size={13} className="text-slate-400" /> {supplier.location || 'Trung Quốc'}</span>
                <span className="flex items-center gap-1"><Calendar size={13} className="text-slate-400" /> {supplier.yearsOnPlatform || 1} năm trên 1688</span>
                <span className="flex items-center gap-1 text-amber-600 font-bold"><Star size={13} /> {supplier.ratingScore || 4.8}★</span>
              </div>
            </div>

            <a
              href={supplier.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg shrink-0"
            >
              <span>Xem gian hàng 1688</span>
              <ExternalLink size={13} />
            </a>
          </div>

          {supplier.factorySignals && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
              Tín hiệu nhà xưởng: {supplier.factorySignals}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Sản phẩm của nhà cung cấp này trong hệ thống ({products.length}):</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {products.map(p => (
              <div
                key={p.id}
                onClick={() => onSelectProduct(p.id)}
                className="bg-white border border-slate-200 hover:border-orange-300 rounded-xl p-3 flex gap-3 cursor-pointer shadow-xs hover:shadow-sm"
              >
                <img src={p.mainImage} alt={p.title} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                <div className="overflow-hidden">
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-2">{p.title}</h4>
                  <div className="text-xs font-bold text-emerald-600 mt-1">{p.verifiedVariantPrice || p.priceDisplayedMin} ¥</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Nhà cung cấp & Xưởng 1688</h2>
        <p className="text-xs text-slate-500">Danh mục nhà xưởng đã được trích xuất và xác thực qua các chiến dịch nghiên cứu</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {suppliers.map(sup => (
          <div
            key={sup.id}
            onClick={() => setSelectedSupplierId(sup.id)}
            className="bg-white border border-slate-200 hover:border-orange-300 rounded-xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                  <Building2 size={18} />
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                  {sup.yearsOnPlatform || 1} năm uy tín
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                {sup.name}
              </h3>

              <div className="text-xs text-slate-500 flex items-center gap-1">
                <MapPin size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">{sup.location || 'Trung Quốc'}</span>
              </div>

              {sup.factorySignals && (
                <p className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {sup.factorySignals}
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Sản phẩm đã quét: {sup.capturedProductsCount || 1}</span>
              <span className="font-bold text-orange-600">Xem xưởng →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
