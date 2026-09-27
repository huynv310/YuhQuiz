-- Log lỗi phía trình duyệt: trước giờ lỗi runtime chỉ hiện qua alert() hoặc console.error,
-- không lưu lại đâu cả — app lỗi ở production thì chỉ biết khi học sinh/giáo viên báo lại.
-- Bảng kín (không SELECT/INSERT trực tiếp), chỉ ghi qua RPC log_client_error.

CREATE TABLE IF NOT EXISTS public.client_errors (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  message text NOT NULL,
  stack text,
  url text,
  user_agent text
);
ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_errors FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_client_error(p_message text, p_stack text DEFAULT NULL, p_url text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ua text;
BEGIN
  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN RETURN; END IF;

  BEGIN
    v_ua := current_setting('request.headers', true)::json->>'user-agent';
  EXCEPTION WHEN OTHERS THEN v_ua := NULL; END;

  -- Tự dọn bớt để bảng không phình vô hạn nếu bị spam (DB free tier có hạn 500MB).
  IF (SELECT count(*) FROM public.client_errors) > 2000 THEN
    DELETE FROM public.client_errors WHERE id IN (
      SELECT id FROM public.client_errors ORDER BY id ASC LIMIT 200
    );
  END IF;

  INSERT INTO public.client_errors (user_id, message, stack, url, user_agent)
  VALUES (auth.uid(), left(p_message, 500), left(p_stack, 4000), left(p_url, 300), left(v_ua, 300));
END $$;

REVOKE ALL ON FUNCTION public.log_client_error(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_client_error(text, text, text) TO anon, authenticated;
