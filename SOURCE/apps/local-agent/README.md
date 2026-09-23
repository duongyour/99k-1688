# HƯỚNG DẪN CÀI ĐẶT & CHẠY LOCAL BROWSER AGENT (WINDOWS)

## 1. Yêu cầu hệ thống
- Hệ điều hành: Windows 10 / Windows 11
- Node.js 18+ (hoặc mới hơn)
- Trình duyệt Google Chrome hoặc Microsoft Edge hỗ trợ Chrome DevTools Protocol (CDP)

## 2. Kiến trúc & Vận hành (CDP Browser Harness Canonical Runtime)
- Extension path đã được retire khỏi V1 để đảm bảo tuân thủ zero-fabrication và bounded action space.
- Máy trạm điều khiển trình duyệt trực tiếp thông qua Chrome DevTools Protocol (`--remote-debugging-port=9222`).
- Local Agent lắng nghe độc quyền tại loopback `http://127.0.0.1:16881` với xác thực thiết bị và cấm CORS wildcard tùy tiện.

## 3. Các bước chạy Agent trên Windows
1. Khởi động Google Chrome với cổng gỡ lỗi từ xa:
   `chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\ChromeProfile1688"`
2. Đăng nhập tài khoản 1688 của bạn trên cửa sổ Chrome vừa mở.
3. Mở thư mục `SOURCE/apps/local-agent` và chạy `run-agent.bat` (hoặc `npx tsx agent.ts`).
4. Agent sẽ kết nối vào cổng CDP 9222 của Chrome, tự động trích xuất DOM nguyên bản, quan sát trạng thái đăng nhập/bảo mật và gửi nhịp tim (heartbeat) về Cloud Control Plane.
