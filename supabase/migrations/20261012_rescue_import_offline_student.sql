-- Sau khi sửa "chỉ cứu hộ được học sinh thuộc lớp" (20261011), danh sách chọn học sinh vẫn có
-- thể trống với học sinh mất mạng NGAY TỪ ĐẦU: start_attempt() gọi bất đồng bộ, 1 lần duy
-- nhất, khi mở đề — nếu request đó không tới được máy chủ thì không có dòng submissions nào,
-- và học sinh không có trong danh sách.
--
-- Đánh giá 2 hướng sửa và CHỌN hướng an toàn hơn cho chống gian lận:
--  (a) Nới teacher_import_rescue() để chấp nhận cả khi CHƯA có dòng nào — sửa được ngay,
--      nhưng khi đó "bằng chứng đã thi" chỉ còn là lời khai của giáo viên (biết đúng UUID học
--      sinh + tự bịa answers/cheat_count), không còn xác nhận bởi máy chủ. Một tài khoản giáo
--      viên bị lộ/xấu tính có thể tạo bài làm khống cho BẤT KỲ học sinh nào mà không cần học
--      sinh đó từng mở đề — ảnh hưởng thẳng tới rank_score/leaderboard của người khác.
--  (b) Sửa gốc rễ: start_attempt() hiện chỉ gọi 1 lần, thất bại thì thôi (bị nuốt lỗi âm thầm ở
--      useAutoSave.ts). Thêm cơ chế thử lại (client-side) để một lần mất mạng thoáng qua vẫn có
--      cơ hội ghi được dòng submissions khi mạng có lại — giữ nguyên yêu cầu "đã thật sự bắt đầu
--      làm đề" ở RPC, không mở thêm đường nào cho giáo viên tự bịa bài làm.
-- → Chọn (b): giữ nguyên yêu cầu bắt buộc có dòng submissions khớp session_token ở
-- teacher_import_rescue() (không nới lỏng), sửa start_attempt ở phía client cho bền hơn.
-- Phần này CHỈ thêm công cụ tra cứu để giáo viên chọn đúng học sinh trong danh sách (khi học
-- sinh có dòng submissions nhưng dropdown ban đầu lọc quá hẹp), không nới lỏng RPC nhập cứu hộ.

-- Tra học sinh theo đúng mã số (HS + 6 ký tự, hiện trong hồ sơ cá nhân của học sinh) khi
-- danh sách thí sinh lấy từ submissions không hiện tên cần tìm. Chỉ trả về hồ sơ (không tạo bài
-- làm nào) nên không ảnh hưởng gì tới yêu cầu "đã thật sự bắt đầu làm đề" của RPC nhập cứu hộ.
CREATE OR REPLACE FUNCTION public.teacher_lookup_student_by_code(p_code text)
RETURNS TABLE(id uuid, full_name text, school text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_teacher() THEN RAISE EXCEPTION 'Chỉ giáo viên được dùng chức năng này'; END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.school FROM profiles p
     WHERE p.role = 'student' AND p.user_code = upper(trim(p_code));
END $$;
REVOKE ALL ON FUNCTION public.teacher_lookup_student_by_code(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_lookup_student_by_code(text) TO authenticated;
