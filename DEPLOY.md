# Triển khai & smoke test (Supabase + Vercel, chi phí 0đ)

Làm theo thứ tự, **trên project Supabase staging trước**, khi mọi mục ở phần 4 đều đạt mới lặp lại cho production.

## 0. Kiểm tra trước ở máy bạn
```bash
npm ci
npm run typecheck && npm test && npm run test:db && npm run build
```
`test:db` chạy `schema.sql` rồi migration bảo mật trên Postgres nhúng; nếu fail thì không được deploy.

## 1. Supabase
1. Tạo project mới (staging). Lưu **Project URL** và **anon key** (Settings → API). Không cần service-role key ở bất kỳ đâu.
2. SQL Editor → chạy lần lượt:
   1. `supabase/schema.sql`
   2. `supabase/migrations/20260919_security_hardening.sql`
   3. `supabase/migrations/20260920_exam_ids_grade_limits.sql` (mã đề 6 ký tự, khối 1–12, tối đa 100 câu/phần; cấp lại mã cho đề cũ)
   4. `supabase/migrations/20260921_question_bank_subject_grade.sql` (kho bài tập: môn, khối, #hashtag; bỏ bắt buộc chương)
   5. `supabase/migrations/20260922_solution_attachments.sql` (lời giải kèm ảnh/PDF; bucket `question-images` nhận PDF ≤ 2 MB)
   6. `supabase/migrations/20260923_practice_solutions.sql` (học sinh xem lời giải sau khi nộp; luyện tập tự do: RPC `practice_list`, `practice_tags`, `practice_check`)
   7. `supabase/migrations/20260924_user_codes.sql` (mã người dùng `GV`/`HS` + 6 ký tự ngẫu nhiên, duy nhất; cấp lại mã cho hồ sơ cũ)
   8. `supabase/migrations/20260925_data_cleanup_account_delete.sql` (xóa câu hỏi/đề/sửa lời giải → tự xóa tệp mồ côi trong Storage; `delete_my_account()`; `question_bank.author_id` ON DELETE CASCADE)
   9. `supabase/migrations/20260926_linter_hardening.sql` (search_path cố định, khóa hàm trigger/hàm RLS khỏi anon, bỏ policy liệt kê tệp công khai)

   Migration **xóa cột `exams.answer_keys`** sau khi chép sang `exam_answer_keys`. Với DB đã có dữ liệu thật: backup trước (Database → Backups, hoặc `pg_dump`).
3. Authentication → Providers: bật Email (và Google nếu dùng). Authentication → URL Configuration: đặt **Site URL** và **Redirect URLs** = domain Vercel (và `http://localhost:5173` khi dev).
4. Storage: kiểm tra đã có bucket `question-images` (migration tạo sẵn, public, giới hạn 500 KB; sau migration 0922 là 2 MB để nhận PDF, ảnh câu hỏi vẫn bị chặn > 500 KB ở trình duyệt).

## 2. GitHub (CI + keepalive)
Settings → Secrets and variables → Actions:
| Secret | Giá trị |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | anon key |

`keepalive.yml` gọi RPC `ping` mỗi 3 ngày để project free không bị tạm dừng sau 7 ngày không hoạt động.

## 3. Vercel
Import repo, **Root Directory = `exam-platform`**. Environment Variables:
| Biến | Giá trị | Ghi chú |
|---|---|---|
| `VITE_SUPABASE_URL` | Project URL | build-time |
| `VITE_SUPABASE_ANON_KEY` | anon key | build-time |
| `VITE_USE_BFF` | `true` | bật cookie httpOnly |
| `SUPABASE_URL` | Project URL | server (`/api/auth/*`) |
| `SUPABASE_ANON_KEY` | anon key | server |

Không đặt `SUPABASE_SERVICE_ROLE_KEY`; code không dùng và không nên có.
Hobby plan chỉ dành cho dự án phi thương mại. Nếu thu phí thì dùng Pro hoặc chuyển sang nền tảng khác.

## 4. Smoke test thủ công (dùng 3 trình duyệt/profile: GV, HS-A, HS-B)
Đánh dấu từng mục; mục nào fail thì dừng và ghi lại.

**Đăng nhập & phiên**
- [ ] Đăng ký GV (chọn vai trò giáo viên, có SĐT) → có hồ sơ, vào được Dashboard.
- [ ] Đăng ký HS-A, HS-B bằng email → vào được cổng học sinh.
- [ ] DevTools → Application → Cookies: có `yq_rt` với **HttpOnly ✓, Secure ✓, SameSite Strict**; Local Storage **không** có token `sb-...-auth-token`.
- [ ] F5 → vẫn đăng nhập (phiên khôi phục qua cookie).
- [ ] Nhập sai mật khẩu 5 lần liên tiếp → lần 6 báo "Thử đăng nhập quá nhiều lần" (HTTP 429), kể cả khi nhập đúng; đổi mạng/IP khác vẫn đăng nhập được; chờ 15 phút hoặc xóa dòng trong `auth_attempts` để mở lại.
- [ ] Đăng xuất → cookie `yq_rt` biến mất; F5 → về trang đăng nhập.
- [ ] Đăng nhập bằng Google (nếu bật) → sau redirect vẫn đăng nhập, `yq_rt` xuất hiện, hoàn tất được CompleteProfile.

**Phân quyền (mở Console của HS-A, dán từng lệnh)**
- [ ] Tab Network: mở đề của HS, response của `public_exams` **không có** trường đáp án.
- [ ] Gọi REST `GET /rest/v1/exam_answer_keys` bằng token HS-A → mảng rỗng.
- [ ] Gọi REST `PATCH /rest/v1/profiles?id=eq.<id HS-A>` body `{"role":"teacher"}` → lỗi "Không được đổi vai trò".
- [ ] Gọi REST `POST /rest/v1/submissions` trực tiếp → bị từ chối.

**Luồng đề thi**
- [ ] GV: Kho bài tập → "Cắt câu hỏi từ PDF" → cắt 1 câu mỗi dạng (I, II, III) → ảnh xuất hiện trong bucket `question-images/<uid>/`.
- [ ] GV: Tạo đề ngẫu nhiên có đủ 3 phần → đề xuất hiện ở Kho đề thi; giao cho lớp (GV tạo lớp, HS-A tham gia bằng mã lớp).
- [ ] HS-A vào thi: thấy ảnh câu hỏi, nhập đáp án cả 3 phần, nộp → điểm hiển thị **khớp tính tay**.
- [ ] HS-A nộp lần 2 vào đề `allow_multiple_attempts = false` → bị chặn.
- [ ] HS-B (không thuộc lớp) không thấy bài nộp của HS-A; bảng xếp hạng chỉ hiện tên/điểm.
- [ ] GV thấy bài nộp của HS-A trong bảng điểm; Excel xuất được.
- [ ] GV sửa đáp án đề → "Chấm lại tất cả" → điểm HS-A đổi đúng; "Thu bài" một bài đang làm dở → bài chuyển sang đã nộp.
- [ ] HS chưa đăng nhập quét QR → đăng nhập → vào thẳng màn hình chuẩn bị (tên, môn, lớp, GV, thời lượng, hạn) → bấm Bắt đầu mới vào phòng thi.
- [ ] Tạo đề bắt buộc chọn khối; nhập 101 câu/phần bị chặn; mã đề hiển thị dạng `T1A2B3`; tìm theo tên và theo mã; đề nhóm theo môn.
- [ ] GV mở bài nộp: đề bên trái, bài làm bên phải.
- [ ] Kho bài tập: cắt câu chỉ nhập môn + khối + `#hashtag` (không có ô chương); lọc theo môn/khối/#tag hoạt động.
- [ ] Lời giải: gõ văn bản, dán ảnh (Ctrl+V) và đính kèm PDF ≤ 2 MB → lưu được; PDF > 2 MB hoặc > 5 tệp bị báo lỗi.
- [ ] Đề tự sinh chứa câu có lời giải → HS nộp bài xong thấy mục "Lời giải chi tiết" (văn bản, ảnh, PDF); trước khi nộp thì không thấy.
- [ ] HS → "Luyện tập": lọc môn/khối/#tag/dạng, làm bộ câu hỏi, bấm "Kiểm tra" → thấy đúng/sai, đáp án, lời giải. Response `practice_list` **không có** `correct_key`.
- [ ] GV bỏ tick "Cho phép học sinh luyện tập" khi lưu câu → câu đó không xuất hiện trong Luyện tập.
- [ ] Nền bong bóng 3D chuyển động liên tục ở dashboard GV/HS và màn chuẩn bị thi; tắt khi bật "Giảm chuyển động" của hệ điều hành.
- [ ] Mã người dùng: hồ sơ mới có mã dạng `HS7K2M9Q` / `GV4XP8TD`; sửa `user_code` bằng REST bị bỏ qua; hồ sơ cũ đã được cấp lại mã.
- [ ] HS → Lịch sử thi → "Xem lại bài & đáp án": thấy đáp án đã chọn, đáp án đúng, lời giải.
- [ ] Cứu hộ: HS đang thi ngắt mạng rồi bấm nộp → bài nằm ở Lịch sử thi → "Bài làm chưa nộp được"; bật mạng → "Nộp lại" thành công; hoặc "Xuất file" → GV "Nhập file cứu hộ" chấm được. HS nhập lại file .yuhquiz của mình cũng nộp lại được.
- [ ] Kho bài tập: câu hỏi chia khu theo môn; bút chì sửa được môn/khối/#tag/dạng/đáp án/lời giải; người khác không sửa được câu của bạn.
- [ ] Popup: Esc đóng, nền không cuộn, điện thoại hiện dạng bottom-sheet.
- [ ] Chia sẻ đề: mã QR hiện ra (sinh tại trình duyệt, không có request tới domain ngoài).

**Chống gian lận & mất mạng**
- [ ] HS đang thi chuyển tab → `cheat_count` tăng; telemetry được lưu (GV mở bài nộp thấy log).
- [ ] Ngắt mạng lúc nộp → hiện nút "Tải File Cứu Hộ (.yuhquiz)"; bật lại mạng, GV dùng "Nhập file cứu hộ" → bài được chấm và hiện trong bảng điểm; nhập lại cùng file bị từ chối.

**Hạ tầng**
- [ ] GitHub Actions: CI xanh; chạy tay workflow "Keep Supabase awake" → xanh.
- [ ] Lighthouse trang chủ: 3D chỉ tải sau khi trang hiển thị (không chặn LCP); `LandingScene-*.js` không nằm trong request đầu.

## 5. Khi có sự cố
| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| Đăng nhập xong F5 mất phiên | `VITE_USE_BFF=true` nhưng `/api` chưa deploy (kiểm tra Root Directory), hoặc `SUPABASE_URL/ANON_KEY` server thiếu |
| `/api/auth/*` trả 403 | Truy cập từ domain khác domain trang, hoặc thiếu header `X-Requested-With` |
| Cắt PDF thất bại | CSP chặn worker/blob: kiểm tra `vercel.json` (`worker-src 'self' blob:`) |
| Upload ảnh bị 403 | Tài khoản chưa có `role = 'teacher'`, hoặc tên file không nằm trong thư mục `<uid>/` |
| Project Supabase bị tạm dừng | Keepalive chưa chạy: kiểm tra secrets GitHub |

## 6. Giới hạn đã biết
- Tệp lời giải nằm trong bucket public (tên là mã hash, khó đoán nhưng ai có link đều xem được). Đề chỉ nhận lời giải đính kèm khi tạo bằng "Tạo đề ngẫu nhiên" từ kho; đề tạo thủ công chưa có ô lời giải.
- Mọi câu có `practice_enabled = true` trong kho của mọi giáo viên đều hiện trong Luyện tập cho mọi học sinh đã đăng nhập. Câu dùng cho đề thi thật nên bỏ tick "Cho phép luyện tập".
- Vai trò giáo viên do người dùng tự khai khi đăng ký (chưa có duyệt).
- Giới hạn đăng nhập (5 lần sai/15 phút cho mỗi cặp IP+email, 20 lần/IP) đếm trong bảng `auth_attempts` của Supabase. Nếu RPC đếm lỗi thì BFF cho qua (ưu tiên khả dụng). IP lấy từ `x-forwarded-for` của Vercel; sau proxy khác (Cloudflare...) cần kiểm tra lại header. Người dùng chung một IP (Wi-Fi trường) dùng chung hạn mức 20 lần/IP.
- Tỉ lệ điểm đề tự sinh cố định 3:4:3 giữa các phần.
- Các test dùng Postgres/Supabase giả lập; smoke test ở mục 4 mới là kiểm chứng trên môi trường thật.

## 7. Sức chứa & tải (ước tính, gói Free)

Giới hạn Supabase Free: DB 500 MB, Storage 1 GB, ~60 kết nối trực tiếp (dùng pooler), Vercel Hobby: hàm 10 s, 12 hàm/dự án.

| Đối tượng | Kích thước trung bình | Ước lượng tối đa |
|---|---|---|
| Câu hỏi trong kho (ảnh WebP ≤ 500 KB, thường ~60–120 KB; hàng DB ~1 KB) | ~100 KB Storage | ~9.000 câu / 1 GB (chỉ tệp lời giải PDF ≤ 2 MB là nặng) |
| Đề thi (config JSON + đáp án, ≤ 300 câu) | 20–60 KB | ~5.000+ đề / 300 MB DB |
| Bài nộp (đáp án + telemetry) | 3–15 KB | ~30.000 bài nộp / 300 MB DB |
| Người dùng (hồ sơ) | ~1 KB | không đáng kể |

Tải đồng thời: một phòng thi 100–300 học sinh nộp cùng lúc là ổn (RPC chấm điểm chạy trong DB, 1 lần/bài, chống nộp trùng bằng session token). Điểm nghẽn đầu tiên là băng thông Storage (5 GB/tháng egress, ảnh đề tải mỗi lần vào thi — đã cache immutable) rồi tới dung lượng DB do telemetry. Nếu vượt: nâng Supabase Pro, bật pooler, dọn bài nộp cũ.

Giải phóng dữ liệu: xóa câu hỏi/đề/tệp lời giải sẽ tự xóa tệp Storage khi không còn tham chiếu (kiểm tra chia sẻ hash trước khi xóa); xóa đề cascade bài nộp, đáp án, câu sai; xóa tài khoản xóa toàn bộ dữ liệu + thư mục tệp. Chưa dọn: bảng `auth_attempts` (tối đa 50 hàng/khóa) và tệp PDF đề cũ ở bucket `exam-pdfs` (ngoài phạm vi trigger).

Smoke thêm: (a) xóa 1 câu hỏi trong kho → Storage → thư mục của bạn giảm 1 tệp; (b) Hồ sơ → Vùng nguy hiểm → phải tick, gõ đúng mã, chờ 5 s mới bấm được; xóa xong bị đăng xuất về trang chủ và không đăng nhập lại được.
