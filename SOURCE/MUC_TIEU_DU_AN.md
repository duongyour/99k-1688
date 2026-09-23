# MỤC TIÊU DỰ ÁN — 1688 PRODUCT RESEARCH & STUDIO

## 1. Mục đích sản phẩm
Xây dựng sản phẩm thương mại cao cấp, thân thiện, trực quan bằng tiếng Việt phục vụ nghiên cứu sản phẩm trên 1688 và tối ưu hóa quảng cáo Facebook Ads tại thị trường Việt Nam.

Ví dụ ý định cốt lõi:
> "Tìm cho tôi sản phẩm 1688 dưới 30 tệ, dễ quay video demo, phù hợp để nghiên cứu chạy Facebook Ads tại Việt Nam."

## 2. Năng lực trọng tâm
1. **Tìm kiếm bằng ngôn ngữ tự nhiên tiếng Việt**: Tự động phân tích ý định, mở rộng từ khóa tiếng Trung sát với cách đặt tên của xưởng 1688.
2. **Bảo vệ bẫy giá <= 30 CNY**:
   - Phân tách giá hiển thị tối thiểu, giá biến thể SKU thực tế, giá các nấc số lượng (price tiers) và MOQ.
   - Phát hiện và loại bỏ bẫy SKU phụ kiện (ví dụ ốc vít/dây phụ 0.1 tệ trong khi sản phẩm chính > 30 tệ).
   - Chỉ gắn nhãn `VERIFIED` khi SKU sản phẩm chính thỏa mãn điều kiện ngân sách.
3. **Mô hình đánh giá Facebook Ads Việt Nam**:
   - Tính trực quan & bắt mắt (Hook clarity)
   - Khả năng quay video demo thực tế
   - Tiềm năng Before / After
   - Độ mạnh giải quyết vấn đề (Problem-solution strength)
   - Tính mới lạ / kích thích tò mò (Novelty / Curiosity)
   - Chất lượng và số lượng media gốc từ xưởng
   - Trọng lượng nhẹ, kích thước nhỏ, tối ưu vận chuyển TQ -> VN
   - Biên độ giá bán lẻ dự kiến tại Việt Nam
   - Rủi ro bản quyền, thương hiệu hoặc bảo hành
4. **Studio xử lý ảnh sản phẩm**:
   - Tách nền sản phẩm, làm sạch phông theo hướng dẫn văn bản (prompt).
   - Tối ưu media phục vụ làm visual/creative cho quảng cáo.
5. **Kiến trúc Hybrid & Bảo mật**:
   - Control plane: Web app / API / Remote MCP.
   - Execution plane: Windows Local Browser Agent + Chrome/Edge MV3 Thin Extension kết nối phiên 1688 đã đăng nhập của người dùng.
   - Tuyệt đối không export cookie/mật khẩu trình duyệt về máy chủ.
   - Tạm dừng trả trạng thái `HUMAN_ACTION_REQUIRED` khi 1688 yêu cầu xác thực captcha/slider.
6. **Quản trị người dùng & Phân quyền (RBAC)**:
   - Tài khoản đăng ký đầu tiên tự động và duy nhất trở thành `OWNER`.
   - Các tài khoản tiếp theo có trạng thái `PENDING_APPROVAL`, cần quản trị viên duyệt trước khi truy cập dữ liệu.
   - RBAC chặt chẽ: `OWNER`, `ADMIN`, `RESEARCHER`, `VIEWER` và các vai trò tùy chỉnh.
7. **Giao thức Remote MCP**:
   - Hỗ trợ chuẩn Streamable HTTP cho các client tương thích GPT / MCP tương tác tra cứu, tìm kiếm và xuất dữ liệu.
