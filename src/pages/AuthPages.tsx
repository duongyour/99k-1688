import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Shield, Clock, AlertCircle, ArrowRight, UserCheck, Lock } from 'lucide-react';

export const AuthPages: React.FC<{ initialMode?: 'login' | 'register' }> = ({ initialMode = 'login' }) => {
  const [isRegister, setIsRegister] = useState(initialMode === 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await register({ email, password, fullName, phone });
        if (res.error) setError(res.error);
      } else {
        const res = await login(email, password);
        if (res.error) setError(res.error);
      }
    } catch {
      setError('Đã xảy ra lỗi không mong muốn');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-600 flex items-center justify-center font-black text-white text-2xl shadow-xl shadow-orange-600/30">
          1688
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-white">
          {isRegister ? 'Đăng ký tài khoản nghiên cứu' : 'Đăng nhập vào hệ thống'}
        </h2>
        <p className="mt-2 text-center text-xs text-slate-400">
          Nền tảng tìm kiếm 1688 thông minh dưới 30 CNY, lọc bẫy giá & đánh giá Facebook Ads
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 py-8 px-6 shadow-2xl border border-slate-800 sm:rounded-2xl sm:px-10">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Họ và tên <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Số điện thoại <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0912345678"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Địa chỉ Email <span className="text-orange-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Mật khẩu <span className="text-orange-500">*</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {isRegister && (
              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/60 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-orange-400">
                  <Shield size={13} />
                  <span>Quy tắc tài khoản đầu tiên:</span>
                </div>
                <p>
                  Tài khoản đăng ký đầu tiên trên hệ thống sẽ tự động trở thành <strong>CHỦ SỞ HỮU (OWNER)</strong> tối cao. Các tài khoản tiếp theo sẽ ở trạng thái chờ duyệt.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-lg shadow-orange-600/20 disabled:opacity-50"
            >
              {loading ? 'Đang xử lý...' : isRegister ? 'Đăng ký tài khoản' : 'Đăng nhập'}
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            {isRegister ? (
              <p className="text-xs text-slate-400">
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setError(null); }}
                  className="text-orange-400 hover:text-orange-300 font-semibold"
                >
                  Đăng nhập
                </button>
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                Chưa có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setError(null); }}
                  className="text-orange-400 hover:text-orange-300 font-semibold"
                >
                  Đăng ký ngay
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const PendingApprovalPage: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-4">
          <Clock size={32} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Đang chờ quản trị viên phê duyệt</h2>
        <p className="mt-2 text-xs text-slate-400 max-w-sm mx-auto">
          Tài khoản của bạn đã được khởi tạo thành công và đang chờ Quản trị viên hệ thống (OWNER/ADMIN) xét duyệt quyền truy cập dữ liệu nghiên cứu 1688.
        </p>

        <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-5 text-left text-xs space-y-3">
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">Họ và tên:</span>
            <span className="font-semibold text-white">{user?.fullName}</span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">Email:</span>
            <span className="font-semibold text-white">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Trạng thái:</span>
            <span className="font-bold text-amber-400 uppercase tracking-wider">CHỜ DUYỆT (PENDING)</span>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={logout}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Đăng xuất khỏi phiên
          </button>
        </div>
      </div>
    </div>
  );
};
