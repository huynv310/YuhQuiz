# YuhQuiz - Nền Tảng Khảo Thí Trực Tuyến THPTQG 2025
> **Nền tảng khảo thí trực tuyến nhanh gọn và tiện ích dành cho học sinh THPT**  
> Cung cấp giải pháp tổ chức thi và thi thử toàn diện, đáp ứng linh hoạt nhu cầu đánh giá năng lực theo quy chế mới của Bộ GD&ĐT.

---

## 🌟 Giới Thiệu & Điểm Nổi Bật

**YuhQuiz** được thiết kế nhằm giải quyết bài toán chuyển đổi sang **định dạng đề thi tốt nghiệp THPT mới từ năm 2025** của Bộ Giáo dục & Đào tạo. Hệ thống kết hợp phong cách thiết kế **Spotify Light Aesthetic** (nền sáng tối giản, điểm nhấn xanh `#1DB954`, bo góc mượt mà) cùng kiến trúc **Serverless Jamstack** mang lại tốc độ tức thì, độ ổn định cao và chi phí vận hành 0 đồng trên nền tảng miễn phí.

### 🎯 Các Tính Năng Đột Phá

### 1. Phòng Thi Thí Sinh (Student Exam Room)
* **Giao diện Split-View linh hoạt:** Chia đôi màn hình trên máy tính (đọc đề PDF bên trái, điền phiếu trắc nghiệm bên phải với thanh kéo tỷ lệ mượt mà).
* **Công nghệ phóng to PDF thực tế (CSS Transform Scale 70% – 200%):** Phóng to trực tiếp nét chữ, công thức toán học và hình vẽ đồ thị như kính lúp, tương thích cả Trình đọc gốc và Google Docs Viewer.
* **Bộ điều khiển cỡ chữ trang web an toàn (85% – 120%):** Tích hợp nút `A-` `100%` `A+` trên thanh điều hướng, tự động căn chỉnh tỷ lệ mà không phá vỡ khung lưới (grid layout).
* **Đột phá Mobile UX (Quick Answer Dock & Question Matrix):**
  * Đề thi PDF hiển thị trọn vẹn **100% màn hình điện thoại**, không bị che khuất.
  * Thanh khoanh đáp án nhanh ở sát đáy màn hình (52px): Phím A, B, C, D bản to chạm bằng ngón cái, **tự động chuyển câu tiếp theo** ngay sau khi chọn.
  * **Phần II Đúng/Sai cảm ứng bản to:** Hai nút bấm `[ ĐÚNG ]` / `[ SAI ]` chuẩn 40px kèm thanh trạng thái 4 ý `A, B, C, D` chống bấm nhầm triệt để.
  * **Ma trận câu hỏi 1-chạm (`[ ▦ ]`):** Hiển thị toàn bộ tiến độ bài thi (câu đã làm / câu bỏ sót), chạm 1 chạm để chuyển ngay đến câu cần làm.
* **Hệ thống giám sát chống gian lận thông minh (Anti-Cheat):** Phát hiện chuyển tab, mở thanh bên chia màn hình AI, chặn phím tắt F12, Copy/Paste. **Tự động tắt bỏ 100% cảm biến giám sát ngay khi học sinh nộp bài** để học sinh tự do đối chiếu kết quả.
* **Lưu bài 2 tầng an toàn (Two-tier Storage):** Lưu tức thời vào `localStorage` (0ms) kết hợp đồng bộ ngầm định kỳ (60s) lên Supabase, giúp hệ thống chịu tải an toàn hàng nghìn học sinh cùng thi mà không nghẽn máy chủ. Tự động thu bài khi hết giờ hoặc khi thí sinh rời phòng.

### 2. Góc Học Tập Học Sinh (Student Portal)
* **Phân loại bài tập theo từng Tab lớp:** Học sinh lọc và xem riêng bài tập được giao của từng lớp (`Tất cả các lớp`, `Lớp 12A1`, `Lớp 12A2`...).
* **Bảng theo dõi điểm số & tiến độ riêng từng lớp:** Tự động tính toán Điểm TB tích lũy và số bài đã nộp riêng cho từng lớp học.
* **Vào lớp học 1-chạm:** Nhập mã tham gia 6 ký tự hoặc quét mã QR do giáo viên cung cấp.
* **Vinh danh bảng vàng (Leaderboard):** Bảng xếp hạng Top 20% thí sinh đạt điểm cao nhất của từng kỳ thi.

### 3. Trung Tâm Quản Trị Giáo Viên (Teacher Dashboard)
* **Tạo đề thi tùy biến thang điểm đa môn học:**
  * Cài đặt sẵn theo chuẩn cấu trúc Bộ GD&ĐT cho các môn: Toán, Vật lí, Hóa học, Sinh học, Lịch sử, Ngoại ngữ...
  * Tự do tùy biến số câu và số điểm từng phần ($S_1, S_2, S_3$), tự động tính toán điểm từng câu theo công thức chia đều và lũy tiến Đúng/Sai (10% – 25% – 50% – 100%).
* **Bộ nạp đáp án thông minh (Batch Answer Parser):** Dán nhanh chuỗi đáp án thô (ví dụ: `1A 2B 3C` hoặc bảng text) để hệ thống tự động nhận diện và điền đáp án chuẩn.
* **Phân quyền đề thi chặt chẽ:** Tùy chọn đề thi `🌐 Công khai` hoặc `🔒 Bài tập lớp` (tự động ẩn với khách vãng lai, chỉ thành viên trong lớp và giáo viên được phép thi).
* **Quản lý lớp học & thành viên đồng bộ:**
  * Hiển thị chính xác sĩ số thành viên, số đề đã nộp và điểm trung bình của từng học sinh trong lớp.
  * Chiếu mã QR lớp học kích thước lớn phục vụ trình chiếu máy chiếu tại lớp.
  * **Tính năng Giải tán lớp học an toàn:** Xác thực bảo mật kép gõ chữ `"XOA"`, tự động kick toàn bộ thành viên, hủy giao đề và xóa sạch dữ liệu liên quan trên toàn hệ thống.
* **Công cụ khảo thí & Chấm thi chuyên sâu:**
  * **Chấm lại bài thi (Regrade):** Chấm lại toàn bộ bài nộp chỉ với 1 click khi giáo viên đính chính đáp án, hoặc chấm lại cho từng học sinh cụ thể.
  * **Buộc thu bài:** Cho phép giáo viên cưỡng chế thu bài các thí sinh đang làm dở khi đã hết giờ.
  * **Phân tích phổ điểm hình chuông:** Thống kê độ lệch chuẩn $\sigma$, phương sai, điểm trung vị và vẽ biểu đồ phân phối chuẩn.
  * **Phân tích câu hỏi ($P_i$):** Thống kê tỷ lệ chọn từng phương án A, B, C, D, phát hiện câu hỏi có độ phân hóa cao hoặc câu bẫy.
  * **Xuất bảng điểm Excel (.xls):** Tự động định dạng bảng tính, co giãn độ rộng cột tự động và chuẩn font tiếng Việt có dấu.

---

## 🏗️ Kiến Trúc Hệ Thống & Cấu Trúc Dự Án

```
exam-platform/
├── public/
│   ├── icon.svg                      # Icon thương hiệu
│   └── manifest.json                 # Cấu hình PWA Web App
├── src/
│   ├── components/
│   │   ├── AuthModal.tsx             # Đăng nhập / Đăng ký hợp nhất
│   │   ├── ClassroomModal.tsx        # Quản lý lớp, thành viên, điểm số & Giải tán lớp
│   │   ├── CompleteProfileModal.tsx  # Cập nhật thông tin khi đăng nhập Google
│   │   ├── CreateExamModal.tsx       # Tạo đề thi, upload PDF, tùy biến thang điểm
│   │   ├── ExamCardSelector.tsx      # Danh sách thẻ chọn đề thi trực quan có nhãn Lớp/Public
│   │   ├── ItemAnalysisTable.tsx     # Phân tích độ khó câu hỏi (Chỉ số Pi, câu bẫy)
│   │   ├── JoinClassModal.tsx        # Học sinh nhập mã tham gia lớp
│   │   ├── LeaderboardModal.tsx      # Bảng xếp hạng Top 20% vinh danh
│   │   ├── ScoreDistributionChart.tsx# Biểu đồ phổ điểm phân phối chuẩn hình chuông
│   │   ├── StudentExamRoom.tsx       # Phòng thi học sinh (Split view, Zoom PDF, Quick Dock)
│   │   ├── StudentPortal.tsx         # Góc học tập thí sinh (Lọc tab theo lớp, điểm TB lớp)
│   │   └── TeacherDashboard.tsx      # Bảng điều khiển khảo thí giáo viên (Chấm lại, Thu bài)
│   ├── constants/
│   │   └── subjectPresets.ts         # Cấu hình số câu, điểm và thời gian chuẩn Bộ GD&ĐT
│   ├── hooks/
│   │   ├── useAntiCheat.ts           # Cảm biến chống gian lận (Tự tắt 100% khi nộp bài)
│   │   ├── useAutoSave.ts            # Lưu bài 2 tầng: LocalStorage 0ms & Sync Server 60s
│   │   └── useExamTimer.ts           # Đếm ngược neo mốc thời gian thực chống tua giờ
│   ├── lib/
│   │   └── supabase.ts               # Kết nối cơ sở dữ liệu Supabase BaaS
│   ├── types/
│   │   └── exam.ts                   # Định nghĩa TypeScript Interfaces toàn dự án
│   ├── utils/
│   │   ├── answerParser.ts           # Thuật toán tách đáp án dán hàng loạt
│   │   ├── excelExporter.ts          # Xuất báo cáo bảng điểm Excel tự co giãn cột
│   │   ├── qrGenerator.ts            # Bộ sinh mã QR thuần chuẩn vector SVG
│   │   └── scoring.ts                # Công thức chấm điểm Đúng/Sai lũy tiến THPTQG 2025
│   ├── App.tsx                       # Điều hướng chính, Menu 3 gạch di động & Hero Section
│   ├── index.css                     # Tailwind CSS & Bộ định kiểu toàn cục
│   └── main.tsx                      # Điểm khởi chạy React kèm GlobalErrorBoundary chống crash
├── supabase/
│   └── schema.sql                    # Schema PostgreSQL: Bảng, RLS, Storage, Trigger & Stored Procedure
├── tests/
│   ├── test_answer_parser.js         # Kiểm thử thuật toán trích xuất đáp án
│   ├── test_dynamic_scoring.js       # Kiểm thử thuật toán tính điểm linh hoạt theo cấu hình
│   └── test_scoring.js               # Kiểm thử độ chính xác barem điểm chuẩn THPTQG
├── package.json & vite.config.ts
└── tailwind.config.js
```

---

## 🧮 Barem Điểm Cấu Trúc Mới THPTQG 2025

Thuật toán trong `scoring.ts` và Stored Procedure `submit_and_grade_exam` chạy độc lập, đồng bộ và tuân thủ tuyệt đối quy định chấm điểm:

1. **Phần I (Trắc nghiệm 4 lựa chọn):**
   $$\text{Điểm mỗi câu} = \frac{\text{Tổng điểm Phần I}}{\text{Số câu Phần I}}$$
2. **Phần II (Trắc nghiệm Đúng / Sai):**  
   Mỗi câu gồm 4 lệnh hỏi a, b, c, d. Điểm cơ sở mỗi câu $S_{câu} = \frac{\text{Tổng điểm Phần II}}{\text{Số câu Phần II}}$, điểm đạt được tính theo thang lũy tiến:
   * Đúng 1 ý: $10\% \times S_{câu}$
   * Đúng 2 ý: $25\% \times S_{câu}$
   * Đúng 3 ý: $50\% \times S_{câu}$
   * Đúng 4 ý: $100\% \times S_{câu}$
3. **Phần III (Trả lời ngắn):**
   $$\text{Điểm mỗi câu} = \frac{\text{Tổng điểm Phần III}}{\text{Số câu Phần III}}$$
   *(Tự động chuẩn hóa số âm `-1.5`, số thập phân kiểu Việt Nam `1,5` $\to$ `1.5` và loại bỏ khoảng trắng thừa).*

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Thử (Local)

### 1. Cài đặt thư viện
```bash
cd exam-platform
npm install
```

### 2. Chạy bộ kiểm thử tự động (Unit Tests)
```bash
node tests/test_dynamic_scoring.js
node tests/test_scoring.js
node tests/test_answer_parser.js
# Kết quả: Tất cả các kịch bản kiểm thử đạt 100% độ chính xác
```

### 3. Cấu hình biến môi trường
Tạo tệp `.env` tại thư mục gốc `exam-platform`:
```env
VITE_SUPABASE_URL=[https://your-project.supabase.co](https://your-project.supabase.co)
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Khởi chạy máy chủ phát triển
```bash
npm run dev
```
Truy cập: `http://localhost:5173`

---

## 🌐 Triển Khai Miễn Phí Lên Cloud (Supabase + Vercel)

### Bước A: Thiết lập Cơ sở dữ liệu Supabase
1. Đăng ký tài khoản tại [https://supabase.com](https://supabase.com) và tạo một Project mới (khuyến nghị chọn Region Singapore).
2. Vào **SQL Editor** $\to$ **New query** $\to$ Dán toàn bộ nội dung tệp `supabase/schema.sql` $\to$ Bấm **Run**.
3. Vào **Storage** $\to$ Tạo bucket mới tên `exam-pdfs` và bật **Public bucket**.
4. Vào **Authentication** $\to$ **URL Configuration**:
   * **Site URL:** Điền tên miền của bạn (ví dụ: `https://www.yuhquiz.id.vn`).
   * **Redirect URLs:** Thêm `https://www.yuhquiz.id.vn/**` và `http://localhost:5173/**`.
5. *(Khuyên dùng)* Vào **Authentication** $\to$ **Providers** $\to$ **Email** $\to$ Tắt **Confirm email** để học sinh tạo tài khoản vào thi được ngay mà không phải chờ thư kích hoạt.

### Bước B: Triển khai Frontend lên Vercel
1. Đẩy mã nguồn lên GitHub của bạn:
   ```bash
   git add .
   git commit -m "Deploy YuhQuiz Production"
   git push origin main
   ```
2. Đăng nhập [https://vercel.com](https://vercel.com) $\to$ **Add New...** $\to$ **Project** $\to$ Chọn Repo GitHub `YuhQuiz`.
3. Trong mục **Environment Variables**, cấu hình 2 biến:
   * `VITE_SUPABASE_URL`: (Lấy từ Project Settings trên Supabase)
   * `VITE_SUPABASE_ANON_KEY`: (Lấy từ Project Settings trên Supabase)
4. Bấm **Deploy**.
5. Trong phần cài đặt **Deployment Protection** trên Vercel: Chuyển sang **Disabled** để mở công khai cho mọi học sinh truy cập.
6. Kết nối tên miền tùy chỉnh (Custom Domain):
   * Thêm tên miền `www.yuhquiz.id.vn` (CNAME trỏ về `cname.vercel-dns.com`).
   * Thêm tên miền `yuhquiz.id.vn` (A Record trỏ về `76.76.21.21`).

---

## 🛡️ Bản Quyền & Giấy Phép
Dự án được phát triển phục vụ mục đích giáo dục và khảo thí trực tuyến cho học sinh THPT trên toàn quốc.
