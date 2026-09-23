import React, { useState, useEffect } from 'react';
import { Globe, Plus, ShieldCheck, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onNewResearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, onNewResearch }) => {
  const [deviceStatus, setDeviceStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'HUMAN_ACTION_REQUIRED'>('CONNECTED');
  const [is1688LoggedIn, setIs1688LoggedIn] = useState(true);

  useEffect(() => {
    const checkBrowser = async () => {
      try {
        const res = await fetch('/api/browser/status');
        if (res.ok) {
          const data = await res.json();
          if (data.devices && data.devices.length > 0) {
            setDeviceStatus(data.devices[0].status);
            setIs1688LoggedIn(data.devices[0].isLoggedIn1688 ?? true);
          }
        }
      } catch {
        // ignore
      }
    };
    checkBrowser();
    const interval = setInterval(checkBrowser, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-base font-bold text-slate-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* 1688 Browser status pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs">
          <Globe size={14} className={deviceStatus === 'CONNECTED' ? 'text-emerald-600' : 'text-amber-500'} />
          <span className="text-slate-600 font-medium">Trình duyệt 1688:</span>
          {deviceStatus === 'HUMAN_ACTION_REQUIRED' ? (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-[11px]">
              <AlertTriangle size={12} /> Cần giải Captcha
            </span>
          ) : is1688LoggedIn ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[11px]">
              <ShieldCheck size={12} /> Đã sẵn sàng
            </span>
          ) : (
            <span className="font-semibold text-rose-600">Cần đăng nhập</span>
          )}
        </div>

        {onNewResearch && (
          <button
            onClick={onNewResearch}
            className="flex items-center gap-2 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Plus size={14} />
            <span>Tìm sản phẩm mới</span>
          </button>
        )}
      </div>
    </header>
  );
};
