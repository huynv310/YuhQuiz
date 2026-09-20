# YuhQuiz - Nền Tảng Khảo Thí Trực Tuyến THPTQG 2025
> **Nền tảng khảo thí trực tuyến nhanh gọn và tiện ích dành cho học sinh THPT**  
> Cung cấp giải pháp tổ chức thi và thi thử toàn diện, đáp ứng linh hoạt nhu cầu đánh giá năng lực theo quy chế mới của Bộ GD&ĐT.

---

## 🌟 Giới Thiệu & Điểm Nổi Bật

**YuhQuiz** giải quyết bài toán chuyển đổi sang **định dạng đề thi tốt nghiệp THPT mới từ năm 2025** của Bộ GD&ĐT. Hệ thống dùng kiến trúc **Serverless Jamstack** (React + Vite + Supabase + Vercel), chạy được trên gói miễn phí.

Điểm thay đổi lớn so với các phiên bản trước:

* **Bắt buộc đăng nhập:** giáo viên và học sinh đều phải có tài khoản. Phiên đăng nhập giữ bằng **cookie httpOnly** qua lớp BFF (`/api/auth/*`), token không nằm trong `localStorage`.
* **Đáp án nằm ở server:** bảng `exam_answer_keys` không cho học sinh đọc. Việc chấm, chấm lại và thu bài đều chạy bằng RPC phía Postgres, có kiểm tra quyền (RLS).
* **Kho bài tập & Luyện tập:** giáo viên cắt câu hỏi từ PDF, dựng đề ngẫu nhiên từ kho; học sinh luyện tập tự do và xem lời giải.
* **Cứu hộ bài thi khi mất mạng:** xuất file `.yuhquiz` để nộp lại hoặc để giáo viên nhập thay.

### 🎯 Tính Năng Chính

### 1. Phòng Thi Thí Sinh
* **Giao diện Split-View** (đề bên trái, phiếu trả lời bên phải, thanh kéo tỷ lệ) và bố cục riêng cho điện thoại: thanh khoanh đáp án nhanh, tự chuyển câu, nút Đúng/Sai cỡ lớn, ma trận câu hỏi.
* **Màn hình chuẩn bị thi:** hiển thị tên đề, môn, lớp, giáo viên, thời lượng, hạn nộp; bấm *Bắt đầu* mới vào phòng thi. Quét QR khi chưa đăng nhập sẽ đăng nhập trước rồi vào thẳng màn hình này.
* **Giám sát chống gian lận:** ghi nhận chuyển tab, mất tiêu điểm, thoát toàn màn hình, phím tắt bị cấm; nhật ký (telemetry) giáo viên xem được khi mở bài nộp. Tự tắt hoàn toàn sau khi nộp bài.
* **Lưu bài 2 tầng:** `localStorage` tức thì và đồng bộ định kỳ lên Supabase; đồng hồ đếm ngược neo theo mốc thời gian.
* **Cứu hộ:** nếu nộp lỗi do mất mạng, bài được giữ trong *Lịch sử thi → Bài làm chưa nộp được*; học sinh **Nộp lại** khi có mạng, hoặc **Xuất file** cho giáo viên nhập.
* **Xem lại bài & lời giải** sau khi nộp: đáp án đã chọn, đáp án đúng, lời giải chi tiết (văn bản, ảnh, PDF).

### 2. Góc Học Tập Học Sinh
* Vào lớp bằng mã 6 ký tự hoặc quét QR; lọc bài tập theo lớp, xem điểm trung bình và số bài đã nộp từng lớp.
* **Luyện tập tự do:** lọc theo môn, khối, `#hashtag`, dạng câu; bấm *Kiểm tra* để xem đúng/sai, đáp án và lời giải. API luyện tập không trả đáp án trước khi học sinh kiểm tra.
* **Bảng xếp hạng** Top 20% từng kỳ thi (chỉ hiện tên và điểm).
* **Hồ sơ cá nhân** với mã người dùng dạng `HS7K2M9Q` (do server cấp, không sửa được) và tự xóa tài khoản kèm dữ liệu.

### 3. Trung Tâm Quản Trị Giáo Viên
* **Kho bài tập:** cắt câu hỏi trực tiếp từ PDF (ảnh WebP lưu Storage), phân loại theo môn, khối, `#hashtag`; sửa môn/khối/dạng/đáp án/lời giải; bật hoặc tắt cho phép luyện tập từng câu.
* **Lời giải chi tiết:** văn bản, dán ảnh (Ctrl+V), đính kèm PDF ≤ 2 MB (tối đa 5 tệp/câu).
* **Tạo đề:** thủ công (upload PDF, dán đáp án hàng loạt) hoặc **tự sinh ngẫu nhiên** từ kho câu hỏi (tỉ lệ điểm 3:4:3). Mã đề 6 ký tự dạng `T1A2B3`, khối lớp 1–12, tối đa 100 câu/phần, tìm theo tên hoặc mã, nhóm theo môn.
* **Phân quyền đề:** công khai hoặc bài tập riêng theo lớp, giao đề kèm thời hạn.
* **Quản lý lớp:** sĩ số, điểm từng học sinh, QR lớp, giải tán lớp.
* **Chấm thi:** chấm lại một hoặc toàn bộ bài khi sửa đáp án, buộc thu bài, nhập file cứu hộ, xem đề và bài làm cạnh nhau.
* **Phân tích:** phổ điểm hình chuông, độ lệch chuẩn, trung vị, phân tích từng câu ($P_i$, phương án gây nhiễu).
* **Xuất Excel (.xls)** bảng điểm.

### 4. Giao diện
Nền sáng tối giản, điểm nhấn xanh, nền bong bóng 3D (Three.js) ở trang chủ và dashboard. Cảnh 3D chỉ tải sau khi trang hiển thị, chỉ bật trên màn hình ≥ 1024px và tắt khi bật *Giảm chuyển động* của hệ điều hành.

---

## 🏗️ Cấu Trúc Dự Án

```
exam-platform/
├── api/                        # Vercel Functions (BFF đăng nhập, cookie httpOnly)
│   ├── _lib/bff.ts             #   cookie, chống CSRF, giới hạn đăng nhập
│   ├── auth/{login,logout,refresh,session}.ts
│   └── ping.ts
├── public/                     # icon, manifest PWA, ảnh 3D, font 3D
├── src/
│   ├── components/
│   │   ├── StudentPortal/      # Danh sách đề, màn hình chuẩn bị thi, luyện tập, cứu hộ
│   │   ├── TeacherDashboard/   # Quản lý đề, kho câu hỏi, tự sinh đề, sửa câu, nhập file cứu hộ
│   │   ├── StudentExamRoom.tsx # Phòng thi (split view, mobile dock)
│   │   ├── SnipperModal.tsx    # Cắt câu hỏi từ PDF
│   │   ├── ClassroomModal.tsx, CreateExamModal.tsx, ProfileView.tsx, SolutionView.tsx ...
│   │   ├── QrImage.tsx         # QR sinh tại trình duyệt (thư viện qrcode)
│   │   └── AmbientScene.tsx    # Nền 3D
│   ├── pages/                  # LandingPage, LandingScene
│   ├── hooks/                  # useAntiCheat, useAutoSave, useExamTimer
│   ├── lib/                    # supabase, session (BFF), rescue, telemetry, examId, imageUpload ...
│   ├── utils/                  # scoring, answerParser, autoGen, excelExporter, hashtags
│   ├── constants/, types/
│   └── App.tsx, main.tsx
├── supabase/
│   ├── schema.sql              # Schema gốc
│   └── migrations/             # 8 migration (bảo mật, mã đề, kho bài tập, lời giải, mã người dùng ...)
├── tests/                      # Unit test + test DB (Postgres nhúng)
├── .github/workflows/          # CI (typecheck, test, build) + keepalive Supabase
├── DEPLOY.md                   # Hướng dẫn triển khai + smoke test thủ công
└── vercel.json                 # Rewrites + header bảo mật (CSP, X-Frame-Options ...)
```

---

## 🧮 Barem Điểm Cấu Trúc Mới THPTQG 2025

Thuật toán trong `scoring.ts` và RPC `submit_and_grade_exam` đọc thang điểm từ `config` của đề:

1. **Phần I (Trắc nghiệm 4 lựa chọn):**
   $$\text{Điểm mỗi câu} = \frac{\text{Tổng điểm Phần I}}{\text{Số câu Phần I}}$$
2. **Phần II (Đúng / Sai):**  
   Mỗi câu gồm 4 lệnh hỏi a, b, c, d. Điểm cơ sở mỗi câu $S_{câu} = \frac{\text{Tổng điểm Phần II}}{\text{Số câu Phần II}}$, điểm đạt được theo thang lũy tiến:
   * Đúng 1 ý: $10\% \times S_{câu}$
   * Đúng 2 ý: $25\% \times S_{câu}$
   * Đúng 3 ý: $50\% \times S_{câu}$
   * Đúng 4 ý: $100\% \times S_{câu}$
3. **Phần III (Trả lời ngắn):**
   $$\text{Điểm mỗi câu} = \frac{\text{Tổng điểm Phần III}}{\text{Số câu Phần III}}$$
   *(Chuẩn hóa số âm, số thập phân kiểu Việt `1,5` $\to$ `1.5`, bỏ khoảng trắng thừa.)*

---

## 🚀 Chạy Ở Máy Cục Bộ

Yêu cầu: Node.js 20 trở lên.

```bash
cd exam-platform
npm ci
cp .env.example .env      # điền URL và anon key của Supabase
npm run dev               # http://localhost:5173
```

Biến môi trường (xem `.env.example`):

| Biến | Ý nghĩa |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Kết nối Supabase từ trình duyệt |
| `VITE_USE_BFF` | `true` khi deploy Vercel kèm `/api/auth/*`; để `false` khi chạy local |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Chỉ đặt phía server (Vercel), không có tiền tố `VITE_` |

Không dùng `service_role` key ở bất kỳ đâu. Không commit tệp `.env`.

### Kiểm thử

```bash
npm run typecheck   # tsc cho app và api
npm test            # unit test: chấm điểm, parser, tự sinh đề, BFF
npm run test:db     # RLS, RPC, migration trên Postgres nhúng (PGlite)
npm run build       # typecheck + vite build
```

CI (`.github/workflows/ci.yml`) chạy đủ bốn bước trên mỗi push và pull request.

---

## 🌐 Triển Khai (Supabase + Vercel)

Xem hướng dẫn đầy đủ, thứ tự chạy migration, danh sách smoke test và xử lý sự cố trong **[DEPLOY.md](DEPLOY.md)**. Tóm tắt:

1. **Supabase:** chạy `supabase/schema.sql`, sau đó lần lượt 8 tệp trong `supabase/migrations/`; bật Email provider; đặt Site URL và Redirect URLs. Với DB đã có dữ liệu, **sao lưu trước** (migration xóa cột `exams.answer_keys` sau khi chép sang `exam_answer_keys`).
2. **GitHub:** đặt secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY` cho workflow `keepalive.yml` (tránh project free bị tạm dừng).
3. **Vercel:** import repo, `Root Directory` là gốc repo này, đặt 5 biến môi trường trong bảng trên (`VITE_USE_BFF=true`).
4. Chạy smoke test ở `DEPLOY.md` mục 4 trên **staging** trước khi lặp lại cho production.

### Giới hạn đã biết
* Tệp lời giải nằm trong bucket công khai (tên là mã hash, khó đoán nhưng ai có link đều xem được).
* Câu bật *Cho phép luyện tập* hiện với mọi học sinh đã đăng nhập; câu dùng cho đề thi thật nên tắt tùy chọn này.
* Vai trò giáo viên do người dùng tự chọn khi đăng ký (chưa có bước duyệt).
* Các test dùng Postgres nhúng, không thay thế được smoke test trên môi trường thật. Chi tiết xem `DEPLOY.md` mục 6.

---

## 🛡️ Bản Quyền & Giấy Phép
Dự án được phát triển phục vụ mục đích giáo dục và khảo thí trực tuyến cho học sinh THPT trên toàn quốc.
