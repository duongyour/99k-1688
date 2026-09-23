import React from 'react';
import {
  LayoutDashboard,
  Search,
  History,
  Package,
  Building2,
  BookmarkCheck,
  Globe2,
  Users,
  ShieldCheck,
  FileText,
  Settings,
  Cpu,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { user, logout } = useAuth();

  const hasPerm = (perm: string) => {
    if (!user) return false;
    if (user.status === 'OWNER') return true;
    return user.permissions.includes(perm);
  };

  const navItems = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'research_new', label: 'Tìm sản phẩm', icon: Search, badge: 'Hot' },
    { id: 'research_history', label: 'Lịch sử nghiên cứu', icon: History },
    { id: 'products', label: 'Sản phẩm', icon: Package },
    { id: 'suppliers', label: 'Nhà cung cấp', icon: Building2 },
    { id: 'shortlists', label: 'Danh sách chọn', icon: BookmarkCheck },
    { id: 'browser', label: 'Trình duyệt 1688', icon: Globe2 },
    ...(hasPerm('members.view') ? [{ id: 'members', label: 'Thành viên', icon: Users }] : []),
    ...(hasPerm('roles.view') ? [{ id: 'roles', label: 'Vai trò & Quyền hạn', icon: ShieldCheck }] : []),
    ...(hasPerm('audit.view') ? [{ id: 'audit', label: 'Nhật ký hoạt động', icon: FileText }] : []),
    { id: 'integrations', label: 'Kết nối (MCP)', icon: Cpu },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col h-screen border-r border-slate-800 shrink-0">
      {/* Brand */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center font-bold text-white shadow-md shadow-orange-600/30 text-lg">
          1688
        </div>
        <div>
          <div className="font-semibold text-white leading-tight text-sm">Product Research</div>
          <div className="text-xs text-orange-400 font-medium">Bảo vệ bẫy giá & Ads VN</div>
        </div>
      </div>

      {/* Nav list */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-orange-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-orange-500/20 text-orange-300 rounded border border-orange-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50">
        <div className="flex items-center justify-between mb-3">
          <div className="overflow-hidden pr-2">
            <div className="text-xs font-semibold text-white truncate">{user?.fullName || 'Người dùng'}</div>
            <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
          </div>
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
            user?.status === 'OWNER'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
          }`}>
            {user?.status}
          </span>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-md transition-colors border border-rose-900/30"
        >
          <LogOut size={14} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
};
