-- ====================================================================
-- YUHQUIZ MIGRATION: 20261017_fix_get_my_rank_overload.sql
-- Sửa lỗi do 20261016 gây ra: CREATE OR REPLACE get_my_rank(p_force_role text DEFAULT NULL)
-- có chữ ký khác get_my_rank() cũ nên PostgreSQL tạo thêm 1 OVERLOAD thay vì thay thế.
-- Mọi lời gọi get_my_rank() không tham số trở nên mơ hồ:
--   ERROR: function public.get_my_rank() is not unique
-- Sửa: xóa overload 0 tham số cũ. Phiên bản (text DEFAULT NULL) vẫn nhận lời gọi không tham số
-- và cho kết quả y hệt bản cũ (tự đọc role từ profiles khi p_force_role IS NULL).
-- Chỉ xóa hàm, không đụng tới dữ liệu.
-- ====================================================================

DROP FUNCTION IF EXISTS public.get_my_rank();

REVOKE ALL ON FUNCTION public.get_my_rank(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_rank(text) TO authenticated;
