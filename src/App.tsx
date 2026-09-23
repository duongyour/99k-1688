import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { AuthPages, PendingApprovalPage } from './pages/AuthPages.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { NewResearchPage } from './pages/NewResearchPage.tsx';
import { ResearchHistoryPage } from './pages/ResearchHistoryPage.tsx';
import { ResearchDetailPage } from './pages/ResearchDetailPage.tsx';
import { ProductsPage } from './pages/ProductsPage.tsx';
import { ProductDetailPage } from './pages/ProductDetailPage.tsx';
import { SuppliersPage } from './pages/SuppliersPage.tsx';
import { ShortlistsPage } from './pages/ShortlistsPage.tsx';
import { BrowserPage } from './pages/BrowserPage.tsx';
import { MembersPage } from './pages/MembersPage.tsx';
import { RolesPage } from './pages/RolesPage.tsx';
import { AuditPage } from './pages/AuditPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { IntegrationsPage } from './pages/IntegrationsPage.tsx';

function MainLayout() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-orange-600 flex items-center justify-center font-black text-xl shadow-lg shadow-orange-600/30">
          1688
        </div>
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400 font-medium tracking-wide">Đang khởi tạo không gian nghiên cứu...</p>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <AuthPages />;
  }

  // Account awaiting approval
  if (user.status === 'PENDING_APPROVAL') {
    return <PendingApprovalPage />;
  }

  const handleNavigate = (tab: string, param?: string) => {
    if (tab === 'research_detail' && param) {
      setSelectedJobId(param);
      setCurrentTab('research_detail');
    } else if (tab === 'product_detail' && param) {
      setSelectedProductId(param);
      setCurrentTab('product_detail');
    } else {
      setCurrentTab(tab);
    }
  };

  const getPageMeta = () => {
    switch (currentTab) {
      case 'overview':
        return { title: 'Tổng quan Nghiên cứu', subtitle: 'Bảng điều khiển và theo dõi chỉ số tìm kiếm 1688' };
      case 'research_new':
        return { title: 'Tìm sản phẩm 1688 mới', subtitle: 'Phát hiện bẫy giá & Tiêu chuẩn test Facebook Ads Việt Nam' };
      case 'research_history':
        return { title: 'Lịch sử nghiên cứu', subtitle: 'Quản lý toàn bộ chiến dịch tìm kiếm sản phẩm' };
      case 'research_detail':
        return { title: 'Kết quả nghiên cứu', subtitle: 'Phân tích ứng viên sản phẩm và loại trừ bẫy phụ kiện' };
      case 'products':
        return { title: 'Thư viện sản phẩm', subtitle: 'Kho sản phẩm 1688 đạt chuẩn ngân sách test Ads' };
      case 'product_detail':
        return { title: 'Chi tiết sản phẩm & Media Studio', subtitle: 'Bóc tách biến thể SKU, chấm điểm Ads và làm sạch ảnh' };
      case 'suppliers':
        return { title: 'Nhà cung cấp & Xưởng 1688', subtitle: 'Dữ liệu thâm niên, nhà máy và tín hiệu xưởng uy tín' };
      case 'shortlists':
        return { title: 'Danh sách chọn (Shortlists)', subtitle: 'Bảng so sánh đa chiều và xuất file CSV' };
      case 'browser':
        return { title: 'Trình duyệt 1688 & Máy trạm', subtitle: 'Quản lý kết nối Windows Agent và Extension Chrome' };
      case 'members':
        return { title: 'Quản lý Thành viên', subtitle: 'Phê duyệt tài khoản và phân quyền hệ thống' };
      case 'roles':
        return { title: 'Vai trò & Quyền hạn (RBAC)', subtitle: 'Thiết lập cấp bậc truy cập và phân quyền tùy biến' };
      case 'audit':
        return { title: 'Nhật ký Hoạt động (Audit Logs)', subtitle: 'Minh bạch toàn bộ thao tác hệ thống và người dùng' };
      case 'integrations':
        return { title: 'Kết nối (Remote MCP & API)', subtitle: 'Tích hợp AI Agents qua chuẩn Streamable HTTP' };
      case 'settings':
        return { title: 'Cài đặt hệ thống', subtitle: 'Hồ sơ cá nhân và cấu hình không gian làm việc' };
      default:
        return { title: '1688 Product Research Hub', subtitle: '' };
    }
  };

  const { title, subtitle } = getPageMeta();

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans text-slate-800 antialiased">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
        }}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title={title}
          subtitle={subtitle}
          onNewResearch={currentTab !== 'research_new' ? () => setCurrentTab('research_new') : undefined}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50/50">
          {currentTab === 'overview' && (
            <DashboardPage onNavigate={handleNavigate} />
          )}

          {currentTab === 'research_new' && (
            <NewResearchPage
              onJobCreated={(jobId) => {
                setSelectedJobId(jobId);
                setCurrentTab('research_detail');
              }}
            />
          )}

          {currentTab === 'research_history' && (
            <ResearchHistoryPage
              onSelectJob={(jobId) => {
                setSelectedJobId(jobId);
                setCurrentTab('research_detail');
              }}
              onNewResearch={() => setCurrentTab('research_new')}
            />
          )}

          {currentTab === 'research_detail' && selectedJobId && (
            <ResearchDetailPage
              jobId={selectedJobId}
              onBack={() => setCurrentTab('research_history')}
              onSelectProduct={(productId) => {
                setSelectedProductId(productId);
                setCurrentTab('product_detail');
              }}
            />
          )}

          {currentTab === 'products' && (
            <ProductsPage
              onSelectProduct={(productId) => {
                setSelectedProductId(productId);
                setCurrentTab('product_detail');
              }}
            />
          )}

          {currentTab === 'product_detail' && selectedProductId && (
            <ProductDetailPage
              productId={selectedProductId}
              onBack={() => setCurrentTab('products')}
            />
          )}

          {currentTab === 'suppliers' && (
            <SuppliersPage
              onSelectProduct={(productId) => {
                setSelectedProductId(productId);
                setCurrentTab('product_detail');
              }}
            />
          )}

          {currentTab === 'shortlists' && (
            <ShortlistsPage
              onSelectProduct={(productId) => {
                setSelectedProductId(productId);
                setCurrentTab('product_detail');
              }}
            />
          )}

          {currentTab === 'browser' && <BrowserPage />}

          {currentTab === 'members' && <MembersPage />}

          {currentTab === 'roles' && <RolesPage />}

          {currentTab === 'audit' && <AuditPage />}

          {currentTab === 'integrations' && <IntegrationsPage />}

          {currentTab === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
