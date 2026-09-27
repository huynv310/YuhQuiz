-- Lỗ hổng: trg_exams_release() (20260925, mở rộng ở 20261003/20261004) chỉ chạy AFTER DELETE.
-- Giáo viên SỬA đề và đổi sang file PDF khác thì file PDF cũ không bao giờ được dọn, thành rác
-- vĩnh viễn trong bucket exam-pdfs. Hàm chỉ đọc từ OLD và các hàm release_* đã tự kiểm tra còn
-- được tham chiếu hay không trước khi xóa, nên dùng lại nguyên hàm cũ, chỉ thêm trigger UPDATE.
DROP TRIGGER IF EXISTS trg_exams_release_upd ON public.exams;
CREATE TRIGGER trg_exams_release_upd AFTER UPDATE OF pdf_url, pdf_r2_url ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.trg_exams_release();
