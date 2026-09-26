-- Đồng hồ đếm ngược làm bài hiện tính hoàn toàn bằng Date.now() phía trình duyệt:
-- học sinh chỉnh lùi giờ hệ thống máy tính là có thêm thời gian làm bài.
-- Thêm 1 hàm đọc giờ server để client tự tính offset (server - client) rồi
-- cộng bù vào mọi phép tính thời gian, tương tự cơ chế NTP đơn giản.

CREATE OR REPLACE FUNCTION public.server_now() RETURNS timestamptz
LANGUAGE sql STABLE AS $$
  SELECT now();
$$;

GRANT EXECUTE ON FUNCTION public.server_now() TO anon, authenticated;
