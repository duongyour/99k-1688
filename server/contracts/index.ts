/**
 * Canonical Contracts & Shared Types
 * Single source of truth for Permissions, Roles, D1 entities, API request/response types.
 */

export const CANONICAL_PERMISSIONS = [
  { key: 'workspace.view', name: 'Xem tổng quan hệ thống', category: 'Workspace', description: 'Cho phép truy cập trang tổng quan' },
  { key: 'workspace.manage', name: 'Quản trị cấu hình hệ thống', category: 'Workspace', description: 'Chỉnh sửa cài đặt chung của hệ thống' },
  { key: 'members.view', name: 'Xem danh sách thành viên', category: 'Members', description: 'Xem danh sách tài khoản trong tổ chức' },
  { key: 'members.manage', name: 'Quản lý thành viên', category: 'Members', description: 'Chỉnh sửa thông tin, khóa tài khoản' },
  { key: 'members.approve', name: 'Phê duyệt tài khoản mới', category: 'Members', description: 'Duyệt hoặc từ chối người dùng đăng ký' },
  { key: 'roles.view', name: 'Xem danh sách vai trò', category: 'Roles', description: 'Xem quyền hạn các nhóm tài khoản' },
  { key: 'roles.manage', name: 'Quản lý vai trò & quyền', category: 'Roles', description: 'Tạo và phân bổ quyền cho các vai trò tùy biến' },
  { key: 'research.create', name: 'Tạo phiên nghiên cứu mới', category: 'Research', description: 'Khởi chạy quét sản phẩm 1688 theo tiêu chí' },
  { key: 'research.view_own', name: 'Xem phiên nghiên cứu của mình', category: 'Research', description: 'Xem các tác vụ do mình tạo' },
  { key: 'research.view_all', name: 'Xem toàn bộ phiên nghiên cứu', category: 'Research', description: 'Xem mọi tác vụ của toàn bộ nhóm' },
  { key: 'research.cancel', name: 'Hủy phiên đang chạy', category: 'Research', description: 'Dừng phiên quét đang hoạt động' },
  { key: 'products.view', name: 'Xem kho sản phẩm', category: 'Products', description: 'Tra cứu danh sách sản phẩm đạt tiêu chuẩn' },
  { key: 'products.manage_research_state', name: 'Chuyển trạng thái sản phẩm', category: 'Products', description: 'Lưu, loại bỏ hoặc đưa vào danh sách chọn' },
  { key: 'suppliers.view', name: 'Xem danh bạ nhà cung cấp', category: 'Suppliers', description: 'Tra cứu xưởng sản xuất 1688' },
  { key: 'shortlists.view', name: 'Xem danh sách chọn (Shortlist)', category: 'Shortlists', description: 'Xem các bộ sưu tập sản phẩm' },
  { key: 'shortlists.manage', name: 'Tạo & sửa danh sách chọn', category: 'Shortlists', description: 'Tạo mới, thêm bớt sản phẩm vào Shortlist' },
  { key: 'exports.create', name: 'Xuất dữ liệu Excel/CSV', category: 'Exports', description: 'Tải dữ liệu danh sách sản phẩm' },
  { key: 'browser.view', name: 'Xem trạng thái máy trạm', category: 'Browser', description: 'Kiểm tra trạng thái kết nối agent máy trạm' },
  { key: 'browser.manage', name: 'Quản lý ghép nối máy trạm', category: 'Browser', description: 'Tạo mã ghép nối và quản lý thiết bị' },
  { key: 'ai.view', name: 'Xem cấu hình mô hình AI', category: 'AI', description: 'Xem danh sách các nhà cung cấp AI' },
  { key: 'ai.manage', name: 'Quản lý nhà cung cấp AI', category: 'AI', description: 'Kích hoạt, định tuyến và phân bổ tác vụ AI' },
  { key: 'mcp.view', name: 'Xem kết nối MCP', category: 'MCP', description: 'Xem thông tin endpoint Remote MCP' },
  { key: 'mcp.manage', name: 'Quản lý khóa MCP Token', category: 'MCP', description: 'Tạo và thu hồi mã truy cập MCP' },
  { key: 'audit.view', name: 'Xem nhật ký hoạt động', category: 'Audit', description: 'Tra cứu lịch sử thao tác hệ thống' }
] as const;

export interface PermissionDefinition {
  key: string;
  name: string;
  category: string;
  description: string;
}

export type PermissionKey = typeof CANONICAL_PERMISSIONS[number]['key'];
export type Permission = PermissionDefinition;

export type UserStatus = 'OWNER' | 'ACTIVE' | 'PENDING_APPROVAL' | 'REJECTED' | 'DEACTIVATED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  status: UserStatus;
  roles: string[];
  roleIds?: string[];
  roleKey?: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  isBuiltin: boolean;
  permissions: string[];
  key?: string;
}

export type JobStatus = 'PENDING' | 'QUEUED' | 'RUNNING' | 'HUMAN_ACTION_REQUIRED' | 'PAUSED_HUMAN_ACTION' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface SearchJob {
  id: string;
  title: string;
  rawQuery: string;
  creatorId: string;
  creatorName: string;
  status: JobStatus;
  maxPriceCny: number;
  minPriceCny?: number;
  category?: string;
  moqMax?: number;
  requireVideo: boolean;
  smallLight: boolean;
  excludeBrand: boolean;
  resultTargetCount: number;
  chineseKeywords: string[];
  totalCandidates: number;
  verifiedCandidates: number;
  rejectedCandidates: number;
  humanActionRequired: boolean;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export type PriceStatus = 'VERIFIED' | 'PRICE_UNVERIFIED' | 'ACCESSORY_TRAP_REJECTED';
export type ResearchState = 'NEW' | 'NEW_CANDIDATE' | 'SHORTLISTED' | 'SAVED' | 'REJECTED';

export interface ProductVariant {
  id: string;
  productId: string;
  skuId: string;
  name: string;
  nameZh: string;
  priceCny: number;
  isAccessory: boolean;
  isMainProduct: boolean;
  imageUrl?: string;
  stock?: number;
}

export interface ProductPriceTier {
  id: string;
  productId: string;
  minQuantity: number;
  priceCny: number;
}

export interface ProductMedia {
  id: string;
  productId: string;
  mediaType: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl?: string;
  createdAt: string;
}

export interface AiAssessment {
  id: string;
  productId: string;
  jobId?: string;
  hookClarity: number;
  demonstrability: number;
  beforeAfterPotential: number;
  problemSolutionStrength: number;
  noveltyCuriosity: number;
  visualMediaQuality: number;
  smallLightSuitability: number;
  retailHeadroomHypothesis: string;
  returnSupportRisk: string;
  brandIpRisk: string;
  strengths: string[];
  risks: string[];
  unknowns: string[];
  recommendationStatus: 'RECOMMENDED' | 'CONSIDER' | 'REJECTED';
  createdAt: string;
}

export interface Supplier {
  id: string;
  canonicalSupplierId: string;
  name: string;
  sourceUrl: string;
  location?: string;
  factorySignals?: string;
  ratingScore?: number;
  yearsOnPlatform?: number;
  capturedProductsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  canonical1688Id: string;
  title: string;
  titleZh: string;
  sourceUrl: string;
  mainImage: string;
  priceDisplayedMin: number;
  priceDisplayedMax: number;
  verifiedVariantPrice: number | null;
  priceStatus: PriceStatus;
  moq: number;
  supplierId?: string;
  supplierName: string;
  supplier?: Supplier;
  category?: string;
  weightKg?: number;
  hasVideo: boolean;
  videoUrl?: string;
  rawSnapshotReference?: string;
  researchState: ResearchState;
  createdAt: string;
  updatedAt: string;
  variants?: ProductVariant[];
  priceTiers?: ProductPriceTier[];
  media?: ProductMedia[];
  assessment?: AiAssessment;
}

export interface BrowserDevice {
  id: string;
  name: string;
  pairingToken?: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'HUMAN_ACTION_REQUIRED';
  ipAddress?: string;
  lastSeen?: string;
  pairedAt?: string;
  createdAt: string;
  isLoggedIn1688?: boolean;
  humanActionReason?: string;
  currentTask?: string;
}

export interface Shortlist {
  id: string;
  name: string;
  description?: string;
  userId: string;
  userName: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShortlistItem {
  id: string;
  shortlistId: string;
  productId: string;
  notes?: string;
  addedAt: string;
  product?: Product;
}

export interface AuditLog {
  id: string;
  actorId?: string;
  actorName: string;
  actorRole?: string;
  action: string;
  targetType: string;
  targetId?: string;
  details: string | Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: string;
}

export type AuditEvent = AuditLog;

export interface WorkspaceSettings {
  id?: string;
  displayName?: string;
  defaultPriceCeilingCny?: number;
  registrationOpen?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Multi-AI Contracts
export type AIProviderType = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'local_ai';

export type AITaskClass =
  | 'INTENT_UNDERSTANDING'
  | 'KEYWORD_TRANSLATION'
  | 'SEARCH_PLANNING'
  | 'BROWSER_DECISION'
  | 'PRODUCT_ANALYSIS'
  | 'FACEBOOK_ADS_RESEARCH'
  | 'SUMMARY';

export interface AIProviderConfig {
  id: string;
  providerType: AIProviderType;
  displayName: string;
  endpoint?: string;
  enabled: boolean;
  isLocal: boolean;
  isConfigured: boolean; // boolean flag sent to UI without leaking secret
  healthState: 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN';
}

export interface AIModelConfig {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  capabilities: string[];
  isDefault: boolean;
  enabled: boolean;
}

export interface AITaskRoutingConfig {
  taskClass: AITaskClass;
  primaryModelId: string;
  fallbackModelId?: string;
}

// MCP Contracts
export interface McpTokenInfo {
  id: string;
  clientName: string;
  scopes: string[];
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
}
