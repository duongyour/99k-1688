import React, { useState, useEffect } from 'react';
import { BrowserDevice } from '../types.ts';
import { getAuthHeaders } from '../context/AuthContext.tsx';
import {
  ShieldCheck,
  AlertTriangle,
  Monitor,
  RefreshCw,
  Key,
  CheckCircle2,
  Terminal,
  Cpu,
  Radio,
  ExternalLink,
  Copy
} from 'lucide-react';

export const BrowserPage: React.FC = () => {
  const [device, setDevice] = useState<BrowserDevice | null>(null);
  const [allDevices, setAllDevices] = useState<BrowserDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairGrant, setPairGrant] = useState<string | null>(null);
  const [grantExpires, setGrantExpires] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [pinging, setPinging] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/browser/status', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDevice(data.device || null);
        setAllDevices(data.allDevices || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePing = async () => {
    setPinging(true);
    setPingResult(null);
    try {
      const res = await fetch('/api/browser/ping', { method: 'POST', headers: getAuthHeaders() });
      const data = await res.json();
      setPingResult(`Phản hồi máy chủ: ${data.status} tại ${new Date(data.timestamp).toLocaleTimeString('vi-VN')}`);
      fetchStatus();
    } catch {
      setPingResult('Không thể kết nối máy chủ');
    } finally {
      setPinging(false);
    }
  };

  const handleGeneratePairGrant = async () => {
    try {
      const res = await fetch('/api/browser/pair-grant', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setPairGrant(data.rawGrant);
        setGrantExpires(data.expiresAt);
      }
    } catch {
      // ignore
    }
  };

  const copyGrant = () => {
    if (!pairGrant) return;
    navigator.clipboard.writeText(pairGrant);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const isConnected = device && device.status === 'CONNECTED';
  const isHumanAction = device && device.status === 'HUMAN_ACTION_REQUIRED';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Máy trạm Chrome CDP & Browser Harness</h2>
        <p className="text-xs text-slate-500">
          Kiến trúc thu thập dữ liệu qua Chrome DevTools Protocol (CDP) trực tiếp trên Profile Chrome cục bộ đã đăng nhập 1688
        </p>
      </div>

      {/* Connection Status Overview Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              isConnected ? 'bg-emerald-50 text-emerald-600' : isHumanAction ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
            }`}>
              <Monitor size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {device ? device.name : 'Chưa kết nối máy trạm Chrome CDP'}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 ${
                  isConnected ? 'bg-emerald-100 text-emerald-800' : isHumanAction ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : isHumanAction ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                  {isConnected ? 'CONNECTED' : isHumanAction ? 'HUMAN_ACTION_REQUIRED' : 'DISCONNECTED'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                <span className="font-mono">Endpoint: {device?.ipAddress || '127.0.0.1:16881'}</span>
                <span>•</span>
                <span>Cập nhật: {device?.lastSeen ? new Date(device.lastSeen).toLocaleTimeString('vi-VN') : 'Chưa có tín hiệu'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePing}
              disabled={pinging}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={14} className={pinging ? 'animate-spin' : ''} />
              <span>Kiểm tra kết nối</span>
            </button>
            <button
              onClick={handleGeneratePairGrant}
              className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Key size={14} />
              <span>Tạo mã ghép nối máy trạm</span>
            </button>
          </div>
        </div>

        {pingResult && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-mono">
            {pingResult}
          </div>
        )}

        {/* Pair Grant Display */}
        {pairGrant && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-orange-900">
              <span>Mã ghép nối máy trạm dùng một lần (Hiệu lực 10 phút):</span>
              <button
                onClick={copyGrant}
                className="px-2.5 py-1 bg-orange-600 text-white rounded text-[11px] flex items-center gap-1"
              >
                {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Đã sao chép' : 'Sao chép mã'}</span>
              </button>
            </div>
            <div className="p-2.5 bg-white border border-orange-200 rounded font-mono text-xs text-orange-900 break-all select-all font-bold">
              {pairGrant}
            </div>
            <p className="text-[11px] text-orange-700">
              Nhập mã này vào Local Browser Agent trên máy tính để thiết lập quyền truy cập CDP bảo mật.
            </p>
          </div>
        )}

        {/* Status Indicators Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Trạng thái đăng nhập 1688:</span>
              {device?.isLoggedIn1688 ? (
                <CheckCircle2 size={16} className="text-emerald-500" />
              ) : (
                <AlertTriangle size={16} className="text-amber-500" />
              )}
            </div>
            <div className="text-sm font-bold text-slate-900">
              {device?.isLoggedIn1688 ? 'Đã đăng nhập tài khoản 1688' : 'Chưa đăng nhập trên trình duyệt'}
            </div>
            <p className="text-[11px] text-slate-400">Profile Chrome cá nhân giữ phiên cookie thật</p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Kiểm soát rủi ro / Captcha:</span>
              {isHumanAction ? (
                <AlertTriangle size={16} className="text-rose-500" />
              ) : (
                <ShieldCheck size={16} className="text-emerald-500" />
              )}
            </div>
            <div className="text-sm font-bold text-slate-900">
              {isHumanAction ? 'Yêu cầu người dùng kéo trượt Captcha' : 'Bình thường, không có chặn'}
            </div>
            <p className="text-[11px] text-slate-400">
              {device?.humanActionReason || 'Không can thiệp bypass Captcha tự động'}
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Cơ chế tương tác:</span>
              <Cpu size={16} className="text-indigo-500" />
            </div>
            <div className="text-sm font-bold text-slate-900 font-mono">
              Jev-ultrafast CDP Harness
            </div>
            <p className="text-[11px] text-slate-400">Không gian thao tác giới hạn, chống lỗi Stale Target</p>
          </div>
        </div>
      </div>

      {/* Architecture & Jev Principles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Terminal size={16} className="text-orange-600" />
            <span>Khởi chạy Local CDP Agent trên máy trạm</span>
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Chạy Chrome với cờ Remote Debugging để máy trạm kết nối an toàn với Profile có sẵn phiên đăng nhập 1688:
          </p>
          <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed">
{`# 1. Khởi chạy Google Chrome với cổng remote debugging
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\\1688_Profile"

# 2. Đăng nhập tài khoản 1688 trên trình duyệt vừa mở
# 3. Kết nối agent với mã ghép nối vừa cấp`}
          </pre>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck size={16} className="text-indigo-600" />
            <span>Nguyên tắc Bounded Action Space (Jev Pattern)</span>
          </h3>
          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></span>
              <span><strong>Không chạy mã tùy tiện:</strong> Mô hình AI chỉ được chọn thao tác trong tập hợp bị chặn (CLICK, TYPE_TEXT, SCROLL, WAIT) trên Node ID đã quan sát được.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></span>
              <span><strong>Chống Stale Target:</strong> Mọi thao tác đều kiểm tra lại Node ID trong snapshot DOM hiện tại trước khi tương tác.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></span>
              <span><strong>Human-in-the-loop:</strong> Khi gặp Captcha trượt hoặc đăng nhập lại, hệ thống dừng ngay lập tức và phát tín hiệu cho con người can thiệp.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
